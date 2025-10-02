import { transform, browserslistToTargets } from "lightningcss";
import { readdir, writeFile, mkdir } from "fs/promises";
import browserslist from "browserslist";
import { join } from "path";

import type { GeneratorConfig } from "../types/types";
import { logger } from "../utils/logger";
import { isNonEmptyString } from "../utils/type-guards";

export async function processCSS(config: GeneratorConfig): Promise<void> {
  if (!config?.distDir || !isNonEmptyString(config.distDir)) {
    throw new Error("Invalid distribution directory in config");
  }

  const srcCSSDir = join(process.cwd(), "src/css");
  const distCSSDir = join(config.distDir, "css");

  let targets;
  try {
    targets = browserslistToTargets(browserslist(">= 0.25%"));
  } catch (error) {
    logger.warn("Failed to get browser targets, using defaults", {
      error: error instanceof Error ? error.message : String(error),
    });
    targets = browserslistToTargets(browserslist("defaults"));
  }

  let cssFiles: string[];
  try {
    cssFiles = await readdir(srcCSSDir);
  } catch (error) {
    logger.info("No src/css directory found, skipping CSS processing", {
      srcCSSDir,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (!Array.isArray(cssFiles)) {
    logger.error("Failed to read CSS directory contents");
    return;
  }

  try {
    await mkdir(distCSSDir, { recursive: true });
    logger.debug("Created CSS distribution directory", { distCSSDir });
  } catch (error) {
    logger.error("Failed to create CSS distribution directory", {
      distCSSDir,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const cssFilesToProcess = cssFiles.filter(
    (file) => isNonEmptyString(file) && file.endsWith(".css"),
  );

  if (cssFilesToProcess.length === 0) {
    logger.info("No CSS files found to process", { srcCSSDir });
    return;
  }

  logger.debug("Processing CSS files", { fileCount: cssFilesToProcess.length });

  for (const cssFile of cssFilesToProcess) {
    const srcPath = join(srcCSSDir, cssFile);
    const distPath = join(distCSSDir, cssFile);

    try {
      const cssContent = await Bun.file(srcPath).text();

      if (typeof cssContent !== "string") {
        logger.error("CSS file content is not a string", { cssFile, srcPath });
        continue;
      }

      const result = transform({
        filename: cssFile,
        code: Buffer.from(cssContent),
        minify: true,
        targets,
      });

      await writeFile(distPath, result.code);
      logger.debug("Processed CSS file", { cssFile, srcPath, distPath });
    } catch (error) {
      logger.error("Error processing CSS file", {
        cssFile,
        srcPath,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue processing other files
    }
  }

  logger.info("CSS processing completed", {
    totalFiles: cssFilesToProcess.length,
    distCSSDir,
  });
}
