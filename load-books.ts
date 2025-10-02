import { join } from "path";
import { readdir, stat } from "fs/promises";
import { readFile } from "fs/promises";

import type {
  BookData,
  BookInfo,
  Chapter,
  ChapterLoadParams,
  GeneratorConfig,
} from "./src/types/types.ts";

import { getWordCount } from "./src/utils/strings.ts";
import { logger } from "./src/utils/logger.ts";
import { isValidBookInfo, isNonEmptyString } from "./src/utils/type-guards.ts";

export async function loadBooks(config: GeneratorConfig): Promise<BookData[]> {
  if (!config?.booksDir) {
    logger.error("Books directory not specified in config");
    return [];
  }

  const booksPath = join(process.cwd(), config.booksDir);

  try {
    logger.debug("Loading books from directory", { booksPath });
    const bookDirs = await readdir(booksPath);

    if (!Array.isArray(bookDirs) || bookDirs.length === 0) {
      logger.info("No book directories found", { booksPath });
      return [];
    }

    const bookPromises = bookDirs.map(
      async (slug): Promise<BookData | null> => {
        if (!isNonEmptyString(slug)) {
          logger.warn("Invalid book directory name", { slug });
          return null;
        }

        try {
          return await loadSingleBook(slug, join(booksPath, slug));
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to load book", { slug, error: errorMessage });
          return null;
        }
      },
    );

    const results = await Promise.allSettled(bookPromises);
    const loadedBooks = results
      .filter(
        (result): result is PromiseFulfilledResult<BookData> =>
          result.status === "fulfilled" && result.value !== null,
      )
      .map((result) => result.value);

    logger.info("Books loaded successfully", {
      totalFound: bookDirs.length,
      totalLoaded: loadedBooks.length,
    });

    return loadedBooks;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn("Books directory not accessible", {
      booksPath,
      error: errorMessage,
    });
    return [];
  }
}

