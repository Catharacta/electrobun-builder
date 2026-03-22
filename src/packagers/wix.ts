import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { type ElectrobunConfig } from "../config";

export interface WiXOptions {
  projectRoot: string;
  outputName: string;
}

export async function buildWiX(config: ElectrobunConfig, options: WiXOptions): Promise<string> {
  const templatePath = join(options.projectRoot, "templates", "installer.wxs.template");
  let template = readFileSync(templatePath, "utf-8");

  // プレースホルダーの置換
  const replacements: Record<string, string> = {
    "{{APP_NAME}}": config.name,
    "{{APP_VERSION}}": config.version,
    "{{COMPANY_NAME}}": config.author || "Default Company",
    "{{UPGRADE_CODE}}": "12345678-1234-1234-1234-123456789012", // TODO: 固定または生成
    "{{INSTALL_DIR}}": config.windows?.installDir || config.name,
    "{{EXE_NAME}}": `${config.name}.exe`,
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
