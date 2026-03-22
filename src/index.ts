import { loadConfig } from "./config";
import { buildNSIS } from "./packagers/nsis";
import { buildWiX } from "./packagers/wix";
import { packMsix } from "./packagers/msix";
import { signFile } from "./sign";
import { generateUpdateMetadata } from "./update";
import { updateExeResource, getResourceOptionsFromConfig } from "./resource";
import { checkDependencies } from "./utils/deps";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const projectRoot = process.cwd();
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  if (command === "help") {
    console.log("使用法: electrobun-builder <command> [options]");
    console.log("コマンド:");
    console.log("  build --target <nsis|wix|msix>  インストーラーをビルドします (デフォルト: nsis)");
    console.log("オプション:");
    console.log("  --target <t>       ビルドターゲット (nsis, wix, msix)");
    console.log("  --sign             ビルド後にバイナリに署名します");
    console.log("  --pfx <path>       PFX証明書のパス");
    console.log("  --password <pw>    PFX証明書のパスワード");
    console.log("  --update           自動更新用の latest.json を生成します");
    console.log("  --baseUrl <url>    自動更新用ダウンロードのベースURL");
    return;
  }

  try {
    const config = await loadConfig(projectRoot);
    
    if (command === "build") {
      const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : "nsis";
      const shouldSign = args.includes("--sign");
      const shouldUpdate = args.includes("--update");
      
      // 依存関係のチェック
      await checkDependencies(target, shouldSign);

      console.log(`ビルドターゲット: ${target}`);

      // dist ディレクトリの作成
      const distDir = join(projectRoot, "dist");
      if (!existsSync(distDir)) mkdirSync(distDir);

      let outputPath = "";

      if (target === "nsis") {
        console.log("NSIS インストーラーをビルド中...");
        outputPath = await buildNSIS(config, { projectRoot, outputName: `${config.name}-setup.exe` });
      } else if (target === "wix") {
        console.log("WiX インストーラーをビルド中...");
        outputPath = await buildWiX(config, { projectRoot, outputName: `${config.name}.msi` });
      } else if (target === "msix") {
        console.log("MSIX パッケージをビルド中...");
        // MSIX の場合は作業用ディレクトリを用意
        const tempMsixDir = join(projectRoot, "dist", "msix_tmp");
        if (!existsSync(tempMsixDir)) mkdirSync(tempMsixDir, { recursive: true });
        outputPath = await packMsix(config, tempMsixDir, distDir);
      } else {
        throw new Error(`未知のターゲットです: ${target}`);
      }

      console.log(`ビルド成功: ${outputPath}`);

      // 署名の実行
      if (shouldSign) {
        const pfxPath = args.includes("--pfx") ? args[args.indexOf("--pfx") + 1] : "";
        const password = args.includes("--password") ? args[args.indexOf("--password") + 1] : "";
        
        if (!pfxPath) {
            console.warn("警告: --sign が指定されましたが、--pfx が指定されていません。署名をスキップします。");
        } else {
            await signFile(outputPath, { pfxPath, password });
        }
      }

      // 自動更新メタデータの生成
      if (shouldUpdate) {
        const baseUrl = args.includes("--baseUrl") ? args[args.indexOf("--baseUrl") + 1] : "https://example.com/downloads";
        await generateUpdateMetadata(outputPath, config.version || "1.0.0", baseUrl, distDir);
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