async function loadSingleBook(
  slug: string,
  bookPath: string,
): Promise<BookData | null> {
  if (!isNonEmptyString(slug) || !isNonEmptyString(bookPath)) {
    logger.error("Invalid parameters for loadSingleBook", { slug, bookPath });
    return null;
  }

  try {
    const bookDirStats = await stat(bookPath);
    if (!bookDirStats.isDirectory()) {
      logger.debug("Path is not a directory", { bookPath });
      return null;
    }

    const infoPath = join(bookPath, "info.json");
    let rawInfo: string;

    try {
      rawInfo = await readFile(infoPath, "utf8");
    } catch (error) {
      logger.error("Failed to read info.json", {
        slug,
        infoPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    let info: unknown;
    try {
      info = JSON.parse(rawInfo);
    } catch (error) {
      logger.error("Failed to parse info.json", {
        slug,
        infoPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    if (!isValidBookInfo(info)) {
      logger.error("Invalid book info structure", { slug, infoPath });
      return null;
    }

    const chaptersPath = join(bookPath, "chapters");
    let chapters: string[];

    try {
      chapters = await readdir(chaptersPath);
    } catch (error) {
      logger.error("Failed to read chapters directory", {
        slug,
        chaptersPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    if (!Array.isArray(chapters) || chapters.length === 0) {
      logger.warn("No chapters found for book", { slug, chaptersPath });
      return null;
    }

    return await loadBook(info, slug, bookPath);
  } catch (error) {
    logger.error("Unexpected error loading book", {
      slug,
      bookPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function loadBook(
  info: BookInfo,
  slug: string,
  bookPath: string,
): Promise<BookData> {
  const { title, author, published, chapter_index } = info;
  logger.debug("Loading book", { title, slug });

  if (!Array.isArray(author) || author.length === 0) {
    throw new Error(`Book "${title}" has no authors`);
  }

  if (!chapter_index || typeof chapter_index !== "object") {
    throw new Error(`Book "${title}" has invalid chapter index`);
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
  const chapterEntries = Object.entries(chapter_index);

  if (chapterEntries.length === 0) {
    throw new Error(`No chapters defined for ${title}`);
  }

  const chapterPromises = chapterEntries.map(
    async ([chapterDir, chapterTitle], index): Promise<Chapter | null> => {
      if (!isNonEmptyString(chapterDir) || !isNonEmptyString(chapterTitle)) {
        logger.warn("Invalid chapter entry", {
          chapterDir,
          chapterTitle,
          bookTitle: title,
        });
        return null;
      }

      try {
        return await loadChapter({
          chapterDir,
          chapterTitle,
          order: index,
          chaptersPath,
          bookData,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Error loading chapter", {
          chapterTitle,
          chapterDir,
          bookTitle: title,
          error: errorMessage,
        });
        return null;
      }
    },
  );

  const chapterResults = await Promise.allSettled(chapterPromises);
  const loadedChapters = chapterResults
    .filter(
      (result): result is PromiseFulfilledResult<Chapter> =>
        result.status === "fulfilled" && result.value !== null,
    )
    .map((result) => result.value);

  if (loadedChapters.length === 0) {
    throw new Error(`No valid chapters loaded for book "${title}"`);
  }

  bookData.chapters = loadedChapters;

  logger.debug("Book loaded successfully", {
    title,
    slug,
    chapterCount: loadedChapters.length,
  });

  return bookData;
}

async function loadChapter({
  chapterDir,
  chapterTitle,
  order,
  chaptersPath,
  bookData,
}: ChapterLoadParams): Promise<Chapter | null> {
  if (!isNonEmptyString(chapterDir) || !isNonEmptyString(chapterTitle)) {
    logger.error("Invalid chapter parameters", { chapterDir, chapterTitle });
    return null;
  }

  const dir = join(chaptersPath, chapterDir);

  // Skip hidden directories
  if (chapterDir.startsWith(".")) {
    logger.debug("Skipping hidden directory", { chapterDir });
    return null;
  }

  try {
    const dirStats = await stat(dir);
    if (!dirStats.isDirectory()) {
      logger.debug("Chapter path is not a directory", { dir });
      return null;
    }

    const chapterFiles = await readdir(dir);
    if (!Array.isArray(chapterFiles)) {
      logger.error("Failed to read chapter directory", { dir });
      return null;
    }

    const markdownFiles = chapterFiles.filter(
      (file) => isNonEmptyString(file) && file.endsWith(".md"),
    );
    const pdfFiles = chapterFiles.filter(
      (file) => isNonEmptyString(file) && file.endsWith(".pdf"),
    );

    if (markdownFiles.length === 0) {
      logger.warn("No markdown files found in chapter directory", {
        dir,
        chapterTitle,
        availableFiles: chapterFiles,
      });
      return null;
    }

    const markdownFile = markdownFiles[0];
    if (!markdownFile) {
      logger.error("Markdown file is undefined", { dir, chapterTitle });
      return null;
    }

    const markdownPath = join(dir, markdownFile);
    const pdfFile = pdfFiles.length > 0 ? pdfFiles[0] : undefined;
    const pdfPath = pdfFile ? join(dir, pdfFile) : undefined;

    logger.debug("Loading chapter content", { markdownPath, chapterTitle });

    let fileContent: string;
    try {
      fileContent = await Bun.file(markdownPath).text();
      if (typeof fileContent !== "string") {
        throw new Error("File content is not a string");
      }
    } catch (error) {
      logger.error("Failed to read chapter content", {
        markdownPath,
        chapterTitle,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    const chapter: Chapter = {
      title: chapterTitle,
      content: fileContent,
      path: chapterDir,
      htmlPath: `/${bookData.slug}/${chapterDir}.html`,
      wordCount: getWordCount(fileContent),
      book: bookData.name,
      bookSlug: bookData.slug,
      order,
      pdfPath: pdfPath ? `/${bookData.slug}/${chapterDir}.pdf` : undefined,
      pdfSourcePath: pdfPath,
    };

    logger.debug("Chapter loaded successfully", {
      chapterTitle,
      wordCount: chapter.wordCount,
      hasPdf: !!pdfPath,
    });

    return chapter;
  } catch (error) {
    logger.error("Error loading chapter", {
      chapterDir,
      chapterTitle,
      dir,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
