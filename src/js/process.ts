import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { GeneratorConfig } from "../types/types";
import { logger } from "../utils/logger";
import { isNonEmptyString } from "../utils/type-guards";

export async function processJS(config: GeneratorConfig): Promise<void> {
  if (!config?.distDir || !isNonEmptyString(config.distDir)) {
    throw new Error("Invalid distribution directory in config");
  }

  logger.debug("Processing JavaScript");

  const jsDir = join(config.distDir, "js");

  try {
    await mkdir(jsDir, { recursive: true });
    logger.debug("Created JS distribution directory", { jsDir });
  } catch (error) {
    logger.error("Failed to create JS distribution directory", {
      jsDir,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const sortableLibPath =
    "./node_modules/sortable-tablesort/dist/sortable.min.js";

  try {
    const sortableContent = await readFile(sortableLibPath, "utf-8");

    if (typeof sortableContent !== "string") {
      throw new Error("Sortable library content is not a string");
    }

    const outputPath = join(jsDir, "sortable.min.js");
    await writeFile(outputPath, sortableContent);

    logger.debug("Copied sortable library", {
      sourcePath: sortableLibPath,
      outputPath,
    });
  } catch (error) {
    logger.error("Failed to process sortable library", {
      sortableLibPath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  logger.info("JavaScript processing complete", { jsDir });
}
