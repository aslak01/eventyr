import { marked } from "marked";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";

import type { BookData, Chapter, GeneratorConfig } from "./src/types/types.ts";

import { optimizeImages } from "./src/image_processing/image.ts";
import { generateMainIndexHTML } from "./src/pages/index-tales.ts";
import { generateBooksIndexHTML } from "./src/pages/index-books.ts";
import { generateBookIndexHTML } from "./src/pages/index-book.ts";
import { generateChapterHTML } from "./src/pages/chapter.ts";
import { processCSS } from "./src/css/process.ts";
import { loadBooks } from "./load-books.ts";
import { createPathHelper } from "./src/utils/paths.ts";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const defaultConfig: GeneratorConfig = {
  booksDir: "./src/lib/books",
  distDir: "./dist",
  imageSizes: [200, 400, 800, 1200],
  imageFormats: ["webp", "avif", "jpeg"],
  basePath: process.env.NODE_ENV === "production" ? (process.env.BASE_PATH || "") : "",
};

function createGenerator(
  config: Partial<GeneratorConfig> = {},
): GeneratorConfig {
  return { ...defaultConfig, ...config };
}

async function generateSite(config: GeneratorConfig): Promise<void> {
  console.log("🚀 Starting static site generation...");

  await mkdir(config.distDir, { recursive: true });

  const books = await loadBooks(config);
  if (books.length === 0) {
    console.log("❌ No books found!");
    return;
  }

  await processCSS(config);

  const pathHelper = createPathHelper(config.basePath);
  const optimizedImages = await optimizeImages(books, config, pathHelper);

  const mainIndexHTML = generateMainIndexHTML(books, pathHelper);
  await writeFile(join(config.distDir, "index.html"), mainIndexHTML);
  console.log("📄 Generated main index.html");

  const booksIndexHTML = generateBooksIndexHTML(books, optimizedImages, pathHelper);
  await mkdir(join(config.distDir, "books"), { recursive: true });
  await writeFile(join(config.distDir, "books", "index.html"), booksIndexHTML);
  console.log("📄 Generated books index.html");

  for (const book of books) {
    const bookDir = join(config.distDir, book.slug);
    await mkdir(bookDir, { recursive: true });

    const bookIndexHTML = generateBookIndexHTML(book, pathHelper);
    await writeFile(join(bookDir, "index.html"), bookIndexHTML);
    console.log(`📄 Generated ${book.name}/index.html`);

    for (const chapter of Object.values(book.chapters)) {
      const chapterHTML = generateChapterHTML(book, chapter, optimizedImages, pathHelper);
      await writeFile(join(bookDir, `${chapter.path}.html`), chapterHTML);
      console.log(`📄 Generated ${book.name}/${chapter.path}.html`);
    }
  }

  console.log("✅ Static site generation complete!");
  console.log(`📁 Site generated in: ${config.distDir}`);
}

async function build(config: Partial<GeneratorConfig> = {}): Promise<void> {
  const fullConfig = createGenerator(config);
  await generateSite(fullConfig);
}

export { build, createGenerator, generateSite };
export type { BookData, Chapter, GeneratorConfig };

if (import.meta.main) {
  build();
}
