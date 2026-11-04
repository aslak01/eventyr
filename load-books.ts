import { join } from "path";
import { readdir, readFile, stat } from "fs/promises";

import type {
  BookData,
  BookInfo,
  Chapter,
  ChapterLoadParams,
  GeneratorConfig,
} from "./src/types/types.ts";

import { getWordCount } from "./src/utils/strings.ts";
import { logger } from "./src/utils/logger.ts";
import { isValidBookInfo } from "./src/utils/type-guards.ts";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function loadBooks(config: GeneratorConfig): Promise<BookData[]> {
  const booksPath = join(process.cwd(), config.booksDir);

  let bookDirs: string[];
  try {
    bookDirs = await readdir(booksPath);
  } catch (error) {
    logger.warn("Books directory not accessible", {
      booksPath,
      error: errorMessage(error),
    });
    return [];
  }

  const results = await Promise.all(
    bookDirs.sort().map(async (slug) => {
      try {
        return await loadSingleBook(slug, join(booksPath, slug));
      } catch (error) {
        logger.error("Failed to load book", {
          slug,
          error: errorMessage(error),
        });
        return null;
      }
    }),
  );
  const loadedBooks = results.filter((book): book is BookData => book !== null);

  logger.info("Books loaded successfully", {
    totalFound: bookDirs.length,
    totalLoaded: loadedBooks.length,
  });

  return loadedBooks;
}

async function loadSingleBook(
  slug: string,
  bookPath: string,
): Promise<BookData | null> {
  if (slug.startsWith(".") || !(await isDirectory(bookPath))) return null;

  // A book without a chapters directory has not been digitised yet
  if (!(await isDirectory(join(bookPath, "chapters")))) {
    logger.info("Skipping unpublished book (no chapters directory)", { slug });
    return null;
  }

  const infoPath = join(bookPath, "info.json");
  let info: unknown;
  try {
    info = JSON.parse(await readFile(infoPath, "utf8"));
  } catch (error) {
    logger.error("Failed to read info.json", {
      slug,
      infoPath,
      error: errorMessage(error),
    });
    return null;
  }

  if (!isValidBookInfo(info)) {
    logger.error("Invalid book info structure", { slug, infoPath });
    return null;
  }

  return loadBook(info, slug, bookPath);
}

async function loadBook(
  info: BookInfo,
  slug: string,
  bookPath: string,
): Promise<BookData> {
  const { title, author, published, chapter_index } = info;
  logger.debug("Loading book", { title, slug });

  if (author.length === 0) {
    throw new Error(`Book "${title}" has no authors`);
  }

  const bookData: BookData = {
    name: title,
    author,
    published,
    slug,
    path: bookPath,
    chapters: [],
  };

  const chaptersPath = join(bookPath, "chapters");

  const results = await Promise.all(
    Object.entries(chapter_index).map(async ([chapterDir, chapterEntry]) => {
      const chapterTitle =
        typeof chapterEntry === "string" ? chapterEntry : chapterEntry.title;
      const ageRating =
        typeof chapterEntry === "object" ? chapterEntry.ageRating : undefined;

      try {
        return await loadChapter({
          chapterDir,
          chapterTitle,
          chaptersPath,
          bookData,
          ageRating,
        });
      } catch (error) {
        logger.error("Error loading chapter", {
          chapterTitle,
          chapterDir,
          bookTitle: title,
          error: errorMessage(error),
        });
        return null;
      }
    }),
  );

  // Number chapters by their position among the chapters that actually loaded,
  // so prev/next navigation stays correct when an entry is skipped
  bookData.chapters = results
    .filter((chapter): chapter is Chapter => chapter !== null)
    .map((chapter, order) => ({ ...chapter, order }));

  if (bookData.chapters.length === 0) {
    throw new Error(`No valid chapters loaded for book "${title}"`);
  }

  logger.debug("Book loaded successfully", {
    title,
    slug,
    chapterCount: bookData.chapters.length,
  });

  return bookData;
}

async function loadChapter({
  chapterDir,
  chapterTitle,
  chaptersPath,
  bookData,
  ageRating,
}: ChapterLoadParams): Promise<Chapter | null> {
  const dir = join(chaptersPath, chapterDir);

  if (!(await isDirectory(dir))) {
    logger.error("Chapter directory not found", {
      dir,
      chapterTitle,
      bookTitle: bookData.name,
    });
    return null;
  }

  // Sort so the chosen file doesn't depend on filesystem ordering
  const chapterFiles = (await readdir(dir)).sort();
  const markdownFiles = chapterFiles.filter((file) => file.endsWith(".md"));
  const pdfFile = chapterFiles.find((file) => file.endsWith(".pdf"));

  const markdownFile = markdownFiles[0];
  if (!markdownFile) {
    logger.error("No markdown files found in chapter directory", {
      dir,
      chapterTitle,
      availableFiles: chapterFiles,
    });
    return null;
  }
  if (markdownFiles.length > 1) {
    logger.warn("Multiple markdown files in chapter directory, using first", {
      dir,
      using: markdownFile,
      markdownFiles,
    });
  }

  const content = await readFile(join(dir, markdownFile), "utf8");
  const pdfSourcePath = pdfFile ? join(dir, pdfFile) : undefined;

  return {
    title: chapterTitle,
    content,
    path: chapterDir,
    htmlPath: `/${bookData.slug}/${chapterDir}.html`,
    wordCount: getWordCount(content),
    book: bookData.name,
    bookSlug: bookData.slug,
    order: 0, // Assigned by loadBook once all chapters have loaded
    pdfPath: pdfSourcePath ? `/${bookData.slug}/${chapterDir}.pdf` : undefined,
    pdfSourcePath,
    ageRating,
  };
}
