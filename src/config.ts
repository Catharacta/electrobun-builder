import { join } from "node:path";
import { createJiti } from "jiti";

export interface ElectrobunConfig {
  name: string;
  id?: string;
  version: string;
  author?: string;
  publisher?: string;
  build?: {
    bunnyBun?: string;
    win?: {
      icon?: string;
      productId?: string;
      installDir?: string;
      useAsar?: boolean;
      languageCode?: string;
      languageName?: string;
    }
  };
  // 下位互換性のため維持するか、移行するか
  windows?: {
    icon?: string;
    productId?: string;
    installDir?: string;
    useAsar?: boolean;
    languageCode?: string;
    languageName?: string;
    msix?: {
      publisher?: string;
      publisherDisplayName?: string;
      identityName?: string;
      capabilities?: string[];
      extensions?: {
        fileAssociations?: {
          name: string;
          extensions: string[];
        }[];
        protocols?: {
          name: string;
        }[];
      };
    };
  };
  views?: {
    [key: string]: {
      url: string;
    };
  };
}

export async function loadConfig(projectRoot: string): Promise<ElectrobunConfig> {
  const configPath = join(projectRoot, "electrobun.config.ts");
  
  try {
    // jiti を使用してランタイム (Node.js / Bun) を問わず TS ファイルをインポートできるようにします。
    // Windows の絶対パスも透過的に処理されます。
    const jiti = createJiti(import.meta.url);
    const module = await jiti.import(configPath);
    const config = (module as any).default || (module as any).config;
    
    if (!config) {
      throw new Error("electrobun.config.ts で config がエクスポートされていません。");
    }
    
    return config as ElectrobunConfig;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`設定ファイルの読み込みに失敗しました: ${error.message}`);
    }
    throw error;
  }
}
