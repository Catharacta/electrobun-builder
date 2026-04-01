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
 * Electrobun アプリケーションを指定されたターゲット形式でビルドします。
 */
export async function build(projectRoot: string, options: BuildOptions) {
  const config = await loadConfig(projectRoot);
  const target = options.target;
  const shouldSign = options.sign;
  const shouldUpdate = options.update;
  
  if (!options.dryRun) {
    await checkDependencies(target, !!shouldSign);
  } else {
    console.log("[DRY-RUN] 依存関係チェックをスキップします。");
  }

  console.log(`ビルドターゲット: ${target}`);

  // dist ディレクトリの作成
  const distDir = join(projectRoot, "dist");
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

  // --- 実行ファイルの配置と名称変更の自動化 ---
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

  // --- 実行ファイルのパス設定 ---
  const launcherExePath = join(appDir, "bin", "launcher.exe");
  const iconSource = winConfig?.icon ? resolve(projectRoot, winConfig.icon) : null;
  const iconDest = join(appDir, "icon.ico");


  // --- アーカイブの展開 (useAsar: false の場合) ---
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
                    console.log(`[DRY-RUN] アーカイブを展開およびクリーンアップします: ${tarZstFile}`);
                } else {
                    console.log(`アーカイブを展開中: ${tarZstFile}`);
                    try {
                        execSync(`"${zstdPath}" decompress -i "${tarZstPath}" -o "${tarPath}"`, { stdio: "inherit" });
                        
                        const mergeTargetDir = join(appDir, "..");
                        console.log(`展開先: ${mergeTargetDir}`);
                        execSync(`tar -xf "${tarPath}" -C "${mergeTargetDir}"`, { stdio: "inherit" });
                        
                        console.log(`展開完了。不要な中間ファイルを削除中...`);
                        if (existsSync(tarPath)) unlinkSync(tarPath);
                        
                    } catch (err) {
                        console.error(`アーカイブの展開またはクリーンアップに失敗しました: ${err}`);
                    }
                }
          }
      }
  }

  // --- 実行ファイルの準備 (bin 内に配置) ---
  const genuineLauncherPath = join(projectRoot, "node_modules", "electrobun", "dist-win-x64", "launcher.exe");
  const genuineBunPath = join(projectRoot, "node_modules", "electrobun", "dist-win-x64", "bun.exe");
  
  if (!options.dryRun) {
      const appBinDir = join(appDir, "bin");
      if (!existsSync(appBinDir)) mkdirSync(appBinDir, { recursive: true });

      // 1. bun.exe の配置
      const destBunPath = join(appBinDir, "bun.exe");
      if (existsSync(genuineBunPath)) {
          console.log(`Bun を配置中: ${genuineBunPath} -> ${destBunPath}`);
          copyFileSync(genuineBunPath, destBunPath);
      }

      // 2. launcher.exe の配置
      const binLauncherPath = join(appBinDir, "launcher.exe");
      if (existsSync(genuineLauncherPath)) {
          console.log(`ランチャーを配置中: ${genuineLauncherPath} -> ${binLauncherPath}`);
          copyFileSync(genuineLauncherPath, binLauncherPath);

          const extensionlessLauncher = join(appBinDir, "launcher");
          if (existsSync(extensionlessLauncher)) {
              unlinkSync(extensionlessLauncher);
          }
      }

      // 3. その他の必須 DLL の補完
      const requiredDlls = ["libNativeWrapper.dll", "WebView2Loader.dll", "d3dcompiler_47.dll", "webgpu_dawn.dll"];
      requiredDlls.forEach(dll => {
          const src = join(projectRoot, "node_modules", "electrobun", "dist-win-x64", dll);
          const dest = join(appBinDir, dll);
          if (existsSync(src) && !existsSync(dest)) {
              console.log(`不足している DLL を補完中: ${dll}`);
              copyFileSync(src, dest);
          }
      });
  }

  if (!options.dryRun && iconSource && existsSync(iconSource)) {
      console.log(`アイコンを同梱中: ${iconDest}`);
      copyFileSync(iconSource, iconDest);
  }

  // --- リソースパッチ (アイコン、バージョン情報等の埋め込み) ---
  if (!options.dryRun) {
      console.log("実行ファイルのリソースを更新中...");
      const resourceOptions = getResourceOptionsFromConfig(config);
      try {
          if (existsSync(launcherExePath)) {
              await updateExeResource(launcherExePath, resourceOptions);
          }
      } catch (err) {
          console.warn(`警告: リソースの更新に失敗しました: ${err}`);
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
    
    console.log(`\nビルド成功: ${outputPath}`);
  }
}

async function main() {
  const projectRoot = process.cwd();
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  if (command === "help") {
    console.log("使用法: npx electrobun-builder <command> [options]");
    console.log("コマンド:");
    console.log("  build --target <nsis|wix>  インストーラーをビルドします (デフォルト: nsis)");
    console.log("オプション:");
    console.log("  --target <t>       ビルドターゲット (nsis, wix)");
    console.log("  --dry-run          コマンド実行をスキップして検証のみ行います");
    console.log("  --sign             ビルド後に署名を実行します");
    console.log("  --pfx <path>       PFX 証明書のパス");
    console.log("  --password <pw>    証明書のパスワード");
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
    }
  } catch (error) {
    console.error(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const isMain = (import.meta as any).main || (typeof process !== 'undefined' && process.argv[1] && (resolve(process.argv[1]) === fileURLToPath(import.meta.url)));

if (isMain) {
  main();
}
