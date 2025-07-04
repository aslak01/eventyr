import type { GeneratorConfig } from '../types/types';
import { readdir, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function processCSS(config: GeneratorConfig): Promise<void> {
  const { transform } = await import('lightningcss');
  const srcCSSDir = join(process.cwd(), 'src/css');
  const distCSSDir = join(config.distDir, 'css');

  try {
    // Check if src/css exists
    await readdir(srcCSSDir);
  } catch {
    console.log("⚠️  No src/css directory found, skipping CSS processing");
    return;
  }

  await mkdir(distCSSDir, { recursive: true });

  // Get all CSS files from src/css
  const cssFiles = await readdir(srcCSSDir);
  const cssFilesToProcess = cssFiles.filter(file => file.endsWith('.css'));

  for (const cssFile of cssFilesToProcess) {
    const srcPath = join(srcCSSDir, cssFile);
    const distPath = join(distCSSDir, cssFile);

    try {
      const cssContent = await Bun.file(srcPath).text();

      // Process with Lightning CSS
      const result = transform({
        filename: cssFile,
        code: Buffer.from(cssContent),
        minify: true,
        targets: {
          // Support modern browsers (last 2 versions)
          chrome: 100 << 16,
          firefox: 100 << 16,
          safari: 15 << 16,
          edge: 100 << 16,
        },
      });

      await writeFile(distPath, result.code);
      console.log(`🎨 Processed CSS: ${cssFile}`);
    } catch (error) {
      console.error(`❌ Error processing ${cssFile}:`, error);
    }
  }
}

