import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { v5 as uuidv5 } from "uuid";
import { type ElectrobunConfig } from "../config.js";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "\"": return "&quot;";
      case "'": return "&apos;";
      default: return c;
    }
  });
}

const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // DNS namespace for stable results

export interface WiXOptions {
  projectRoot: string;
  outputName: string;
  dryRun?: boolean;
}

export async function buildWiX(config: ElectrobunConfig, options: WiXOptions): Promise<string> {
  // src/packagers/wix.ts から見て ../../templates/ 
  const templatePath = resolve(__dirname, "..", "..", "templates", "installer.wxs.template");
  if (!existsSync(templatePath)) {
      throw new Error(`WiX テンプレートが見取かりません: ${templatePath}`);
  }
  
  let template = readFileSync(templatePath, "utf-8");

  const winConfig = config.build?.win || config.windows;
  const appFolderName = winConfig?.installDir || config.name;
  const buildSourceDirCandidate = join(options.projectRoot, "build", "stable-win-x64", appFolderName);
  const buildSourceDir = existsSync(buildSourceDirCandidate) ? buildSourceDirCandidate : join(options.projectRoot, "build", "stable-win-x64");
  
  const appName = config.name;
  const identifier = config.id || `${config.name}.example.com`;
  const upgradeCode = uuidv5(identifier, NAMESPACE);

  // コンポーネントの動的生成 (再帰構造)
  const { structure, refs } = generateWixComponents(buildSourceDir, config);

  // プレースホルダーの置換
  const languageCode = winConfig?.languageCode || "1041";
  const codepage = languageCode === "1041" ? "932" : "1252";

  const replacements: Record<string, string> = {
    "{{APP_NAME}}": config.name,
    "{{APP_VERSION}}": config.version,
    "{{COMPANY_NAME}}": config.author || "Default Company",
    "{{UPGRADE_CODE}}": upgradeCode,
    "{{INSTALL_DIR}}": winConfig?.installDir || config.name,
    "{{EXE_NAME}}": `${appName}.exe`,
    "{{DIRECTORY_STRUCTURE}}": structure,
    "{{COMPONENT_REFS}}": refs,
    "{{LANGUAGE_CODE}}": languageCode,
    "{{CODEPAGE}}": codepage,
    "{{PLATFORM}}": "x64",
    "{{ICON_PATH}}": join(options.projectRoot, winConfig?.icon || "icons/icon.ico"),
    "{{ICON_ID}}": "AppIcon",
  };

  // 1. ショートカット・レジストリコンポーネントの追加
  let finalRefs = refs;
  const safeCompanyName = (config.author || "ElectrobunUser").replace(/[^a-zA-Z0-9]/g, ""); 
  const safeAppName = config.name.replace(/[^a-zA-Z0-9]/g, "");
  const binRelPath = "bin";
  const binHash = createHash("sha1").update(binRelPath).digest("hex");
  const binDirId = `dir_${binHash}`;

  const safeAppNameXml = escapeXml(appName);
  
  finalRefs += `            <Component Id="ApplicationShortcut" Directory="ApplicationProgramsFolder" Guid="${uuidv5(`shortcut_app_${identifier}`, NAMESPACE)}" Win64="yes">\n`;
  finalRefs += `                <Shortcut Id="ApplicationStartMenuShortcut" \n`;
  finalRefs += `                          Name="${safeAppNameXml}" \n`;
  finalRefs += `                          Description="${safeAppNameXml} を起動します" \n`;
  finalRefs += `                          Target="[INSTALLFOLDER]bin\\launcher.exe" \n`;
  finalRefs += `                          Icon="AppIcon" \n`;
  finalRefs += `                          WorkingDirectory="INSTALLFOLDER"/>\n`;
  finalRefs += `                <RemoveFolder Id="CleanUpShortCut" Directory="ApplicationProgramsFolder" On="uninstall"/>\n`;
  finalRefs += `                <RegistryValue Root="HKCU" Key="Software\\${safeCompanyName}\\${safeAppName}\\Registry" Name="installed" Type="integer" Value="1" KeyPath="yes"/>\n`;
  finalRefs += `            </Component>\n`;
  finalRefs += `\n`;
  finalRefs += `            <Component Id="DesktopShortcut" Directory="DesktopFolder" Guid="${uuidv5(`shortcut_desktop_${identifier}`, NAMESPACE)}" Win64="yes">\n`;
  finalRefs += `                <Shortcut Id="ApplicationDesktopShortcut" \n`;
  finalRefs += `                          Name="${safeAppNameXml}" \n`;
  finalRefs += `                          Description="${safeAppNameXml} を起動します" \n`;
  finalRefs += `                          Target="[INSTALLFOLDER]bin\\launcher.exe" \n`;
  finalRefs += `                          Icon="AppIcon" \n`;
  finalRefs += `                          WorkingDirectory="INSTALLFOLDER"/>\n`;
  finalRefs += `                <RegistryValue Root="HKCU" Key="Software\\${safeCompanyName}\\${safeAppName}\\Registry" Name="desktopShortcut" Type="integer" Value="1" KeyPath="yes"/>\n`;
  finalRefs += `            </Component>\n`;

  replacements["{{COMPONENT_REFS}}"] = finalRefs;

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(key, value);
  }

  const wxsPath = join(options.projectRoot, "dist", "installer.wxs");
  writeFileSync(wxsPath, template, "utf-8");

  const { isBinaryInPath } = await import("../utils/deps.js");
  let candlePath = isBinaryInPath("candle") || "candle";
  let lightPath = isBinaryInPath("light") || "light";

  // WiX v3.14 の標準パスをチェック
  if (candlePath === "candle" && !existsSync(candlePath)) {
    const defaultCandle = "C:\\Program Files (x86)\\WiX Toolset v3.14\\bin\\candle.exe";
    if (existsSync(defaultCandle)) {
      candlePath = defaultCandle;
    }
  }
  if (lightPath === "light" && !existsSync(lightPath)) {
    const defaultLight = "C:\\Program Files (x86)\\WiX Toolset v3.14\\bin\\light.exe";
    if (existsSync(defaultLight)) {
      lightPath = defaultLight;
    }
  }

  if (options.dryRun) {
    console.log(`[DRY-RUN] WiX テンプレート生成完了: ${wxsPath}`);
    return wxsPath;
  }

  return new Promise((resolve, reject) => {
    // WiX v3 の場合: candle -> light
    const candle = spawn(`"${candlePath}"`, ["-out", join(options.projectRoot, "dist", "installer.wixobj"), wxsPath], { shell: true });

    candle.stdout.on("data", (data) => {
      console.log(`WiX Candle: ${data}`);
    });

    candle.stderr.on("data", (data) => {
      console.error(`WiX Candle Error: ${data}`);
    });

    candle.on("close", (code) => {
      if (code === 0) {
        const msiOutput = join(options.projectRoot, "dist", options.outputName);
        const light = spawn(`"${lightPath}"`, ["-out", msiOutput, join(options.projectRoot, "dist", "installer.wixobj")], { shell: true });
        
        light.stdout.on("data", (data) => {
          console.log(`WiX Light: ${data}`);
        });

        light.stderr.on("data", (data) => {
          console.error(`WiX Light Error: ${data}`);
        });

        light.on("close", (lCode) => {
          if (lCode === 0) {
            resolve(msiOutput);
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

function generateWixComponents(sourceDir: string, config: ElectrobunConfig): { structure: string; refs: string } {
  let structureXml = "";
  let refsXml = "";
  const usedIds = new Map<string, string>(); // ID -> Path のチェック用マップ
  const directoryIds = new Set<string>(); // 遭遇したすべてのディレクトリID
  
  const safeCompanyName = (config.author || "ElectrobunUser").replace(/[^a-zA-Z0-9]/g, ""); 
  const safeAppName = config.name.replace(/[^a-zA-Z0-9]/g, "");

  function processDirectory(currentDir: string, indent: string = "                    "): void {
    if (!existsSync(currentDir)) return;
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      const relPath = relative(sourceDir, fullPath).replace(/\\/g, "/");
      const hash = createHash("sha1").update(relPath).digest("hex");
      const finalId = `f${hash}`;

      if (stat.isDirectory()) {
        const dirId = `dir_${hash}`;
        directoryIds.add(dirId);

        if (usedIds.has(dirId)) {
          throw new Error(`Duplicate ID detected for directory: ${dirId}\nExisting: ${usedIds.get(dirId)}\nNew: ${relPath}`);
        }
        usedIds.set(dirId, relPath);

        structureXml += `${indent}<Directory Id="${dirId}" Name="${item}">\n`;
        processDirectory(fullPath, indent + "    ");
        structureXml += `${indent}</Directory>\n`;
      } else {
        const componentId = `comp_${finalId}`;
        const fileId = `file_${finalId}`;

        if (usedIds.has(componentId)) {
          throw new Error(`Duplicate ID detected for component: ${componentId}\nExisting: ${usedIds.get(componentId)}\nNew: ${relPath}`);
        }
        usedIds.set(componentId, relPath);

        const parentRelPath = relative(sourceDir, currentDir).replace(/\\/g, "/");
        let directoryId: string;
        if (parentRelPath === "" || parentRelPath === ".") {
          directoryId = "INSTALLFOLDER";
        } else {
          const parentHash = createHash("sha1").update(parentRelPath).digest("hex");
          directoryId = `dir_${parentHash}`;
        }

        const componentGuid = uuidv5(`file_${relPath}_${config.id}`, NAMESPACE);
        refsXml += `            <Component Id="${componentId}" Directory="${directoryId}" Guid="${componentGuid}" Win64="yes">\n`;
        refsXml += `                <RegistryValue Root="HKCU" Key="Software\\${safeCompanyName}\\${safeAppName}\\Components" Name="${componentId}" Type="string" Value="" KeyPath="yes" />\n`;
        refsXml += `                <File Id="${fileId}" Source="${escapeXml(fullPath)}" />\n`;
        refsXml += `            </Component>\n`;
      }
    }
  }

  if (!existsSync(sourceDir) || readdirSync(sourceDir).length === 0) {
    console.warn(`Warning: Source directory is empty or missing: ${sourceDir}`);
    return { structure: "", refs: "" };
  }

  processDirectory(sourceDir);

  directoryIds.add("INSTALLFOLDER");
  for (const dirId of directoryIds) {
      const cleanId = `Cleanup_${dirId}`;
      const cleanGuid = uuidv5(`cleanup_${dirId}_${config.id}`, NAMESPACE);
      refsXml += `            <Component Id="${cleanId}" Directory="${dirId}" Guid="${cleanGuid}" Win64="yes">\n`;
      refsXml += `                <RegistryValue Root="HKCU" Key="Software\\${safeCompanyName}\\${safeAppName}\\Cleanup" Name="${dirId}" Type="string" Value="" KeyPath="yes" />\n`;
      refsXml += `                <RemoveFolder Id="RM_${dirId}" On="uninstall" />\n`;
      refsXml += `            </Component>\n`;
  }

  return { structure: structureXml, refs: refsXml };
}
