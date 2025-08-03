import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createGenerator } from "./static-generator.ts";
import type { GeneratorConfig } from "./src/types/types.ts";
import { rmSync } from "fs";

describe("createGenerator", () => {
  test("uses default config when no options provided", () => {
    const config = createGenerator();
    
    expect(config.booksDir).toBe("./src/lib/books");
    expect(config.distDir).toBe("./dist");
    expect(config.imageSizes).toEqual([200, 400, 800, 1200]);
    expect(config.imageFormats).toEqual(["webp", "avif", "jpeg"]);
  });

  test("merges provided config with defaults", () => {
    const customConfig: Partial<GeneratorConfig> = {
      booksDir: "./custom/books",
      imageSizes: [300, 600]
    };

    const config = createGenerator(customConfig);
    
    expect(config.booksDir).toBe("./custom/books");
    expect(config.distDir).toBe("./dist"); // Still uses default
    expect(config.imageSizes).toEqual([300, 600]);
    expect(config.imageFormats).toEqual(["webp", "avif", "jpeg"]); // Still uses default
  });

  test("allows complete config override", () => {
    const customConfig: GeneratorConfig = {
      booksDir: "./my/books",
      distDir: "./my/dist",
      imageSizes: [100, 200],
      imageFormats: ["jpeg"]
    };

    const config = createGenerator(customConfig);
    
    expect(config).toEqual(customConfig);
  });

  test("handles empty config object", () => {
    const config = createGenerator({});
    
    expect(config.booksDir).toBe("./src/lib/books");
    expect(config.distDir).toBe("./dist");
    expect(config.imageSizes).toEqual([200, 400, 800, 1200]);
    expect(config.imageFormats).toEqual(["webp", "avif", "jpeg"]);
  });

  test("preserves image formats order", () => {
    const customConfig: Partial<GeneratorConfig> = {
      imageFormats: ["avif", "webp", "jpeg"]
    };

    const config = createGenerator(customConfig);
    
    expect(config.imageFormats).toEqual(["avif", "webp", "jpeg"]);
  });

  test("handles single image size", () => {
    const customConfig: Partial<GeneratorConfig> = {
      imageSizes: [800]
    };

    const config = createGenerator(customConfig);
    
    expect(config.imageSizes).toEqual([800]);
  });

  test("preserves relative paths", () => {
    const customConfig: Partial<GeneratorConfig> = {
      booksDir: "../books",
      distDir: "../output"
    };

    const config = createGenerator(customConfig);
    
    expect(config.booksDir).toBe("../books");
    expect(config.distDir).toBe("../output");
  });

  test("handles absolute paths", () => {
    const customConfig: Partial<GeneratorConfig> = {
      booksDir: "/absolute/books",
      distDir: "/absolute/dist"
    };

    const config = createGenerator(customConfig);
    
    expect(config.booksDir).toBe("/absolute/books");
    expect(config.distDir).toBe("/absolute/dist");
  });
});