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
import { logger } from "./src/utils/logger.ts";

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

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function writePage(path: string, html: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, html);
}

async function generateBook(
  book: BookData,
  config: GeneratorConfig,
  optimizedImages: Awaited<ReturnType<typeof optimizeImages>>,
): Promise<void> {
  const bookDir = join(config.distDir, book.slug);
  await writePage(join(bookDir, "index.html"), generateBookIndexHTML(book));
  logger.debug("Generated book index", { bookName: book.name });

  for (const chapter of book.chapters) {
    try {
      await writeFile(
        join(bookDir, `${chapter.path}.html`),
        generateChapterHTML(book, chapter, optimizedImages),
      );
      if (chapter.pdfSourcePath) {
        await copyFile(
          chapter.pdfSourcePath,
          join(bookDir, `${chapter.path}.pdf`),
        );
      }
      logger.debug("Generated chapter", {
        bookName: book.name,
        chapterPath: chapter.path,
      });
    } catch (error) {
      // Keep going so every broken chapter is reported in one build
      logger.error("Failed to generate chapter", {
        bookName: book.name,
        chapterPath: chapter.path,
        error: errorMessage(error),
      });
    }
  }
}

async function generateSite(config: GeneratorConfig): Promise<void> {
  logger.info("Starting static site generation");
  const errorsBefore = logger.errorCount;

  await mkdir(config.distDir, { recursive: true });

  const books = await loadBooks(config);
  if (books.length === 0) {
    logger.warn("No books found - generating site without content");
  }

  await Promise.all([processCSS(config), processJS(config)]);

  const optimizedImages = await optimizeImages(books, config);

  await writePage(
    join(config.distDir, "index.html"),
    generateMainIndexHTML(books),
  );
  await writePage(
    join(config.distDir, "books", "index.html"),
    generateBooksIndexHTML(books, optimizedImages),
  );
  await writePage(
    join(config.distDir, "om", "index.html"),
    generateAboutHTML(),
  );
  logger.debug("Generated main pages");

  for (const book of books) {
    await generateBook(book, config, optimizedImages);
  }

  // Content problems are logged and skipped so they can all be seen at once,
  // but they must still fail the build rather than ship a site missing tales
  const errorCount = logger.errorCount - errorsBefore;
  if (errorCount > 0) {
    throw new Error(`Site generation finished with ${errorCount} error(s)`);
  }

  logger.info("Static site generation complete", {
    distDir: config.distDir,
    bookCount: books.length,
  });
}

async function build(config: Partial<GeneratorConfig> = {}): Promise<void> {
  await generateSite(createGenerator(config));
}

export { build, createGenerator, generateSite };
export type { BookData, Chapter, GeneratorConfig };

if (import.meta.main) {
  try {
    await build();
  } catch (error) {
    logger.error("Build failed", { error: errorMessage(error) });
    process.exit(1);
  }
}
