/**
 * All comments and messages in this library must be in English.
 */
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
  // Keep for backward compatibility or migrate
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
    // jiti allows importing TS files regardless of the runtime (Node.js / Bun).
    // Absolute paths on Windows are also handled transparently.
    const jiti = createJiti(import.meta.url);
    const module = await jiti.import(configPath);
    const config = (module as any).default || (module as any).config;
    
    if (!config) {
      throw new Error("No config exported in electrobun.config.ts.");
    }
    
    return config as ElectrobunConfig;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config file: ${error.message}`);
    }
    throw error;
  }
}
