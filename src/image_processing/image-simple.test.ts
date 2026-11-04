import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  findImages,
  processImage,
  processMarkdownImages,
  optimizeImages,
} from "./image-simple.ts";
import type {
  BookData,
  GeneratorConfig,
  OptimizedImage,
} from "../types/types.ts";
import { writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const testDir = "test-image-processing";
const testConfig: GeneratorConfig = {
  booksDir: testDir,
  distDir: join(testDir, "dist"),
  imageSizes: [200, 400],
  imageFormats: ["webp", "jpeg"],
};

describe("Image Processing", () => {
  beforeEach(() => {
    // Clean up and create test directory
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, "dist"), { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("findImages", () => {
    test("finds images in book root directory", async () => {
      const bookDir = join(testDir, "test-book");
      mkdirSync(bookDir, { recursive: true });

      // Copy test image to book root
      copyFileSync(
        "test-fixtures/test-image-400x300.png",
        join(bookDir, "front.png"),
      );
      copyFileSync(
        "test-fixtures/test-image-800x600.jpg",
        join(bookDir, "cover.jpg"),
      );

      const images = await findImages(bookDir);

      expect(images).toHaveLength(2);
      expect(images.some((path) => path.endsWith("front.png"))).toBe(true);
      expect(images.some((path) => path.endsWith("cover.jpg"))).toBe(true);
    });

    test("finds images in chapter directories", async () => {
      const bookDir = join(testDir, "test-book");
      const chaptersDir = join(bookDir, "chapters");
      const chapter1Dir = join(chaptersDir, "chapter-1");
      const chapter2Dir = join(chaptersDir, "chapter-2");

      mkdirSync(chapter1Dir, { recursive: true });
      mkdirSync(chapter2Dir, { recursive: true });

      // Copy test images to chapters
      copyFileSync(
        "test-fixtures/test-image-400x300.png",
        join(chapter1Dir, "image1.png"),
      );
      copyFileSync(
        "test-fixtures/test-image-800x600.jpg",
        join(chapter2Dir, "image2.jpg"),
      );
      copyFileSync(
        "test-fixtures/test-image.svg",
        join(chapter1Dir, "image.svg"),
      );

      const images = await findImages(bookDir);

      expect(images).toHaveLength(3);
      expect(images.some((path) => path.endsWith("image1.png"))).toBe(true);
      expect(images.some((path) => path.endsWith("image2.jpg"))).toBe(true);
      expect(images.some((path) => path.endsWith("image.svg"))).toBe(true);
    });

    test("handles missing directories gracefully", async () => {
      const nonExistentDir = join(testDir, "nonexistent");
      const images = await findImages(nonExistentDir);
      expect(images).toEqual([]);
    });

    test("filters supported image formats", async () => {
      const bookDir = join(testDir, "test-book");
      const chaptersDir = join(bookDir, "chapters");
      const chapterDir = join(chaptersDir, "chapter");

      mkdirSync(chapterDir, { recursive: true });

      // Create supported and unsupported files
      copyFileSync(
        "test-fixtures/test-image-400x300.png",
        join(chapterDir, "image.png"),
      );
      writeFileSync(join(chapterDir, "text.txt"), "not an image");
      writeFileSync(join(chapterDir, "doc.pdf"), "not an image");

      const images = await findImages(bookDir);

      expect(images).toHaveLength(1);
      expect(images[0]).toContain("image.png");
    });
  });

  describe("processImage", () => {
    test("processes JPEG image with multiple sizes", async () => {
      const imagePath = join(testDir, "test.jpg");
      copyFileSync("test-fixtures/test-image-800x600.jpg", imagePath);

      const result = await processImage(imagePath, "test-book", testConfig);

      expect(result).toBeTruthy();
      expect(result!.originalPath).toBe(imagePath);
      expect(result!.width).toBe(800);
      expect(result!.height).toBe(600);
      expect(result!.sizes).toHaveLength(4); // 2 sizes × 2 formats
      expect(result!.webpPath).toContain(".webp");
    });

    test("processes PNG image", async () => {
      const imagePath = join(testDir, "test.png");
      copyFileSync("test-fixtures/test-image-400x300.png", imagePath);

      const result = await processImage(imagePath, "test-book", testConfig);

      expect(result).toBeTruthy();
      expect(result!.width).toBe(400);
      expect(result!.height).toBe(300);
      expect(result!.sizes.length).toBeGreaterThan(0);
    });

    test("handles SVG files correctly", async () => {
      const imagePath = join(testDir, "test.svg");
      copyFileSync("test-fixtures/test-image.svg", imagePath);

      const result = await processImage(imagePath, "test-book", testConfig);

      expect(result).toBeTruthy();
      expect(result!.webpPath).toBe("");
      expect(result!.avifPath).toBe("");
      expect(result!.sizes).toHaveLength(1);
      expect(result!.sizes[0]!.path).toBe("/images/test-book/test.svg");
      expect(result!.width).toBe(100);
      expect(result!.height).toBe(100);
    });

    test("skips sizes larger than original image", async () => {
      const imagePath = join(testDir, "small.png");
      copyFileSync("test-fixtures/test-image-200x150.gif", imagePath);

      const largeConfig = {
        ...testConfig,
        imageSizes: [100, 300, 500], // 300 and 500 should be skipped for 200px wide image
      };

      const result = await processImage(imagePath, "test-book", largeConfig);

      expect(result).toBeTruthy();
      // Should only process 100px size (not 300 or 500)
      expect(result!.sizes.map((size) => size.width)).toEqual([100, 100]);
    });

    test("emits images narrower than every size at their own width", async () => {
      const imagePath = join(testDir, "tiny.gif");
      copyFileSync("test-fixtures/test-image-200x150.gif", imagePath);

      const result = await processImage(imagePath, "test-book", {
        ...testConfig,
        imageSizes: [400, 800],
      });

      expect(result!.sizes).toEqual([
        { width: 200, path: "/images/test-book/tiny_200w.webp" },
        { width: 200, path: "/images/test-book/tiny_200w.jpeg" },
      ]);
      expect(
        existsSync(join(testConfig.distDir, "images/test-book/tiny_200w.jpeg")),
      ).toBe(true);
    });

    test("returns null for invalid image path", async () => {
      const result = await processImage(
        "nonexistent.jpg",
        "test-book",
        testConfig,
      );
      expect(result).toBeNull();
    });

    test("creates output directory", async () => {
      const imagePath = join(testDir, "test.jpg");
      copyFileSync("test-fixtures/test-image-400x300.png", imagePath);

      await processImage(imagePath, "new-book", testConfig);

      const outputDir = join(testConfig.distDir, "images", "new-book");
      const fs = await import("fs/promises");
      try {
        const stats = await fs.stat(outputDir);
        expect(stats.isDirectory()).toBe(true);
      } catch {
        throw new Error(`Output directory ${outputDir} was not created`);
      }
    });
  });

  describe("processMarkdownImages", () => {
    const createOptimizedImageMap = (): Map<string, OptimizedImage> => {
      const map = new Map<string, OptimizedImage>();
      map.set(join(testDir, "chapter", "test.png"), {
        originalPath: join(testDir, "chapter", "test.png"),
        webpPath: "/images/book/test_400w.webp",
        avifPath: "/images/book/test_400w.avif",
        sizes: [
          { width: 200, path: "/images/book/test_200w.webp" },
          { width: 200, path: "/images/book/test_200w.avif" },
          { width: 200, path: "/images/book/test_200w.jpeg" },
          { width: 400, path: "/images/book/test_400w.webp" },
          { width: 400, path: "/images/book/test_400w.avif" },
          { width: 400, path: "/images/book/test_400w.jpeg" },
        ],
        width: 400,
        height: 300,
      });
      return map;
    };

    test("converts markdown image to picture element", () => {
      const markdown = "Here's an image: ![Alt text](./test.png)";
      const chapterPath = join(testDir, "chapter");
      const optimizedImages = createOptimizedImageMap();

      const result = processMarkdownImages(
        markdown,
        optimizedImages,
        chapterPath,
      );

      expect(result).toContain("<picture>");
      expect(result).toContain("srcset=");
      expect(result).toContain("sizes=");
      expect(result).toContain('alt="Alt text"');
      expect(result).toContain("webp");
      expect(result).toContain("avif");
    });

    test("uses a JPEG as the fallback src with a deduplicated sizes list", () => {
      const result = processMarkdownImages(
        "![Alt](./test.png)",
        createOptimizedImageMap(),
        join(testDir, "chapter"),
      );

      expect(result).toContain('<img src="/images/book/test_200w.jpeg"');
      expect(result).toContain('sizes="(max-width: 400px) 200px, 400px"');
      expect(result).toContain('width="200" height="150"');
    });

    test("escapes alt and title text", () => {
      const result = processMarkdownImages(
        '![Per & Pål <3](./test.png "Høna & hanen")',
        createOptimizedImageMap(),
        join(testDir, "chapter"),
      );

      expect(result).toContain('alt="Per &amp; Pål &lt;3"');
      expect(result).toContain('title="Høna &amp; hanen"');
    });

    test("matches image names regardless of Unicode normalization", () => {
      const nfcName = "kongsg\u00e5rd.png";
      const nfdName = "kongsga\u030ard.png";
      const map = createOptimizedImageMap();
      map.set(
        join(testDir, "chapter", nfcName),
        map.get(join(testDir, "chapter", "test.png"))!,
      );

      const result = processMarkdownImages(
        `![Gården](./${nfdName})`,
        map,
        join(testDir, "chapter"),
      );

      expect(result).toContain("<picture>");
    });

    test("handles image with title attribute", () => {
      const markdown = 'Image with title: ![Alt](./test.png "Image Title")';
      const chapterPath = join(testDir, "chapter");
      const optimizedImages = createOptimizedImageMap();

      const result = processMarkdownImages(
        markdown,
        optimizedImages,
        chapterPath,
      );

      expect(result).toContain('title="Image Title"');
    });

    test("handles SVG images as simple img tags", () => {
      const svgMap = new Map<string, OptimizedImage>();
      svgMap.set(join(testDir, "chapter", "icon.svg"), {
        originalPath: join(testDir, "chapter", "icon.svg"),
        webpPath: "/images/book/icon.svg",
        avifPath: "/images/book/icon.svg",
        sizes: [{ width: 100, path: "/images/book/icon.svg" }],
        width: 100,
        height: 100,
      });

      const markdown = "SVG icon: ![Icon](./icon.svg)";
      const chapterPath = join(testDir, "chapter");

      const result = processMarkdownImages(markdown, svgMap, chapterPath);

      expect(result).toContain("<img");
      expect(result).not.toContain("<picture>");
      expect(result).toContain('width="100"');
      expect(result).toContain('height="100"');
    });

    test("leaves unoptimized images unchanged", () => {
      const markdown = "Unprocessed: ![Alt](./missing.png)";
      const chapterPath = join(testDir, "chapter");
      const optimizedImages = new Map<string, OptimizedImage>();

      const result = processMarkdownImages(
        markdown,
        optimizedImages,
        chapterPath,
      );

      expect(result).toBe(markdown); // Should remain unchanged
    });

    test("processes multiple images in same content", () => {
      const optimizedImages = createOptimizedImageMap();
      optimizedImages.set(join(testDir, "chapter", "image2.png"), {
        originalPath: join(testDir, "chapter", "image2.png"),
        webpPath: "/images/book/image2_200w.webp",
        avifPath: "/images/book/image2_200w.avif",
        sizes: [
          { width: 200, path: "/images/book/image2_200w.webp" },
          { width: 200, path: "/images/book/image2_200w.avif" },
          { width: 200, path: "/images/book/image2_200w.jpeg" },
        ],
        width: 200,
        height: 150,
      });

      const markdown = `
        First image: ![First](./test.png)
        Second image: ![Second](./image2.png)
      `;
      const chapterPath = join(testDir, "chapter");

      const result = processMarkdownImages(
        markdown,
        optimizedImages,
        chapterPath,
      );

      // Should contain two picture elements
      expect((result.match(/<picture>/g) || []).length).toBe(2);
    });
  });

  describe("optimizeImages", () => {
    test("processes images for multiple books", async () => {
      // Create test book structure
      const book1Dir = join(testDir, "book1");
      const book2Dir = join(testDir, "book2");
      mkdirSync(join(book1Dir, "chapters", "ch1"), { recursive: true });
      mkdirSync(join(book2Dir, "chapters", "ch1"), { recursive: true });

      // Add images
      copyFileSync(
        "test-fixtures/test-image-400x300.png",
        join(book1Dir, "front.png"),
      );
      copyFileSync(
        "test-fixtures/test-image-800x600.jpg",
        join(book2Dir, "chapters", "ch1", "image.jpg"),
      );

      const books: BookData[] = [
        {
          name: "Book 1",
          slug: "book1",
          path: book1Dir,
          chapters: [],
          author: ["Author 1"],
          published: 2023,
        },
        {
          name: "Book 2",
          slug: "book2",
          path: book2Dir,
          chapters: [],
          author: ["Author 2"],
          published: 2023,
        },
      ];

      const result = await optimizeImages(books, testConfig);

      expect(result.size).toBeGreaterThan(0);
      expect(
        Array.from(result.keys()).some((key) => key.includes("front.png")),
      ).toBe(true);
      expect(
        Array.from(result.keys()).some((key) => key.includes("image.jpg")),
      ).toBe(true);
    });

    test("uses cache for unchanged images", async () => {
      const bookDir = join(testDir, "cached-book");
      mkdirSync(bookDir, { recursive: true });
      copyFileSync(
        "test-fixtures/test-image-400x300.png",
        join(bookDir, "test.png"),
      );

      const books: BookData[] = [
        {
          name: "Cached Book",
          slug: "cached-book",
          path: bookDir,
          chapters: [],
          author: ["Author"],
          published: 2023,
        },
      ];

      // First run - should process image
      const result1 = await optimizeImages(books, testConfig);
      expect(result1.size).toBe(1);

      // Second run - should use cache (but we can't easily test the console output)
      const result2 = await optimizeImages(books, testConfig);
      expect(result2.size).toBe(1);
    });

    test("handles books with no images", async () => {
      const bookDir = join(testDir, "empty-book");
      mkdirSync(bookDir, { recursive: true });

      const books: BookData[] = [
        {
          name: "Empty Book",
          slug: "empty-book",
          path: bookDir,
          chapters: [],
          author: ["Author"],
          published: 2023,
        },
      ];

      const result = await optimizeImages(books, testConfig);
      expect(result.size).toBe(0);
    });
  });
});
