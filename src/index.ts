/**
 * All comments and messages in this library must be in English.
 */
import { loadConfig } from "./config.js";
import { buildNSIS } from "./packagers/nsis.js";
import { buildWiX } from "./packagers/wix.js";
import { signFile } from "./sign.js";
import { generateUpdateMetadata } from "./update.js";
import { updateExeResource, getResourceOptionsFromConfig } from "./resource.js";
import { checkDependencies } from "./utils/deps.js";
import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";



export interface BuildOptions {
  target: "nsis" | "wix" | "msix";
  sign?: boolean;
  pfx?: string;
  password?: string;
  update?: boolean;
  baseUrl?: string;
  dryRun?: boolean;
}

/**
 * Builds the Electrobun application for the specified target format.
 */
export async function build(projectRoot: string, options: BuildOptions) {
  const config = await loadConfig(projectRoot);
  const target = options.target;
  const shouldSign = options.sign;
  const shouldUpdate = options.update;
  
  if (!options.dryRun) {
    await checkDependencies(target, !!shouldSign);
  } else {
    console.log("[DRY-RUN] Skipping dependency checks.");
  }

  console.log(`Build target: ${target}`);

  // Create dist directory
  const distDir = join(projectRoot, "dist");
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

  // --- Automation of executable placement and renaming ---
  const winConfig = config.build?.win || config.windows;
  const appName = config.name;
  const appFolderName = winConfig?.installDir || appName;
  
  const buildRootDir = join(projectRoot, "build", "stable-win-x64");
  const appSubDir = join(buildRootDir, appFolderName);
  const appDir = existsSync(appSubDir) ? appSubDir : buildRootDir;
  
  if (options.dryRun && !existsSync(appDir)) {
      mkdirSync(appDir, { recursive: true });
      mkdirSync(join(appDir, "bin"), { recursive: true });
  }

  // --- Path settings for executables ---
  const launcherExePath = join(appDir, "bin", "launcher.exe");
  const iconSource = winConfig?.icon ? resolve(projectRoot, winConfig.icon) : null;
  const iconDest = join(appDir, "icon.ico");


  // --- Unpack archive (if useAsar: false) ---
  if (winConfig?.useAsar === false) {
      const resourcesDir = join(appDir, "Resources");
      
      if (existsSync(resourcesDir) && !existsSync(join(resourcesDir, "app"))) {
          const files = readdirSync(resourcesDir);
          const tarZstFile = files.find(f => f.endsWith(".tar.zst"));
          
          if (tarZstFile) {
              const zstdPath = join(projectRoot, "node_modules", "electrobun", "dist-win-x64", "zig-zstd.exe");
              const tarZstPath = join(resourcesDir, tarZstFile);
              const tarFile = tarZstFile.replace(".zst", "");
              const tarPath = join(resourcesDir, tarFile);
              
                if (options.dryRun) {
                    console.log(`[DRY-RUN] Decompressing and cleaning up archive: ${tarZstFile}`);
                } else {
                    console.log(`Decompressing archive: ${tarZstFile}`);
                    try {
                        execSync(`"${zstdPath}" decompress -i "${tarZstPath}" -o "${tarPath}"`, { stdio: "inherit" });
                        
                        const mergeTargetDir = join(appDir, "..");
                        console.log(`Extraction destination: ${mergeTargetDir}`);
                        execSync(`tar -xf "${tarPath}" -C "${mergeTargetDir}"`, { stdio: "inherit" });
                        
                        console.log(`Extraction completed. Deleting temporary files...`);
                        if (existsSync(tarPath)) unlinkSync(tarPath);
                        if (existsSync(tarZstPath)) {
                            console.log(`Deleting unnecessary archive: ${tarZstFile}`);
                            unlinkSync(tarZstPath);
                        }
                        
                    } catch (err) {
                        console.error(`Failed to decompress or clean up archive: ${err}`);
                    }
                }
          }
      }
  }

  // --- Prepare executables (place in bin folder) ---
  const genuineLauncherPath = join(projectRoot, "node_modules", "electrobun", "dist-win-x64", "launcher.exe");
  const genuineBunPath = join(projectRoot, "node_modules", "electrobun", "dist-win-x64", "bun.exe");
  
  if (!options.dryRun) {
      const appBinDir = join(appDir, "bin");
      if (!existsSync(appBinDir)) mkdirSync(appBinDir, { recursive: true });

      // 1. Placement of bun.exe
      const destBunPath = join(appBinDir, "bun.exe");
      if (existsSync(genuineBunPath)) {
          console.log(`Placing Bun: ${genuineBunPath} -> ${destBunPath}`);
          copyFileSync(genuineBunPath, destBunPath);
      }

      // 2. Placement of launcher.exe
      const binLauncherPath = join(appBinDir, "launcher.exe");
      if (existsSync(genuineLauncherPath)) {
          console.log(`Placing launcher: ${genuineLauncherPath} -> ${binLauncherPath}`);
          copyFileSync(genuineLauncherPath, binLauncherPath);

          const extensionlessLauncher = join(appBinDir, "launcher");
          if (existsSync(extensionlessLauncher)) {
              unlinkSync(extensionlessLauncher);
          }
      }

      // 3. Complementing other required DLLs
      const requiredDlls = ["libNativeWrapper.dll", "WebView2Loader.dll", "d3dcompiler_47.dll", "webgpu_dawn.dll"];
      requiredDlls.forEach(dll => {
          const src = join(projectRoot, "node_modules", "electrobun", "dist-win-x64", dll);
          const dest = join(appBinDir, dll);
          if (existsSync(src) && !existsSync(dest)) {
              console.log(`Complementing missing DLL: ${dll}`);
              copyFileSync(src, dest);
          }
      });
  }

  if (!options.dryRun && iconSource && existsSync(iconSource)) {
      console.log(`Bundling icon: ${iconDest}`);
      copyFileSync(iconSource, iconDest);
  }

  // --- Resource patching (embedding icon, version info, etc.) ---
  if (!options.dryRun) {
      console.log("Updating executable resources...");
      const resourceOptions = getResourceOptionsFromConfig(config);
      try {
          if (existsSync(launcherExePath)) {
              await updateExeResource(launcherExePath, resourceOptions);
          }
      } catch (err) {
          console.warn(`Warning: Failed to update resources: ${err}`);
      }
  }

  let outputPath = "";
  if (target === "nsis") {
    outputPath = await buildNSIS(config, { projectRoot, outputName: `${appName}-setup.exe`, dryRun: options.dryRun });
  } else if (target === "wix") {
    outputPath = await buildWiX(config, { projectRoot, outputName: `${appName}.msi`, dryRun: options.dryRun });
  }

  if (!options.dryRun) {
    if (shouldSign && options.pfx) {
      await signFile(outputPath, { pfxPath: options.pfx, password: options.password });
    }

    if (shouldUpdate) {
      const baseUrl = options.baseUrl || "https://example.com/downloads";
      await generateUpdateMetadata(outputPath, config.version || "1.0.0", baseUrl, distDir);
    }
    
    console.log(`\nBuild success: ${outputPath}`);
  }
}

