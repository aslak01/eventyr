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
  
  try {
    const bookDirs = await readdir(booksPath);
    const bookPromises = bookDirs.map(async (slug) => {
      try {
        return await loadSingleBook(slug, join(booksPath, slug));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load book "${slug}":`, message);
        return null;
      }
    });
    
    const results = await Promise.allSettled(bookPromises);
    return results
      .filter((result): result is PromiseFulfilledResult<BookData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  } catch {
    console.log(`📁 Books directory not found: ${booksPath}`);
    return [];
  }
}

async function loadSingleBook(slug: string, bookPath: string): Promise<BookData | null> {
  const bookDirStats = await stat(bookPath);
  if (!bookDirStats.isDirectory()) return null;
  
  const infoPath = join(bookPath, "info.json");
  const rawInfo = await readFile(infoPath, "utf8");
  const info: BookInfo = JSON.parse(rawInfo);
  
  const chaptersPath = join(bookPath, "chapters");
  const chapters = await readdir(chaptersPath);
  
  if (chapters.length === 0) return null;
  
  return await loadBook(info, slug, bookPath);
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
  const chapterEntries = Object.entries(chapter_index);
  if (chapterEntries.length === 0) {
    throw new Error(`No chapters for ${title}`);
  }

  const chapterPromises = chapterEntries.map(async ([chapterDir, chapterTitle], index) => {
    if (!chapterDir || !chapterTitle) return null;
    
    try {
      return await loadChapter({
        chapterDir,
        chapterTitle,
        order: index,
        chaptersPath,
        bookData
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error loading chapter "${chapterTitle}":`, message);
      return null;
    }
  });

  const chapterResults = await Promise.allSettled(chapterPromises);
  const loadedChapters = chapterResults
    .filter((result): result is PromiseFulfilledResult<Chapter> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);

  chapters.push(...loadedChapters);

  bookData.chapters = chapters;

  return bookData;
}

type ChapterLoadParams = {
  chapterDir: string;
  chapterTitle: string;
  order: number;
  chaptersPath: string;
  bookData: BookData;
};

async function loadChapter({ chapterDir, chapterTitle, order, chaptersPath, bookData }: ChapterLoadParams): Promise<Chapter | null> {
  const dir = join(chaptersPath, chapterDir);
  
  if (chapterDir.startsWith(".")) return null;
  
  const dirStats = await stat(dir);
  if (!dirStats.isDirectory()) return null;
  
  const chapterFiles = await readdir(dir);
  const markdownFiles = chapterFiles.filter(file => file.endsWith(".md"));
  const pdfFiles = chapterFiles.filter(file => file.endsWith(".pdf"));
  
  if (markdownFiles.length === 0) return null;
  
  const markdownFile = markdownFiles[0];
  if (!markdownFile) return null;
  
  const markdownPath = join(dir, markdownFile);
  const pdfFile = pdfFiles[0];
  const pdfPath = pdfFile ? join(dir, pdfFile) : undefined;
  
  console.log([markdownPath]);
  
  const fileContent = await Bun.file(markdownPath).text();
  
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
  
  console.log(`  📄 Loaded chapter: ${markdownPath} -> ${chapterTitle}`);
  return chapter;
}
