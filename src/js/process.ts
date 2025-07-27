import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { GeneratorConfig } from "../types/types";

export async function processJS(config: GeneratorConfig): Promise<void> {
  console.log("📦 Processing JavaScript...");
  
  const jsDir = join(config.distDir, "js");
  await mkdir(jsDir, { recursive: true });

  // Read the sortable library from node_modules
  const sortableLibPath = "./node_modules/sortable-tablesort/dist/sortable.min.js";
  const sortableContent = await readFile(sortableLibPath, "utf-8");
  
  // Write to dist/js
  const outputPath = join(jsDir, "sortable.min.js");
  await writeFile(outputPath, sortableContent);
  
  console.log("✅ JavaScript processing complete!");
}