async function main() {
  const projectRoot = process.cwd();
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  if (command === "help") {
    console.log("Usage: npx electrobun-builder <command> [options]");
    console.log("Commands:");
    console.log("  build --target <nsis|wix>  Build the installer (default: nsis)");
    console.log("  brand                      Apply branding (icons/metadata) to pre-built binaries");
    console.log("Options:");
    console.log("  --target <t>       Build target (nsis, wix)");
    console.log("  --dry-run          Skip execution and only perform validation");
    console.log("  --sign             Perform code signing after build");
    console.log("  --pfx <path>       Path to PFX certificate");
    console.log("  --password <pw>    Certificate password");
    return;
  }

  try {
    if (command === "build") {
      const targetIndex = args.lastIndexOf("--target");
      const target = (targetIndex !== -1 ? args[targetIndex + 1] : "nsis") as any;
      
      await build(projectRoot, {
        target,
        sign: args.includes("--sign"),
        pfx: args.lastIndexOf("--pfx") !== -1 ? args[args.lastIndexOf("--pfx") + 1] : undefined,
        password: args.lastIndexOf("--password") !== -1 ? args[args.lastIndexOf("--password") + 1] : undefined,
        update: args.includes("--update"),
        baseUrl: args.lastIndexOf("--baseUrl") !== -1 ? args[args.lastIndexOf("--baseUrl") + 1] : undefined,
        dryRun: args.includes("--dry-run")
      });
    } else if (command === "brand") {
      await brand(projectRoot);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Searches the build folder and applies branding to all found executables
 * based on the configuration in electrobun.config.ts.
 */
export async function brand(projectRoot: string) {
  console.log("Starting branding process for executables...");
  const config = await loadConfig(projectRoot);
  const resourceOptions = getResourceOptionsFromConfig(config);
  
  // Search directory
  const buildDir = join(projectRoot, "build");
  if (!existsSync(buildDir)) {
    console.log("build directory not found. Please build the project first.");
    return;
  }

  // Recursively explore folders to find .exe files
  const processFolder = async (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await processFolder(fullPath);
      } else if (entry.isFile() && (entry.name === "launcher.exe" || entry.name === "bun.exe" || entry.name === `${config.name}.exe`)) {
        console.log(`Applying branding to: ${fullPath}`);
        await updateExeResource(fullPath, resourceOptions);
      }
    }
  };

  try {
    await processFolder(buildDir);
    console.log("Branding process completed successfully.");
  } catch (err) {
    console.error(`Error occurred during branding: ${err}`);
  }
}

const isMain = (import.meta as any).main || (typeof process !== 'undefined' && process.argv[1] && (resolve(process.argv[1]) === fileURLToPath(import.meta.url)));

if (isMain) {
  main();
}
