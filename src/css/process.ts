import { transform, browserslistToTargets } from "lightningcss";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import browserslist from "browserslist";
import { join } from "path";

import type { GeneratorConfig } from "../types/types";
import { logger } from "../utils/logger";

export async function processCSS(config: GeneratorConfig): Promise<void> {
  const srcCSSDir = join(process.cwd(), "src/css");
  const distCSSDir = join(config.distDir, "css");

  const targets = browserslistToTargets(browserslist(">= 0.25%"));

  const cssFiles = (await readdir(srcCSSDir)).filter((file) =>
    file.endsWith(".css"),
  );

  await mkdir(distCSSDir, { recursive: true });

  for (const cssFile of cssFiles) {
    const srcPath = join(srcCSSDir, cssFile);

    try {
      const result = transform({
        filename: cssFile,
        code: await readFile(srcPath),
        minify: true,
        targets,
      });
      await writeFile(join(distCSSDir, cssFile), result.code);
      logger.debug("Processed CSS file", { cssFile });
    } catch (error) {
      logger.error("Error processing CSS file", {
        cssFile,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("CSS processing completed", {
    totalFiles: cssFiles.length,
    distCSSDir,
  });
}
