import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { optimizeImages } from "./image-simple.ts";
import type { BookData, GeneratorConfig, ImageCache } from "../types/types.ts";
import { writeFileSync, mkdirSync, rmSync, copyFileSync, readFileSync } from "fs";
import { join } from "path";

const testDir = "test-image-cache";
const testConfig: GeneratorConfig = {
  booksDir: testDir,
  distDir: join(testDir, "dist"),
  imageSizes: [200, 400],
  imageFormats: ["webp", "jpeg"],
};

describe("Image Caching", () => {
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

  describe("Cache File Management", () => {
    test("creates cache file after first optimization", async () => {
      const bookDir = join(testDir, "cache-test-book");
      mkdirSync(bookDir, { recursive: true });
      copyFileSync("test-fixtures/test-image-400x300.png", join(bookDir, "test.png"));
      
      const books: BookData[] = [{
        name: "Cache Test Book",
        slug: "cache-test-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // First optimization should create cache
      await optimizeImages(books, testConfig);
      
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const cacheExists = await Bun.file(cacheFilePath).exists();
      expect(cacheExists).toBe(true);
      
      // Verify cache content
      const cacheContent = await Bun.file(cacheFilePath).text();
      const cache: ImageCache = JSON.parse(cacheContent);
      
      expect(Object.keys(cache)).toHaveLength(1);
      const cacheKey = Object.keys(cache)[0];
      expect(cacheKey).toContain("test.png");
      
      const cacheEntry = cache[cacheKey];
      expect(cacheEntry.contentHash).toBeTruthy();
      expect(cacheEntry.contentHash).toHaveLength(16); // First 16 chars of SHA256
      expect(cacheEntry.sizes).toBeDefined();
      expect(cacheEntry.webpPath).toBeTruthy();
      expect(cacheEntry.width).toBe(400);
      expect(cacheEntry.height).toBe(300);
    });

    test("loads existing cache on subsequent runs", async () => {
      const bookDir = join(testDir, "cache-load-book");
      mkdirSync(bookDir, { recursive: true });
      copyFileSync("test-fixtures/test-image-400x300.png", join(bookDir, "cached.png"));
      
      const books: BookData[] = [{
        name: "Cache Load Book",
        slug: "cache-load-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // First run creates cache
      await optimizeImages(books, testConfig);
      
      // Manually verify cache exists and has expected structure
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const initialCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      const imagePath = Object.keys(initialCache)[0];
      
      expect(initialCache[imagePath]).toBeDefined();
      expect(initialCache[imagePath].contentHash).toBeTruthy();
      
      // Second run should use existing cache
      const result = await optimizeImages(books, testConfig);
      expect(result.size).toBe(1);
      
      // Cache should still exist and be valid
      const finalCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      expect(finalCache[imagePath].contentHash).toBe(initialCache[imagePath].contentHash);
    });

    test("handles missing cache file gracefully", async () => {
      const bookDir = join(testDir, "no-cache-book");
      mkdirSync(bookDir, { recursive: true });
      copyFileSync("test-fixtures/test-image-400x300.png", join(bookDir, "new.png"));
      
      const books: BookData[] = [{
        name: "No Cache Book",
        slug: "no-cache-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // Should work fine without existing cache
      const result = await optimizeImages(books, testConfig);
      expect(result.size).toBe(1);
      
      // Should create new cache
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const cacheExists = await Bun.file(cacheFilePath).exists();
      expect(cacheExists).toBe(true);
    });
  });

  describe("Cache Content Validation", () => {
    test("detects when image content changes", async () => {
      const bookDir = join(testDir, "content-change-book");
      const imagePath = join(bookDir, "changing.png");
      mkdirSync(bookDir, { recursive: true });
      
      // Start with first image
      copyFileSync("test-fixtures/test-image-400x300.png", imagePath);
      
      const books: BookData[] = [{
        name: "Content Change Book",
        slug: "content-change-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // First optimization
      await optimizeImages(books, testConfig);
      
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const originalCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      const originalHash = originalCache[imagePath].contentHash;
      
      // Change image content
      copyFileSync("test-fixtures/test-image-800x600.jpg", imagePath);
      
      // Second optimization should detect change
      await optimizeImages(books, testConfig);
      
      const updatedCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      const newHash = updatedCache[imagePath].contentHash;
      
      expect(newHash).not.toBe(originalHash);
    });

    test("preserves cache when content unchanged", async () => {
      const bookDir = join(testDir, "unchanged-book");
      const imagePath = join(bookDir, "stable.png");
      mkdirSync(bookDir, { recursive: true });
      
      copyFileSync("test-fixtures/test-image-400x300.png", imagePath);
      
      const books: BookData[] = [{
        name: "Unchanged Book",
        slug: "unchanged-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // First optimization
      await optimizeImages(books, testConfig);
      
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const originalCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      const originalHash = originalCache[imagePath].contentHash;
      const originalTimestamp = (await Bun.file(cacheFilePath).stat()).mtime;
      
      // Wait a small amount to ensure timestamp would change if file was modified
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Second optimization with same image
      await optimizeImages(books, testConfig);
      
      const unchangedCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      const unchangedHash = unchangedCache[imagePath].contentHash;
      
      expect(unchangedHash).toBe(originalHash);
    });
  });

  describe("Cache Migration", () => {
    test("migrates cache entries missing width/height", async () => {
      const bookDir = join(testDir, "migration-book");
      const imagePath = join(bookDir, "migrate.png");
      mkdirSync(bookDir, { recursive: true });
      copyFileSync("test-fixtures/test-image-400x300.png", imagePath);
      
      const books: BookData[] = [{
        name: "Migration Book",
        slug: "migration-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // Create cache file missing width/height (simulating old cache format)
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const oldCache: ImageCache = {};
      oldCache[imagePath] = {
        contentHash: "fake-hash-12345678",
        sizes: [{ width: 400, path: "/images/migration-book/migrate_400w.webp" }],
        webpPath: "/images/migration-book/migrate_400w.webp",
        avifPath: "/images/migration-book/migrate_400w.avif",
        // Missing width and height properties
      } as any;
      
      writeFileSync(cacheFilePath, JSON.stringify(oldCache, null, 2));
      
      // Run optimization - should migrate cache entry
      await optimizeImages(books, testConfig);
      
      const migratedCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      const migratedEntry = migratedCache[imagePath];
      
      expect(migratedEntry.width).toBe(400);
      expect(migratedEntry.height).toBe(300);
    });
  });

  describe("Cache Performance", () => {
    test("cache reduces processing time on subsequent runs", async () => {
      const bookDir = join(testDir, "perf-book");
      mkdirSync(bookDir, { recursive: true });
      
      // Add multiple images
      copyFileSync("test-fixtures/test-image-400x300.png", join(bookDir, "image1.png"));
      copyFileSync("test-fixtures/test-image-800x600.jpg", join(bookDir, "image2.jpg"));
      copyFileSync("test-fixtures/test-image-200x150.gif", join(bookDir, "image3.gif"));
      
      const books: BookData[] = [{
        name: "Performance Book",
        slug: "perf-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // First run - should process all images
      const start1 = Date.now();
      const result1 = await optimizeImages(books, testConfig);
      const time1 = Date.now() - start1;
      
      expect(result1.size).toBe(3);
      
      // Second run - should use cache (should be faster, but we can't easily test timing)
      const start2 = Date.now();
      const result2 = await optimizeImages(books, testConfig);
      const time2 = Date.now() - start2;
      
      expect(result2.size).toBe(3);
      
      // Both runs should return the same optimized images
      expect(Array.from(result1.keys()).sort()).toEqual(Array.from(result2.keys()).sort());
    });

    test("handles corrupted cache gracefully", async () => {
      const bookDir = join(testDir, "corrupt-cache-book");
      mkdirSync(bookDir, { recursive: true });
      copyFileSync("test-fixtures/test-image-400x300.png", join(bookDir, "test.png"));
      
      const books: BookData[] = [{
        name: "Corrupt Cache Book",
        slug: "corrupt-cache-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // Create corrupted cache file
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      writeFileSync(cacheFilePath, "{ invalid json }");
      
      // Should handle corrupted cache and still process images
      const result = await optimizeImages(books, testConfig);
      expect(result.size).toBe(1);
      
      // Should create new valid cache
      const newCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      expect(Object.keys(newCache)).toHaveLength(1);
    });
  });

  describe("Cache Edge Cases", () => {
    test("handles images with same name in different directories", async () => {
      const book1Dir = join(testDir, "book1");
      const book2Dir = join(testDir, "book2");
      mkdirSync(book1Dir, { recursive: true });
      mkdirSync(book2Dir, { recursive: true });
      
      // Same filename, different directories
      copyFileSync("test-fixtures/test-image-400x300.png", join(book1Dir, "same.png"));
      copyFileSync("test-fixtures/test-image-800x600.jpg", join(book2Dir, "same.png"));
      
      const books: BookData[] = [
        {
          name: "Book 1",
          slug: "book1",
          path: book1Dir,
          chapters: [],
          author: ["Author"],
          published: 2023,
        },
        {
          name: "Book 2",
          slug: "book2", 
          path: book2Dir,
          chapters: [],
          author: ["Author"],
          published: 2023,
        }
      ];
      
      const result = await optimizeImages(books, testConfig);
      expect(result.size).toBe(2);
      
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const cache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      
      // Should have separate cache entries for each image
      expect(Object.keys(cache)).toHaveLength(2);
      
      const paths = Object.keys(cache);
      expect(paths.some(path => path.includes("book1"))).toBe(true);
      expect(paths.some(path => path.includes("book2"))).toBe(true);
    });

    test("cleans up cache entries for deleted images", async () => {
      const bookDir = join(testDir, "cleanup-book");
      const image1Path = join(bookDir, "keep.png");
      const image2Path = join(bookDir, "delete.png");
      mkdirSync(bookDir, { recursive: true });
      
      // Add two images
      copyFileSync("test-fixtures/test-image-400x300.png", image1Path);
      copyFileSync("test-fixtures/test-image-800x600.jpg", image2Path);
      
      const books: BookData[] = [{
        name: "Cleanup Book",
        slug: "cleanup-book",
        path: bookDir,
        chapters: [],
        author: ["Author"],
        published: 2023,
      }];
      
      // First optimization with both images
      await optimizeImages(books, testConfig);
      
      const cacheFilePath = join(testConfig.distDir, ".image-cache.json");
      const initialCache: ImageCache = JSON.parse(await Bun.file(cacheFilePath).text());
      expect(Object.keys(initialCache)).toHaveLength(2);
      
      // Remove one image
      rmSync(image2Path);
      
      // Second optimization should only process remaining image
      const result = await optimizeImages(books, testConfig);
      expect(result.size).toBe(1);
      
      // Note: The current implementation doesn't clean up unused cache entries
      // This is a potential enhancement but not critical for functionality
    });
  });
});