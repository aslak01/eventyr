import { join } from "path";
import { readdir, stat } from "fs/promises";
import { readFile } from "fs/promises";

import type {
  BookData,
  BookInfo,
  Chapter,
  GeneratorConfig,
} from "./src/types/types.ts";
import { getWordCount } from "./src/utils/strings.ts";

export async function loadBooks(config: GeneratorConfig): Promise<BookData[]> {
  const booksPath = join(process.cwd(), config.booksDir);
  const books: BookData[] = [];

  try {
    try {
      const bookDirs = await readdir(booksPath);

      for (const slug of bookDirs) {
        const bookPath = join(booksPath, slug);

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
                const book = await loadBook(info, slug, bookPath);
                books.push(book);
              }
            } catch (err) {
              console.error(`missing/broken book info.json for ${slug}`);
              console.error(err);
              continue;
            }
          }
        } catch {
          console.log(`reading book ${slug} failed`);
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
  info: BookInfo,
  slug: string,
  bookPath: string,
): Promise<BookData> {
  const { title, author, published, chapter_index } = info;
  console.log(`📚 Loading book: ${title}`);

  const chapters: Chapter[] = [];

  const bookData: BookData = {
    name: title,
    author,
    published,
    slug,
    path: bookPath,
    chapters: [],
  };

  const chaptersPath = join(bookPath, "chapters");
  const chapterMds: {
    markdownURI: string;
    title: string;
    dir: string;
    order: number;
  }[] = [];

  const chapterEntries = Object.entries(chapter_index);

  if (!chapterEntries || chapterEntries.length === 0) {
    throw new Error(`No chapters for ${title}`);
  }

  for (const [order, [chapterDir, title]] of chapterEntries.entries()) {
    if (!chapterDir || !title) {
      continue;
    }
    const dir = join(chaptersPath, chapterDir);
    if (dir.startsWith(".") || !(await stat(dir)).isDirectory()) {
      // skip `.DS_Store` and potential other non chapter things
      continue;
    }
    const chapterFiles = await readdir(dir);

    const markdownFiles = chapterFiles
      .filter((file) => file.endsWith(".md"))
      .map((mdFile) => join(dir, mdFile));
    console.log(markdownFiles);

    if (markdownFiles.length === 0) {
      continue;
    }

    // Take the first markdown file (or implement logic for multiple)
    const markdownURI = markdownFiles[0];

    chapterMds.push({
      markdownURI,
      title,
      dir: chapterDir,
      order: order + 1,
    });
  }

  for (const chap of chapterMds) {
    const { markdownURI, title, dir } = chap;

    try {
      const fileContent = await Bun.file(markdownURI).text();

      const chapter: Chapter = {
        title,
        content: fileContent,
        path: dir,
        htmlPath: `/${bookData.slug}/${dir}.html`,
        wordCount: getWordCount(fileContent),
        book: bookData.name,
        bookSlug: bookData.slug,
      };

      // // const titleMatch = fileContent.match(/^#\s+(.+)/m);
      // // const title = titleMatch
      // //   ? titleMatch[1]
      // //   : chapterName.replace(/[-_]/g, " ");
      if (!chapter) {
        continue;
      }
      // bookData.chapters.push(chapter);
      chapters.push(chapter);
      console.log(`  📄 Loaded chapter: ${markdownURI} -> ${title}`);
    } catch (error) {
      console.error(`Error reading ${title}:`, error);
    }
  }

  bookData.chapters = chapters;

  return bookData;
}
