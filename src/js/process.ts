import { copyFile, mkdir } from "fs/promises";
import { join } from "path";
import type { GeneratorConfig } from "../types/types";
import { logger } from "../utils/logger";

const sortableLibPath =
  "./node_modules/sortable-tablesort/dist/sortable.min.js";

export async function processJS(config: GeneratorConfig): Promise<void> {
  const jsDir = join(config.distDir, "js");
  await mkdir(jsDir, { recursive: true });

  await copyFile(sortableLibPath, join(jsDir, "sortable.min.js"));

  logger.info("JavaScript processing complete", { jsDir });
}
