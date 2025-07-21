import { basename, join } from "path";
import { readdir, stat } from "fs/promises";
import { readFile } from "fs/promises";

import type { BookData, Chapter, GeneratorConfig } from "./src/types/types.ts";

export async function loadBooks(config: GeneratorConfig): Promise<BookData[]> {
  const booksPath = join(process.cwd(), config.booksDir);
  const books: BookData[] = [];

  try {
    try {
      await readdir(booksPath);

      const entries = await readdir(booksPath);

      for (const entry of entries) {
        const bookPath = join(booksPath, entry);

        try {
          const bookDirStats = await stat(bookPath);

          if (bookDirStats.isDirectory()) {
            try {
              const rawInfo = await readFile(
                join(bookPath, "info.json"),
                "utf8",
              );
              const info = JSON.parse(rawInfo);

              const chaptersPath = join(bookPath, "chapters");
              const chapters = await readdir(chaptersPath);

              if (chapters.length > 0) {
                const book = await loadBook(
                  info.title,
                  entry,
                  bookPath,
                  chapters,
                );
                books.push(book);
              }
            } catch {
              console.error(`missing/broken book info.json for ${entry}`);
              continue;
            }
          }
        } catch {
          console.log(`reading book ${entry} failed`);
          continue;
        }
      }

      return books;
    } catch {
      console.log(`📁 Books directory not found: ${booksPath}`);
      return books;
    }
  } catch (error) {
    console.error("Error loading books:", error);
    return books;
  }
}

async function loadBook(
  bookName: string,
  slug: string,
  bookPath: string,
  chapterDirs: string[],
): Promise<BookData> {
  console.log(`📚 Loading book: ${bookName}`);

  const bookData: BookData = {
    name: bookName,
    slug,
    path: bookPath,
    chapters: [],
  };

  const chaptersPath = join(bookPath, "chapters");
  const chapterMds: string[][] = [];

  for (const chapter of chapterDirs) {
    const chapterPath = join(chaptersPath, chapter);
    const chapterFiles = await readdir(chapterPath);
    const markdownFiles = chapterFiles
      .filter((file) => file.endsWith(".md"))
      .map((md) => join(chapterPath, md));
    chapterMds.push(markdownFiles);
  }

  const sortedFiles = chapterMds.flat().sort();

  for (const mdFile of sortedFiles) {
    const chapterName = basename(mdFile, ".md");

    try {
      const fileContent = await Bun.file(mdFile).text();

      const titleMatch = fileContent.match(/^#\s+(.+)/m);
      const title = titleMatch
        ? titleMatch[1]
        : chapterName.replace(/[-_]/g, " ");

      const chapter: Chapter = {
        name: chapterName,
        title: title || "Tittel ikke funnet",
        content: fileContent,
        path: join(chaptersPath, chapterName),
        htmlPath: `/${bookData.slug}/${chapterName}.html`,
        wordCount: getWordCount(fileContent),
        book: bookData.name,
        bookSlug: bookData.slug,
      };

      bookData.chapters.push(chapter);
      console.log(`  📄 Loaded chapter: ${chapterName} -> ${title}`);
    } catch (error) {
      console.error(`Error reading ${mdFile}:`, error);
    }
  }

  return bookData;
}

function getWordCount(chapter: string): number {
  return (
    chapter
      ?.replace(/\n/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)?.length || 0
  );
}
