import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { loadBooks } from "./load-books.ts";
import type { GeneratorConfig } from "./src/types/types.ts";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const testBooksDir = "test-books-temp";
const testConfig: GeneratorConfig = {
  booksDir: testBooksDir,
  distDir: "test-dist-temp",
  imageSizes: [400, 800],
  imageFormats: ["webp", "jpeg"],
};

describe("loadBooks", () => {
  beforeEach(() => {
    // Clean up and create test directory
    rmSync(testBooksDir, { recursive: true, force: true });
    mkdirSync(testBooksDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testBooksDir, { recursive: true, force: true });
  });

  test("returns empty array when books directory doesn't exist", async () => {
    const config = { ...testConfig, booksDir: "nonexistent-path" };
    const result = await loadBooks(config);
    expect(result).toEqual([]);
  });

  test("loads single book with chapters", async () => {
    // Create test book structure
    const bookDir = join(testBooksDir, "test-book");
    const chaptersDir = join(bookDir, "chapters");
    const chapter1Dir = join(chaptersDir, "chapter-1");

    mkdirSync(chapter1Dir, { recursive: true });

    // Create info.json
    const bookInfo = {
      title: "Test Book",
      author: ["Test Author"],
      published: 2023,
      illustrator: [],
      chapter_index: {
        "chapter-1": "Chapter One"
      }
    };
    writeFileSync(join(bookDir, "info.json"), JSON.stringify(bookInfo));

    // Create chapter markdown
    writeFileSync(join(chapter1Dir, "chapter-1.md"), "# Chapter One\n\nThis is test content.");

    const result = await loadBooks(testConfig);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Book");
    expect(result[0].author).toEqual(["Test Author"]);
    expect(result[0].published).toBe(2023);
    expect(result[0].slug).toBe("test-book");
    expect(result[0].chapters).toHaveLength(1);
    expect(result[0].chapters[0].title).toBe("Chapter One");
    expect(result[0].chapters[0].path).toBe("chapter-1");
  });

  test("loads multiple books", async () => {
    // Create first book
    const book1Dir = join(testBooksDir, "book-1");
    const chapters1Dir = join(book1Dir, "chapters");
    const chapter1_1Dir = join(chapters1Dir, "chapter-1");

    mkdirSync(chapter1_1Dir, { recursive: true });

    const book1Info = {
      title: "Book One",
      author: ["Author One"],
      published: 2021,
      illustrator: [],
      chapter_index: { "chapter-1": "First Chapter" }
    };
    writeFileSync(join(book1Dir, "info.json"), JSON.stringify(book1Info));
    writeFileSync(join(chapter1_1Dir, "chapter-1.md"), "Content 1");

    // Create second book
    const book2Dir = join(testBooksDir, "book-2");
    const chapters2Dir = join(book2Dir, "chapters");
    const chapter2_1Dir = join(chapters2Dir, "intro");

    mkdirSync(chapter2_1Dir, { recursive: true });

    const book2Info = {
      title: "Book Two",
      author: ["Author Two"],
      published: 2022,
      illustrator: [],
      chapter_index: { "intro": "Introduction" }
    };
    writeFileSync(join(book2Dir, "info.json"), JSON.stringify(book2Info));
    writeFileSync(join(chapter2_1Dir, "intro.md"), "Intro content");

    const result = await loadBooks(testConfig);

    expect(result).toHaveLength(2);
    expect(result.map(book => book.name).sort()).toEqual(["Book One", "Book Two"]);
  });

  test("calculates word count for chapters", async () => {
    const bookDir = join(testBooksDir, "word-count-book");
    const chaptersDir = join(bookDir, "chapters");
    const chapterDir = join(chaptersDir, "test-chapter");

    mkdirSync(chapterDir, { recursive: true });

    const bookInfo = {
      title: "Word Count Test",
      author: ["Test Author"],
      published: 2023,
      illustrator: [],
      chapter_index: { "test-chapter": "Test Chapter" }
    };
    writeFileSync(join(bookDir, "info.json"), JSON.stringify(bookInfo));

    // Content with exactly 5 words
    const chapterContent = "This is exactly five words.";
    writeFileSync(join(chapterDir, "test-chapter.md"), chapterContent);

    const result = await loadBooks(testConfig);

    expect(result[0].chapters[0].wordCount).toBe(5);
  });

  test("handles books with multiple authors", async () => {
    const bookDir = join(testBooksDir, "multi-author-book");
    const chaptersDir = join(bookDir, "chapters");
    const chapterDir = join(chaptersDir, "chapter");

    mkdirSync(chapterDir, { recursive: true });

    const bookInfo = {
      title: "Multi Author Book",
      author: ["Author One", "Author Two", "Author Three"],
      published: 2023,
      illustrator: ["Illustrator One"],
      chapter_index: { "chapter": "Single Chapter" }
    };
    writeFileSync(join(bookDir, "info.json"), JSON.stringify(bookInfo));
    writeFileSync(join(chapterDir, "chapter.md"), "Content");

    const result = await loadBooks(testConfig);

    expect(result[0].author).toEqual(["Author One", "Author Two", "Author Three"]);
  });

  test("handles PDF files in chapters", async () => {
    const bookDir = join(testBooksDir, "pdf-book");
    const chaptersDir = join(bookDir, "chapters");
    const chapterDir = join(chaptersDir, "pdf-chapter");

    mkdirSync(chapterDir, { recursive: true });

    const bookInfo = {
      title: "PDF Book",
      author: ["PDF Author"],
      published: 2023,
      illustrator: [],
      chapter_index: { "pdf-chapter": "PDF Chapter" }
    };
    writeFileSync(join(bookDir, "info.json"), JSON.stringify(bookInfo));
    writeFileSync(join(chapterDir, "pdf-chapter.md"), "Chapter content");
    writeFileSync(join(chapterDir, "pdf-chapter.pdf"), "fake pdf content");

    const result = await loadBooks(testConfig);

    expect(result[0].chapters[0].pdfPath).toBe("/pdf-book/pdf-chapter.pdf");
    expect(result[0].chapters[0].pdfSourcePath).toContain("pdf-chapter.pdf");
  });

  test("skips invalid book directories", async () => {
    // Create valid book
    const validBookDir = join(testBooksDir, "valid-book");
    const validChaptersDir = join(validBookDir, "chapters");
    const validChapterDir = join(validChaptersDir, "chapter");

    mkdirSync(validChapterDir, { recursive: true });

    const validBookInfo = {
      title: "Valid Book",
      author: ["Author"],
      published: 2023,
      illustrator: [],
      chapter_index: { "chapter": "Chapter" }
    };
    writeFileSync(join(validBookDir, "info.json"), JSON.stringify(validBookInfo));
    writeFileSync(join(validChapterDir, "chapter.md"), "Content");

    // Create invalid book (missing info.json)
    const invalidBookDir = join(testBooksDir, "invalid-book");
    mkdirSync(invalidBookDir, { recursive: true });

    // Create a file that looks like a book directory but isn't
    writeFileSync(join(testBooksDir, "not-a-directory.txt"), "not a directory");

    const result = await loadBooks(testConfig);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Valid Book");
  });

  test("skips chapters without markdown files", async () => {
    const bookDir = join(testBooksDir, "mixed-chapters-book");
    const chaptersDir = join(bookDir, "chapters");
    
    // Valid chapter with markdown
    const validChapterDir = join(chaptersDir, "valid-chapter");
    mkdirSync(validChapterDir, { recursive: true });
    writeFileSync(join(validChapterDir, "valid-chapter.md"), "Valid content");

    // Invalid chapter without markdown
    const invalidChapterDir = join(chaptersDir, "invalid-chapter");
    mkdirSync(invalidChapterDir, { recursive: true });
    writeFileSync(join(invalidChapterDir, "invalid-chapter.txt"), "Invalid content");

    const bookInfo = {
      title: "Mixed Chapters Book",
      author: ["Author"],
      published: 2023,
      illustrator: [],
      chapter_index: {
        "valid-chapter": "Valid Chapter",
        "invalid-chapter": "Invalid Chapter"
      }
    };
    writeFileSync(join(bookDir, "info.json"), JSON.stringify(bookInfo));

    const result = await loadBooks(testConfig);

    expect(result[0].chapters).toHaveLength(1);
    expect(result[0].chapters[0].title).toBe("Valid Chapter");
  });
});