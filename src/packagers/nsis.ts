import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { type ElectrobunConfig } from "../config";

// ESM での __dirname の代わり (または import.meta.dirname を使用可能ならそちら)
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface NSISOptions {
  projectRoot: string;
  outputName: string;
  dryRun?: boolean;
}

export async function buildNSIS(config: ElectrobunConfig, options: NSISOptions): Promise<string> {
  // テンプレートパスをライブラリのインストール場所から解決
  // src/packagers/nsis.ts から見て ../../templates/ 
  const templatePath = resolve(__dirname, "..", "..", "templates", "installer.nsi.template");
  
  if (!existsSync(templatePath)) {
      throw new Error(`NSIS テンプレートが見つかりません: ${templatePath}`);
  }
  
  let template = readFileSync(templatePath, "utf-8");

  const winConfig = config.build?.win || config.windows;

  const buildSourceDir = (() => {
    const appFolderName = winConfig?.installDir || config.name;
    const subDir = join(options.projectRoot, "build", "stable-win-x64", appFolderName);
    return existsSync(subDir) ? subDir : join(options.projectRoot, "build", "stable-win-x64");
  })();

  // フォルダ全体のサイズ（KB）を計算
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

  // プレースホルダーの置換
  const replacements: Record<string, string> = {
    "{{APP_NAME}}": config.name,
    "{{APP_VERSION}}": config.version,
    "{{PRODUCT_ID}}": winConfig?.productId || config.name,
    "{{EXE_NAME}}": options.outputName,
    "{{INSTALL_DIR}}": winConfig?.installDir || config.name,
    "{{PUBLISHER}}": config.author || config.name,
    "{{ICON_PATH}}": winConfig?.icon ? resolve(options.projectRoot, winConfig.icon) : "",
    "{{ICON_FILENAME}}": "icon.ico",
    "{{LANGUAGE_NAME}}": winConfig?.languageName || (winConfig?.languageCode === "1041" || !winConfig?.languageCode ? "Japanese" : "English"),
    "{{BUILD_SOURCE_DIR}}": buildSourceDir,
    "{{ESTIMATED_SIZE}}": estimatedSizeKB,
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(key, value);
  }

  const nsiPath = join(options.projectRoot, "dist", "installer.nsi");
  
  // 日本語文字を含むため、UTF-8 BOM 付きで保存して makensis.exe に正しく認識させる
  writeFileSync(nsiPath, "\uFEFF" + template, "utf-8");

  const { isBinaryInPath } = await import("../utils/deps");
  const makensisPath = isBinaryInPath("makensis") || "makensis";

  if (options.dryRun) {
    console.log(`[DRY-RUN] NSIS テンプレート生成完了: ${nsiPath}`);
    return nsiPath;
  }

  return new Promise((resolve, reject) => {
    // makensis コマンドの実行
    const makensis = spawn(makensisPath, [nsiPath]);

    makensis.on("close", (code) => {
      if (code === 0) {
        resolve(join(options.projectRoot, "dist", options.outputName));
      } else {
        reject(new Error(`makensis がエラーコード ${code} で終了しました。`));
      }
    });

    makensis.stderr.on("data", (data) => {
      console.error(`NSIS Error: ${data}`);
    });
  });
}
