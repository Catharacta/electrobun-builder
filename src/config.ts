import { join } from "node:path";

export interface ElectrobunConfig {
  name: string;
  version: string;
  author?: string;
  windows?: {
    icon?: string;
    productId?: string;
    installDir?: string;
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
