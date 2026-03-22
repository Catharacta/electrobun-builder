import { loadConfig } from "./config";
import { buildNSIS } from "./packagers/nsis";
import { buildWiX } from "./packagers/wix";
import { updateExeResource, getResourceOptionsFromConfig } from "./resource";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const projectRoot = process.cwd();
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  if (command === "help") {
    console.log("使用法: electrobun-builder <command> [options]");
    console.log("コマンド:");
    console.log("  build --target <nsis|wix>  インストーラーをビルドします (デフォルト: nsis)");
    return;
  }

  try {
    const config = await loadConfig(projectRoot);
    
    if (command === "build") {
      const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : "nsis";
      console.log(`ビルドターゲット: ${target}`);

      // dist ディレクトリの作成
      const distDir = join(projectRoot, "dist");
      if (!existsSync(distDir)) mkdirSync(distDir);

      // リソースの更新（本来は本体ビルド後に行うが、ここでは設定からオプション取得のみ）
      const resourceOptions = getResourceOptionsFromConfig(config);
      console.log("バイナリリソース設定を取得しました。");

      if (target === "nsis") {
        console.log("NSIS インストーラーをビルド中...");
        const outputPath = await buildNSIS(config, { projectRoot, outputName: `${config.name}-setup.exe` });
        console.log(`成功: ${outputPath}`);
      } else if (target === "wix") {
        console.log("WiX インストーラーをビルド中...");
        const outputPath = await buildWiX(config, { projectRoot, outputName: `${config.name}.msi` });
        console.log(`成功: ${outputPath}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`エラー: ${error.message}`);
    } else {
      console.error("不明なエラーが発生しました。");
    }
    process.exit(1);
  }
}

main();
