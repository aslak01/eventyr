import { transform, browserslistToTargets } from "lightningcss";
import { readdir, writeFile, mkdir } from "fs/promises";
import browserslist from "browserslist";
import { join } from "path";

import type { GeneratorConfig } from "../types/types";

export async function processCSS(config: GeneratorConfig): Promise<void> {
  const srcCSSDir = join(process.cwd(), "src/css");
  const distCSSDir = join(config.distDir, "css");
  const targets = browserslistToTargets(browserslist(">= 0.25%"));

  try {
    await readdir(srcCSSDir);
  } catch {
    console.log("⚠️  No src/css directory found, skipping CSS processing");
    return;
  }

  await mkdir(distCSSDir, { recursive: true });

  const cssFiles = await readdir(srcCSSDir);
  const cssFilesToProcess = cssFiles.filter((file) => file.endsWith(".css"));

  for (const cssFile of cssFilesToProcess) {
    const srcPath = join(srcCSSDir, cssFile);
    const distPath = join(distCSSDir, cssFile);

    try {
      const cssContent = await Bun.file(srcPath).text();

      const result = transform({
        filename: cssFile,
        code: Buffer.from(cssContent),
        minify: true,
        targets,
      });

      await writeFile(distPath, result.code);
      console.log(`🎨 Processed CSS: ${cssFile}`);
    } catch (error) {
      console.error(`❌ Error processing ${cssFile}:`, error);
    }
  }
}
