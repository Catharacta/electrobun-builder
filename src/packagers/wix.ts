import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
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

  const buildSourceDir = join(options.projectRoot, "build", "stable-win-x64");
  const identifier = config.id || `${config.name}.example.com`;
  const upgradeCode = uuidv5(identifier, NAMESPACE);

  // コンポーネントの動的生成
  const components = generateWixComponents(buildSourceDir);

  // プレースホルダーの置換
  const replacements: Record<string, string> = {
    "{{APP_NAME}}": config.name,
    "{{APP_VERSION}}": config.version,
    "{{COMPANY_NAME}}": config.author || "Default Company",
    "{{UPGRADE_CODE}}": upgradeCode,
    "{{INSTALL_DIR}}": config.windows?.installDir || config.name,
    "{{EXE_NAME}}": `${config.name}.exe`,
    "{{COMPONENTS}}": components,
    "{{LANGUAGE_CODE}}": config.windows?.languageCode || "1041",
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(key, value);
  }

  const wxsPath = join(options.projectRoot, "dist", "installer.wxs");
  writeFileSync(wxsPath, template);

  return new Promise((resolve, reject) => {
    // WiX v3 の場合: candle -> light
    // ここでは単純化のため candle のみを呼び出すか、スクリプト化する
    const candle = spawn("candle", ["-out", join(options.projectRoot, "dist", "installer.wixobj"), wxsPath]);

    candle.on("close", (code) => {
      if (code === 0) {
        const light = spawn("light", ["-out", join(options.projectRoot, "dist", `${config.name}.msi`), join(options.projectRoot, "dist", "installer.wixobj")]);
        light.on("close", (lCode) => {
          if (lCode === 0) {
            resolve(join(options.projectRoot, "dist", `${config.name}.msi`));
          } else {
            reject(new Error(`light がエラーコード ${lCode} で終了しました。`));
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
 */
function generateWixComponents(sourceDir: string): string {
  const files: string[] = [];
  
  function walk(dir: string) {
    const list = readdirSync(dir);
    for (const file of list) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  if (readdirSync(sourceDir).length === 0) {
    console.warn(`Warning: Source directory is empty: ${sourceDir}`);
  }
  walk(sourceDir);

  let xml = '<ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">\n';
  
  for (const file of files) {
    const relPath = relative(sourceDir, file);
    // パスから一意なハッシュ(8桁)を生成して ID 衝突を防ぐ (Error 55 対策)
    const hash = createHash('sha1').update(relPath).digest('hex').substring(0, 8);
    const finalId = `f${hash}`; 
    
    xml += `            <Component Id="comp_${finalId}" Guid="*">\n`;
    xml += `                <File Id="file_${finalId}" Source="${file}" KeyPath="yes" />\n`;
    xml += `            </Component>\n`;
  }

  xml += '        </ComponentGroup>';
  return xml;
}
