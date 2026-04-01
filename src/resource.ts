import path from "node:path";
import { rcedit } from "rcedit";
import { type ElectrobunConfig } from "./config";

export interface ResourceOptions {
  icon?: string;
  version?: string;
  companyName?: string;
  fileDescription?: string;
  legalCopyright?: string;
  productName?: string;
}

/**
 * .exe ファイルのリソース（アイコン、バージョン情報等）を書き換えます。
 * @param exePath 対象となる .exe ファイルのパス
 * @param options 書き換え内容
 */
export async function updateExeResource(exePath: string, options: ResourceOptions): Promise<void> {
  const rceditOptions: any = {};

  if (options.icon) {
    // rcedit requires absolute path for icon in some environments (e.g. CI)
    rceditOptions.icon = path.resolve(process.cwd(), options.icon);
  }

  if (options.version) {
    rceditOptions["product-version"] = options.version;
    rceditOptions["file-version"] = options.version;
  }

  if (options.companyName) {
    rceditOptions["version-string"] = rceditOptions["version-string"] || {};
    rceditOptions["version-string"].CompanyName = options.companyName;
  }

  if (options.productName) {
    rceditOptions["version-string"] = rceditOptions["version-string"] || {};
    rceditOptions["version-string"].ProductName = options.productName;
  }

  if (options.fileDescription) {
    rceditOptions["version-string"] = rceditOptions["version-string"] || {};
    rceditOptions["version-string"].FileDescription = options.fileDescription;
  }

  if (options.legalCopyright) {
    rceditOptions["version-string"] = rceditOptions["version-string"] || {};
    rceditOptions["version-string"].LegalCopyright = options.legalCopyright;
  }

  const absoluteExePath = path.resolve(process.cwd(), exePath);
  try {
    await rcedit(absoluteExePath, rceditOptions);
    console.log(`[SUCCESS] .exe リソースの更新が完了しました: ${path.basename(exePath)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[WARNING] .exe リソースの更新に失敗しましたが、ビルドを続行します: ${message}`);
    console.warn(`対象ファイル: ${absoluteExePath}`);
  }
}

/**
 * 設定ファイルからリソースオプションを生成します。
 */
export function getResourceOptionsFromConfig(config: ElectrobunConfig): ResourceOptions {
  const win = config.build?.win || config.windows;
  return {
    icon: win?.icon,
    version: config.version,
    productName: config.name,
    fileDescription: config.name,
    legalCopyright: `Copyright © ${new Date().getFullYear()} ${config.author || ""}`.trim(),
  };
}
