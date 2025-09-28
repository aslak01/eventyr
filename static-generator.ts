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
import { isNonEmptyString } from "./src/utils/type-guards.ts";

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
  logger.info("Starting static site generation");

  if (!config?.distDir || !isNonEmptyString(config.distDir)) {
    throw new Error("Invalid distribution directory in config");
  }

  try {
    await mkdir(config.distDir, { recursive: true });
    logger.debug("Created distribution directory", { distDir: config.distDir });
  } catch (error) {
    logger.error("Failed to create distribution directory", {
      distDir: config.distDir,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const books = await loadBooks(config);
  if (!Array.isArray(books) || books.length === 0) {
    logger.warn(
      "No books found - site generation will continue with empty content",
    );
    // Continue generation even with no books to create basic structure
  } else {
    logger.info("Loaded books for generation", { bookCount: books.length });
  }

  // Process assets in parallel
  try {
    await Promise.all([processCSS(config), processJS(config)]);
    logger.debug("Asset processing completed");
  } catch (error) {
    logger.error("Failed to process assets", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  let optimizedImages: Map<string, any>;
  try {
    optimizedImages = await optimizeImages(books, config);
    logger.debug("Image optimization completed", {
      imageCount: optimizedImages.size,
    });
  } catch (error) {
    logger.error("Failed to optimize images", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Generate main pages
  try {
    const mainIndexHTML = generateMainIndexHTML(books);
    await writeFile(join(config.distDir, "index.html"), mainIndexHTML);
    logger.debug("Generated main index.html");

    const booksIndexHTML = generateBooksIndexHTML(books, optimizedImages);
    await mkdir(join(config.distDir, "books"), { recursive: true });
    await writeFile(
      join(config.distDir, "books", "index.html"),
      booksIndexHTML,
    );
    logger.debug("Generated books index.html");

    const aboutHTML = generateAboutHTML();
    await mkdir(join(config.distDir, "om"), { recursive: true });
    await writeFile(join(config.distDir, "om", "index.html"), aboutHTML);
    logger.debug("Generated about page");
  } catch (error) {
    logger.error("Failed to generate main pages", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Generate book pages
  for (const book of books) {
    if (!book?.slug || !isNonEmptyString(book.slug)) {
      logger.warn("Skipping book with invalid slug", {
        book: book?.name || "unknown",
      });
      continue;
    }

    try {
      const bookDir = join(config.distDir, book.slug);
      await mkdir(bookDir, { recursive: true });

      const bookIndexHTML = generateBookIndexHTML(book);
      await writeFile(join(bookDir, "index.html"), bookIndexHTML);
      logger.debug("Generated book index", { bookName: book.name });

      // Generate chapter pages
      if (!Array.isArray(book.chapters)) {
        logger.warn("Book has invalid chapters array", { bookName: book.name });
        continue;
      }

      for (const chapter of book.chapters) {
        if (!chapter?.path || !isNonEmptyString(chapter.path)) {
          logger.warn("Skipping chapter with invalid path", {
            bookName: book.name,
            chapterTitle: chapter?.title || "unknown",
          });
          continue;
        }

        try {
          const chapterHTML = generateChapterHTML(
            book,
            chapter,
            optimizedImages,
          );
          await writeFile(join(bookDir, `${chapter.path}.html`), chapterHTML);
          logger.debug("Generated chapter HTML", {
            bookName: book.name,
            chapterPath: chapter.path,
          });

          // Copy PDF if it exists
          if (chapter.pdfPath && chapter.pdfSourcePath) {
            const destPdfPath = join(bookDir, `${chapter.path}.pdf`);
            try {
              await copyFile(chapter.pdfSourcePath, destPdfPath);
              logger.debug("Copied chapter PDF", {
                bookName: book.name,
                chapterPath: chapter.path,
              });
            } catch (error) {
              logger.warn("Could not copy PDF", {
                bookName: book.name,
                chapterPath: chapter.path,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        } catch (error) {
          logger.error("Failed to generate chapter", {
            bookName: book.name,
            chapterPath: chapter.path,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other chapters
        }
      }
    } catch (error) {
      logger.error("Failed to generate book", {
        bookName: book.name,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with other books
    }
  }

  logger.info("Static site generation complete", {
    distDir: config.distDir,
    bookCount: books.length,
  });
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
