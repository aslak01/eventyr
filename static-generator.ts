import { basename, join } from "path";
import { marked } from "marked";
import { mkdir, readdir, stat, writeFile } from "fs/promises";

import type { BookData, Chapter, GeneratorConfig } from "./src/types/types.ts";

import { optimizeImages } from "./src/image_processing/image.ts";
import { generateMainIndexHTML } from "./src/components/index-front.ts";
import { generateBookIndexHTML } from "./src/components/index-book.ts";
import { generateChapterHTML } from "./src/components/chapter.ts";
import { processCSS } from "./src/css/process.ts";

marked.setOptions({
  breaks: true,
  gfm: true,
});

const defaultConfig: GeneratorConfig = {
  booksDir: "./src/lib/books",
  distDir: "./dist",
  imageSizes: [400, 800, 1200],
  imageFormats: ["webp", "avif", "jpeg"],
};

function createGenerator(
  config: Partial<GeneratorConfig> = {},
): GeneratorConfig {
  return { ...defaultConfig, ...config };
}

async function loadBooks(config: GeneratorConfig): Promise<BookData[]> {
  const booksPath = join(process.cwd(), config.booksDir);
  const books: BookData[] = [];

  try {
    let exists = false;
    try {
      await readdir(booksPath);
      exists = true;
    } catch {
      console.log(`📁 Books directory not found: ${booksPath}`);
      return books;
    }

    const entries = await readdir(booksPath);

    for (const entry of entries) {
      const bookPath = join(booksPath, entry);

      try {
        const stats = await stat(bookPath);

        if (stats.isDirectory()) {
          const mdFiles = await readdir(bookPath);
          const markdownFiles = mdFiles.filter((file) => file.endsWith(".md"));

          if (markdownFiles.length > 0) {
            const book = await loadBook(entry, bookPath, markdownFiles);
            books.push(book);
          }
        }
      } catch (e) {
        continue;
      }
    }

    return books;
  } catch (error) {
    console.error("Error loading books:", error);
    return books;
  }
}

async function loadBook(
  bookName: string,
  bookPath: string,
  mdFiles: string[],
): Promise<BookData> {
  console.log(`📚 Loading book: ${bookName}`);

  const bookData: BookData = {
    name: bookName,
    path: bookPath,
    chapters: [],
  };

  const sortedFiles = mdFiles.sort();

  for (const mdFile of sortedFiles) {
    const filePath = join(bookPath, mdFile);
    const chapterName = basename(mdFile, ".md");

    try {
      const fileContent = await Bun.file(filePath).text();

      const titleMatch = fileContent.match(/^#\s+(.+)/m);
      const title = titleMatch
        ? titleMatch[1]
        : chapterName.replace(/[-_]/g, " ");

      const chapter: Chapter = {
        name: chapterName,
        title: title || "Tittel ikke funnet",
        content: fileContent,
        path: `/${bookName}/${chapterName}`,
        htmlPath: `/${bookName}/${chapterName}.html`,
      };

      bookData.chapters.push(chapter);
      console.log(`  📄 Loaded chapter: ${chapterName} -> ${title}`);
    } catch (error) {
      console.error(`Error reading ${mdFile}:`, error);
    }
  }

  return bookData;
}

async function generateSite(config: GeneratorConfig): Promise<void> {
  console.log("🚀 Starting static site generation...");

  await mkdir(config.distDir, { recursive: true });

  const books = await loadBooks(config);
  if (books.length === 0) {
    console.log("❌ No books found!");
    return;
  }

  await processCSS(config)

  const optimizedImages = await optimizeImages(books, config);

  const mainIndexHTML = generateMainIndexHTML(books);
  await writeFile(join(config.distDir, "index.html"), mainIndexHTML);
  console.log("📄 Generated main index.html");

  for (const book of books) {
    const bookDir = join(config.distDir, book.name);
    await mkdir(bookDir, { recursive: true });

    const bookIndexHTML = generateBookIndexHTML(book);
    await writeFile(join(bookDir, "index.html"), bookIndexHTML);
    console.log(`📄 Generated ${book.name}/index.html`);

    for (const chapter of book.chapters) {
      const chapterHTML = generateChapterHTML(book, chapter, optimizedImages);
      await writeFile(join(bookDir, `${chapter.name}.html`), chapterHTML);
      console.log(`📄 Generated ${book.name}/${chapter.name}.html`);
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
