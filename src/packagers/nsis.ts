import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { type ElectrobunConfig } from "../config.js";

// Replacement for __dirname in ESM (use import.meta.dirname if available)
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface NSISOptions {
  projectRoot: string;
  outputName: string;
  dryRun?: boolean;
}

export async function buildNSIS(config: ElectrobunConfig, options: NSISOptions): Promise<string> {
  // Resolve template path from the library installation location
  // Looking for ../../templates/ relative to src/packagers/nsis.ts
  const templatePath = resolve(__dirname, "..", "..", "templates", "installer.nsi.template");
  
  if (!existsSync(templatePath)) {
      throw new Error(`NSIS template not found: ${templatePath}`);
  }
  
  let template = readFileSync(templatePath, "utf-8");

  const winConfig = config.build?.win || config.windows;

  const buildSourceDir = (() => {
    const appFolderName = winConfig?.installDir || config.name;
    const subDir = join(options.projectRoot, "build", "stable-win-x64", appFolderName);
    return existsSync(subDir) ? subDir : join(options.projectRoot, "build", "stable-win-x64");
  })();

  // Calculate total folder size (KB)
  const getFolderSize = (dir: string): number => {
      let size = 0;
      const files = readdirSync(dir);
      for (const file of files) {
          const filePath = join(dir, file);
          const stats = statSync(filePath);
          if (stats.isDirectory()) {
              size += getFolderSize(filePath);
          } else {
              size += stats.size;
          }
      }
      return size;
  };

  const totalSizeBytes = getFolderSize(buildSourceDir);
  const estimatedSizeKB = Math.round(totalSizeBytes / 1024).toString();

  // Replace placeholders
  const replacements: Record<string, string> = {
    "{{APP_NAME}}": config.name,
    "{{APP_VERSION}}": config.version,
    "{{PRODUCT_ID}}": winConfig?.productId || config.name,
    "{{EXE_NAME}}": options.outputName,
    "{{INSTALL_DIR}}": winConfig?.installDir || config.name,
    "{{PUBLISHER}}": config.author || config.name,
    "{{ICON_PATH}}": winConfig?.icon ? resolve(options.projectRoot, winConfig.icon) : "",
    "{{ICON_FILENAME}}": "icon.ico",
    "{{LANGUAGE_NAME}}": winConfig?.languageName || (winConfig?.languageCode === "1041" ? "Japanese" : "English"),
    "{{BUILD_SOURCE_DIR}}": buildSourceDir,
    "{{ESTIMATED_SIZE}}": estimatedSizeKB,
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(key, value);
  }

  const nsiPath = join(options.projectRoot, "dist", "installer.nsi");
  
  // Save with UTF-8 BOM so makensis.exe recognizes characters correctly (especially for Japanese)
  writeFileSync(nsiPath, "\uFEFF" + template, "utf-8");

  const { isBinaryInPath } = await import("../utils/deps.js");
  const makensisPath = isBinaryInPath("makensis") || "makensis";

  if (options.dryRun) {
    console.log(`[DRY-RUN] NSIS template generation completed: ${nsiPath}`);
    return nsiPath;
  }

  return new Promise((resolve, reject) => {
    // Execute makensis command
    const makensis = spawn(makensisPath, [nsiPath]);

    makensis.on("close", (code) => {
      if (code === 0) {
        resolve(join(options.projectRoot, "dist", options.outputName));
      } else {
        reject(new Error(`makensis exited with error code ${code}.`));
      }
    });

    makensis.stderr.on("data", (data) => {
      console.error(`NSIS Error: ${data}`);
    });
  });
}
