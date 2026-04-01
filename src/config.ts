import { join } from "node:path";

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
    // Bun の dynamic import を使用して TypeScript ファイルを読み込む
    const module = await import(configPath);
    const config = module.default || module.config;
    
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
