/**
 * All comments and messages in this library must be in English.
 */
import path from "node:path";
import { rcedit } from "rcedit";
import { type ElectrobunConfig } from "./config.js";

export interface ResourceOptions {
  icon?: string;
  version?: string;
  companyName?: string;
  fileDescription?: string;
  legalCopyright?: string;
  productName?: string;
  internalName?: string;
  originalFilename?: string;
}

/**
 * Updates resources (icons, version info, etc.) for the .exe file.
 * @param exePath Path to the target .exe file
 * @param options Content for updating
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

  rceditOptions["version-string"] = rceditOptions["version-string"] || {};
  
  if (options.companyName) {
    rceditOptions["version-string"].CompanyName = options.companyName;
  }

  if (options.productName) {
    rceditOptions["version-string"].ProductName = options.productName;
  }

  if (options.fileDescription) {
    rceditOptions["version-string"].FileDescription = options.fileDescription;
  }

  if (options.legalCopyright) {
    rceditOptions["version-string"].LegalCopyright = options.legalCopyright;
  }

  if (options.internalName) {
    rceditOptions["version-string"].InternalName = options.internalName;
  }

  if (options.originalFilename) {
    rceditOptions["version-string"].OriginalFilename = options.originalFilename;
  }

  const absoluteExePath = path.resolve(process.cwd(), exePath);
  try {
    await rcedit(absoluteExePath, rceditOptions);
    console.log(`[SUCCESS] .exe resource update completed: ${path.basename(exePath)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[WARNING] Failed to update .exe resources, but continuing build: ${message}`);
    console.warn(`Target file: ${absoluteExePath}`);
  }
}

/**
 * Generates resource options from the configuration file.
 */
export function getResourceOptionsFromConfig(config: ElectrobunConfig): ResourceOptions {
  const win = config.build?.win || config.windows;
  return {
    icon: win?.icon,
    version: config.version,
    productName: config.name,
    fileDescription: config.name,
    companyName: config.author || "Catharacta",
    internalName: config.name,
    originalFilename: `${config.name}.exe`,
    legalCopyright: `Copyright © ${new Date().getFullYear()} ${config.author || "Catharacta"}`.trim(),
  };
}
