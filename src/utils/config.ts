export interface ServerConfig {
  port: number;
  rebuildDelay: number;
  watchPaths: string[];
  enableLiveReload: boolean;
}

export interface AppConfig {
  server: ServerConfig;
  logging: {
    level: number;
  };
  security: {
    maxPathLength: number;
    allowedFileExtensions: string[];
  };
}

const defaultConfig: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || "3000"),
    rebuildDelay: parseInt(process.env.REBUILD_DELAY || "300"),
    watchPaths: ["./src", "./static-generator.ts", "./load-books.ts"],
    enableLiveReload: process.env.NODE_ENV !== "production",
  },
  logging: {
    level: parseInt(process.env.LOG_LEVEL || "1"), // INFO level
  },
  security: {
    maxPathLength: 1000,
    allowedFileExtensions: [
      ".html",
      ".css",
      ".js",
      ".pdf",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".avif",
    ],
  },
};

export function getConfig(): AppConfig {
  return defaultConfig;
}

export function updateConfig(updates: Partial<AppConfig>): void {
  Object.assign(defaultConfig, updates);
}
