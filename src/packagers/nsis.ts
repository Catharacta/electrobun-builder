import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { type ElectrobunConfig } from "../config";

export interface NSISOptions {
  projectRoot: string;
  outputName: string;
}

export async function buildNSIS(config: ElectrobunConfig, options: NSISOptions): Promise<string> {
  const templatePath = join(options.projectRoot, "templates", "installer.nsi.template");
  let template = readFileSync(templatePath, "utf-8");

  // プレースホルダーの置換
  const replacements: Record<string, string> = {
    "{{APP_NAME}}": config.name,
    "{{APP_VERSION}}": config.version,
    "{{PRODUCT_ID}}": config.windows?.productId || config.name,
    "{{EXE_NAME}}": `${config.name}.exe`,
    "{{INSTALL_DIR}}": config.windows?.installDir || config.name,
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(key, value);
  }

  const nsiPath = join(options.projectRoot, "dist", "installer.nsi");
  writeFileSync(nsiPath, template);

  return new Promise((resolve, reject) => {
    // makensis コマンドの実行
    const makensis = spawn("makensis", [nsiPath]);

    makensis.on("close", (code) => {
      if (code === 0) {
        resolve(join(options.projectRoot, "dist", replacements["{{EXE_NAME}}"]));
      } else {
        reject(new Error(`makensis がエラーコード ${code} で終了しました。`));
      }
    });

    makensis.stderr.on("data", (data) => {
      console.error(`NSIS Error: ${data}`);
    });
  });
}
