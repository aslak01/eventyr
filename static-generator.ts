import { join } from "path";
import { mkdir, writeFile, copyFile } from "fs/promises";

import type { BookData, Chapter, GeneratorConfig } from "./src/types/types.ts";

import { optimizeImages } from "./src/image_processing/image-simple.ts";
import { generateMainIndexHTML } from "./src/pages/index-tales.ts";
import { generateBooksIndexHTML } from "./src/pages/index-books.ts";
import { generateBookIndexHTML } from "./src/pages/index-book.ts";
import { generateChapterHTML } from "./src/pages/chapter.ts";
import { generateAboutHTML } from "./src/pages/about.ts";
import { processCSS } from "./src/css/process.ts";
import { processJS } from "./src/js/process.ts";
import { loadBooks } from "./load-books.ts";

const defaultConfig: GeneratorConfig = {
  booksDir: "./src/lib/books",
  distDir: "./dist",
  imageSizes: [200, 400, 800, 1200],
  imageFormats: ["webp", "avif", "jpeg"],
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
  await processJS(config);

  const optimizedImages = await optimizeImages(books, config);

  const mainIndexHTML = generateMainIndexHTML(books);
  await writeFile(join(config.distDir, "index.html"), mainIndexHTML);
  console.log("📄 Generated main index.html");

  const booksIndexHTML = generateBooksIndexHTML(books, optimizedImages);
  await mkdir(join(config.distDir, "books"), { recursive: true });
  await writeFile(join(config.distDir, "books", "index.html"), booksIndexHTML);
  console.log("📄 Generated books index.html");

  const aboutHTML = generateAboutHTML();
  await mkdir(join(config.distDir, "om"), { recursive: true });
  await writeFile(join(config.distDir, "om", "index.html"), aboutHTML);
  console.log("📄 Generated om/index.html");

  for (const book of books) {
    const bookDir = join(config.distDir, book.slug);
    await mkdir(bookDir, { recursive: true });

    const bookIndexHTML = generateBookIndexHTML(book);
    await writeFile(join(bookDir, "index.html"), bookIndexHTML);
    console.log(`📄 Generated ${book.name}/index.html`);

    for (const chapter of Object.values(book.chapters)) {
      const chapterHTML = generateChapterHTML(book, chapter, optimizedImages);
      await writeFile(join(bookDir, `${chapter.path}.html`), chapterHTML);
      console.log(`📄 Generated ${book.name}/${chapter.path}.html`);

      // Copy PDF if it exists
      if (chapter.pdfPath && chapter.pdfSourcePath) {
        const destPdfPath = join(bookDir, `${chapter.path}.pdf`);
        try {
          await copyFile(chapter.pdfSourcePath, destPdfPath);
          console.log(`📄 Copied ${book.name}/${chapter.path}.pdf`);
        } catch (error) {
          console.warn(`⚠️ Could not copy PDF for ${chapter.path}:`, error);
        }
      }
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
