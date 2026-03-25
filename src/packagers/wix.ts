import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { v5 as uuidv5 } from "uuid";
import { type ElectrobunConfig } from "../config";

const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // DNS namespace for stable results

export interface WiXOptions {
  projectRoot: string;
  outputName: string;
}

export async function buildWiX(config: ElectrobunConfig, options: WiXOptions): Promise<string> {
  const templatePath = join(options.projectRoot, "templates", "installer.wxs.template");
  let template = readFileSync(templatePath, "utf-8");

  const appFolderName = config.windows?.installDir || config.name;
  const buildSourceDirCandidate = join(options.projectRoot, "build", "stable-win-x64", appFolderName);
  const buildSourceDir = existsSync(buildSourceDirCandidate) ? buildSourceDirCandidate : join(options.projectRoot, "build", "stable-win-x64");

  const identifier = config.id || `${config.name}.example.com`;
  const upgradeCode = uuidv5(identifier, NAMESPACE);

  // コンポーネントの動的生成 (再帰構造)
  const { structure, refs } = generateWixComponents(buildSourceDir);

  // プレースホルダーの置換
  const languageCode = config.windows?.languageCode || "1041";
  const codepage = languageCode === "1041" ? "932" : "1252";

  const replacements: Record<string, string> = {
    "{{APP_NAME}}": config.name,
    "{{APP_VERSION}}": config.version,
    "{{COMPANY_NAME}}": config.author || "Default Company",
    "{{UPGRADE_CODE}}": upgradeCode,
    "{{INSTALL_DIR}}": config.windows?.installDir || config.name,
    "{{EXE_NAME}}": `${config.name}.exe`,
    "{{DIRECTORY_STRUCTURE}}": structure,
    "{{COMPONENT_REFS}}": refs,
    "{{LANGUAGE_CODE}}": languageCode,
    "{{CODEPAGE}}": codepage,
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(key, value);
  }

  const wxsPath = join(options.projectRoot, "dist", "installer.wxs");
  writeFileSync(wxsPath, template);

  return new Promise((resolve, reject) => {
    // WiX v3 の場合: candle -> light
    const candle = spawn("candle", ["-out", join(options.projectRoot, "dist", "installer.wixobj"), wxsPath]);

    candle.on("close", (code) => {
      if (code === 0) {
        const light = spawn("light", ["-out", join(options.projectRoot, "dist", `${config.name}.msi`), join(options.projectRoot, "dist", "installer.wixobj")]);
        
        light.stdout.on("data", (data) => {
          console.log(`WiX Light: ${data}`);
        });

        light.stderr.on("data", (data) => {
          console.error(`WiX Light Error: ${data}`);
        });

        light.on("close", (lCode) => {
          if (lCode === 0) {
            resolve(join(options.projectRoot, "dist", `${config.name}.msi`));
          } else {
            reject(new Error(`light がエラーコード ${lCode} で終了しました。詳細は WiX Light Error ログを確認してください。`));
          }
        });
      } else {
        reject(new Error(`candle がエラーコード ${code} で終了しました。`));
      }
    });

    candle.stderr.on("data", (data) => {
      console.error(`WiX Candle Error: ${data}`);
    });
  });
}

/**
 * ビルドディレクトリをスキャンして WiX のコンポーネント XML を生成します。
 * ディレクトリ構造を維持するために再帰的に処理します。
 */
function generateWixComponents(sourceDir: string): { structure: string; refs: string } {
  let structureXml = "";
  let refsXml = "";
  const usedIds = new Map<string, string>(); // ID -> Path のチェック用マップ

  function processDirectory(currentDir: string, indent: string = "                    "): void {
    if (!existsSync(currentDir)) return;
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      // パスの正規化 (バックスラッシュをスラッシュに統一)
      const relPath = relative(sourceDir, fullPath).replace(/\\/g, "/");
      
      // ハッシュ長を 40文字 (SHA1全文字) に延長
      const hash = createHash("sha1").update(relPath).digest("hex");
      const finalId = `f${hash}`;

      if (stat.isDirectory()) {
        const dirId = `dir_${hash}`;
        // 重複チェック
        if (usedIds.has(dirId)) {
          throw new Error(`Duplicate ID detected for directory: ${dirId}\nExisting: ${usedIds.get(dirId)}\nNew: ${relPath}`);
        }
        usedIds.set(dirId, relPath);

        // Directory 構造のみ出力（Component は含めない）
        structureXml += `${indent}<Directory Id="${dirId}" Name="${item}">\n`;
        processDirectory(fullPath, indent + "    ");
        structureXml += `${indent}</Directory>\n`;
      } else {
        const componentId = `comp_${finalId}`;
        const fileId = `file_${finalId}`;

        // 重複チェック
        if (usedIds.has(componentId)) {
          throw new Error(`Duplicate ID detected for component: ${componentId}\nExisting: ${usedIds.get(componentId)}\nNew: ${relPath}`);
        }
        usedIds.set(componentId, relPath);

        // Component の親 Directory ID を特定
        const parentRelPath = relative(sourceDir, currentDir).replace(/\\/g, "/");
        let directoryId: string;
        if (parentRelPath === "" || parentRelPath === ".") {
          directoryId = "INSTALLFOLDER";
        } else {
          const parentHash = createHash("sha1").update(parentRelPath).digest("hex");
          directoryId = `dir_${parentHash}`;
        }

        // Component は ComponentGroup 内に Directory 属性付きで定義
        refsXml += `            <Component Id="${componentId}" Directory="${directoryId}" Guid="*" Win64="yes">\n`;
        refsXml += `                <File Id="${fileId}" Source="${fullPath}" KeyPath="yes" />\n`;
        refsXml += `            </Component>\n`;
      }
    }
  }

  // もし sourceDir が存在しない、または空なら警告
  if (!existsSync(sourceDir) || readdirSync(sourceDir).length === 0) {
    console.warn(`Warning: Source directory is empty or missing: ${sourceDir}`);
    return { structure: "", refs: "" };
  }

  processDirectory(sourceDir);
  return { structure: structureXml, refs: refsXml };
}
