import { join, extname, basename } from "path";
import { readdir, mkdir, copyFile, stat } from "fs/promises";
import { createHash } from "crypto";
import sharp from "sharp";

import type {
  BookData,
  GeneratorConfig,
  OptimizedImage,
  ImageCache,
} from "../types/types";
import { writeFile } from "fs/promises";

// Get content hash of image file - reliable across all environments
async function getContentHash(filePath: string): Promise<string | null> {
  try {
    const fileBuffer = await Bun.file(filePath).arrayBuffer();
    const hash = createHash("sha256")
      .update(new Uint8Array(fileBuffer))
      .digest("hex");
    return hash.substring(0, 16); // Use first 16 chars for brevity
  } catch (error) {
    console.log(`  ⚠️ Content hash failed for ${basename(filePath)}: ${error}`);
    return null;
  }
}

// Check if image needs processing based on content hash
async function needsProcessing(
  imagePath: string,
  cache: ImageCache,
): Promise<boolean> {
  const cacheKey = imagePath;
  const cachedData = cache[cacheKey];

  // If not in cache, needs processing
  if (!cachedData) {
    console.log(`  🆕 New image: ${basename(imagePath)}`);
    return true;
  }

  try {
    // Get current content hash
    const currentContentHash = await getContentHash(imagePath);
    if (!currentContentHash) {
      console.log(`  ❌ Could not hash ${basename(imagePath)}, reprocessing`);
      return true;
    }

    // Compare content hashes
    if (currentContentHash === cachedData.contentHash) {
      // Content unchanged, verify cached files exist
      const fileChecks = [
        cachedData.webpPath
          ? checkFileExists(cachedData.webpPath)
          : Promise.resolve(false),
        cachedData.avifPath
          ? checkFileExists(cachedData.avifPath)
          : Promise.resolve(false),
        ...cachedData.sizes.map((size) => checkFileExists(size.path)),
      ];

      const results = await Promise.all(fileChecks);
      const hasValidCache = results.some((exists) => exists);

      if (hasValidCache) {
        console.log(`  💾 Cached: ${basename(imagePath)}`);
        return false;
      } else {
        console.log(
          `  🔄 Cache files missing for ${basename(imagePath)}, regenerating...`,
        );
        return true;
      }
    } else {
      console.log(
        `  🔄 Content changed for ${basename(imagePath)}, reprocessing`,
      );
      return true;
    }
  } catch (error) {
    console.log(
      `  ❌ Error checking cache for ${basename(imagePath)}: ${error}`,
    );
    return true;
  }
}

// Helper function to check if a file exists
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    // Convert web path back to filesystem path for checking
    // The filePath comes from cache and starts with /images/ or /eventyr/images/
    let fsPath: string;
    if (filePath.startsWith("/images/")) {
      // Local development path: /images/book/file.webp -> dist/images/book/file.webp
      fsPath = join("./dist", filePath);
    } else if (filePath.includes("/images/")) {
      // Production path: /eventyr/images/book/file.webp -> dist/images/book/file.webp
      const imagePart = filePath.substring(filePath.indexOf("/images/"));
      fsPath = join("./dist", imagePart);
    } else {
      return false;
    }

    await stat(fsPath);
    return true;
  } catch {
    return false;
  }
}

// Simple GitHub Actions cache key: just use images hash
export async function generateCacheKey(): Promise<string> {
  try {
    // Get hash of all image files for cache key
    const { execSync } = await import("child_process");
    const imageHash = execSync(
      'find src/lib/books -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.svg" -o -name "*.webp" | sort | xargs cat | sha256sum | cut -d" " -f1',
      {
        encoding: "utf8",
        cwd: process.cwd(),
      },
    ).trim();
    return `image-cache-content-${imageHash.substring(0, 16)}`;
  } catch {
    // Fallback to timestamp if command fails
    return `image-cache-content-${Date.now()}`;
  }
}

export async function optimizeImages(
  books: BookData[],
  config: GeneratorConfig,
): Promise<Map<string, OptimizedImage>> {
  const optimizedImages = new Map<string, OptimizedImage>();
  const cache = await loadImageCache(config);
  let cacheUpdated = false;

  console.log("🖼️  Optimizing images...");
  console.log(`📊 Cache loaded with ${Object.keys(cache).length} entries`);

  for (const book of books) {
    const imageFiles = await findImages(book.path);

    for (const imagePath of imageFiles) {
      const needsUpdate = await needsProcessing(imagePath, cache);

      if (needsUpdate) {
        const optimized = await processImage(imagePath, book.slug, config);
        if (optimized) {
          optimizedImages.set(imagePath, optimized);

          // Update cache with content hash
          const contentHash = await getContentHash(imagePath);
          if (contentHash) {
            cache[imagePath] = {
              contentHash,
              sizes: optimized.sizes,
              webpPath: optimized.webpPath,
              avifPath: optimized.avifPath,
              width: optimized.width,
              height: optimized.height,
            };
            cacheUpdated = true;
          }

          console.log(`  ✨ Optimized: ${basename(imagePath)}`);
        }
      } else {
        // Use cached data
        const cachedData = cache[imagePath];

        if (!cachedData) {
          throw new Error(
            "weird state achieved, thought there were cached images but didn't find any",
          );
        }

        // Check if cache entry needs migration (missing width/height)
        let width = cachedData.width;
        let height = cachedData.height;

        if (width === undefined || height === undefined) {
          // Cache entry needs migration - get dimensions from original image
          try {
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            width = metadata.width || 0;
            height = metadata.height || 0;

            // Update cache entry with dimensions
            cache[imagePath] = {
              ...cachedData,
              width,
              height,
            };
            cacheUpdated = true;
            console.log(
              `  ✅ Migrated ${basename(imagePath)}: ${width}x${height}`,
            );
          } catch (error) {
            console.warn(
              `  ⚠️ Could not get dimensions for ${basename(imagePath)}:`,
              error,
            );
            width = 0;
            height = 0;
          }
        } else {
          console.log(`  💾 Using cached: ${basename(imagePath)}`);
        }

        optimizedImages.set(imagePath, {
          originalPath: imagePath,
          webpPath: cachedData.webpPath,
          avifPath: cachedData.avifPath,
          sizes: cachedData.sizes,
          width,
          height,
        });
      }
    }
  }

  // Save cache if updated
  console.log(
    `🔧 Debug: cacheUpdated=${cacheUpdated}, cache entries: ${Object.keys(cache).length}`,
  );
  if (cacheUpdated) {
    await saveImageCache(config, cache);
    console.log("💾 Updated image cache");
  } else {
    console.log("⚠️ Cache not updated - no changes made");
  }

  return optimizedImages;
}

// Rest of the functions remain the same...
export async function findImages(bookPath: string): Promise<string[]> {
  const imageFiles: string[] = [];

  try {
    // First, check for images in the book root directory (like front.png)
    try {
      const rootFiles = await readdir(bookPath);
      for (const file of rootFiles) {
        const ext = extname(file).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) {
          imageFiles.push(join(bookPath, file));
        }
      }
    } catch (error) {
      console.error(`Error reading book root ${bookPath}:`, error);
    }

    // Then, check for images in chapter directories
    const chaptersPath = join(bookPath, "chapters");
    try {
      const chapters = await readdir(chaptersPath);

      for (const chapter of chapters) {
        const chapterPath = join(chaptersPath, chapter);

        try {
          const chapterStat = await stat(chapterPath);
          if (chapterStat.isDirectory()) {
            const files = await readdir(chapterPath);

            for (const file of files) {
              const ext = extname(file).toLowerCase();
              if (
                [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)
              ) {
                imageFiles.push(join(chapterPath, file));
              }
            }
          }
        } catch (error) {
          console.error(`Error reading chapter ${chapter}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error reading chapters directory ${chaptersPath}:`, error);
    }
  } catch (error) {
    console.error(`Error finding images in ${bookPath}:`, error);
  }

  return imageFiles;
}

export async function processImage(
  imagePath: string,
  bookSlug: string,
  config: GeneratorConfig,
): Promise<OptimizedImage | null> {
  const ext = extname(imagePath).toLowerCase();
  const baseName = basename(imagePath, ext);
  const outputDir = join(config.distDir, "images", bookSlug);

  try {
    await mkdir(outputDir, { recursive: true });

    if (ext === ".svg") {
      const svgPath = join(outputDir, basename(imagePath));
      await copyFile(imagePath, svgPath);

      // For SVG files, we need to get dimensions from the file or use defaults
      let width = 0;
      let height = 0;
      try {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;
      } catch (error) {
        console.warn(
          `Could not get SVG dimensions for ${basename(imagePath)}:`,
          error,
        );
      }

      return {
        originalPath: imagePath,
        webpPath: svgPath,
        avifPath: svgPath,
        sizes: [
          {
            width,
            path: `/images/${bookSlug}/${basename(imagePath)}`,
          },
        ],
        width,
        height,
      };
    }

    const image = sharp(imagePath);
    const metadata = await image.metadata();

    const optimized: OptimizedImage = {
      originalPath: imagePath,
      webpPath: "",
      avifPath: "",
      sizes: [],
      width: metadata.width || 0,
      height: metadata.height || 0,
    };

    for (const size of config.imageSizes) {
      if (!metadata.width || size > metadata.width) continue;

      for (const format of config.imageFormats) {
        const fileName = `${baseName}_${size}w.${format}`;
        const outputPath = join(outputDir, fileName);

        await image
          .resize(size, null, { withoutEnlargement: true })
          .toFormat(format, { quality: 85 })
          .toFile(outputPath);

        const webPath = `/images/${bookSlug}/${fileName}`;
        optimized.sizes.push({ width: size, path: webPath });

        if (format === "webp" && !optimized.webpPath) {
          optimized.webpPath = webPath;
        }
        if (format === "avif" && !optimized.avifPath) {
          optimized.avifPath = webPath;
        }
      }
    }

    return optimized;
  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error);
    return null;
  }
}

export function processMarkdownImages(
  content: string,
  optimizedImages: Map<string, OptimizedImage>,
  chapterPath: string,
): string {
  return content.replace(
    /!\[([^\]]*)\]\(\.\/(.*?\.(png|jpg|jpeg|gif|svg|webp))\s*(?:"([^"]*)")?\)/gi,
    (match, alt, imagePath, ext, title) => {
      const fullImagePath = join(chapterPath, imagePath);
      const optimized = optimizedImages.get(fullImagePath);
      if (
        !optimized ||
        optimized?.sizes?.length < 1 ||
        !optimized?.sizes[0]?.path
      ) {
        console.warn(`No optimized image found for: ${imagePath}`);
        return match;
      }
      if (ext.toLowerCase() === "svg") {
        return `<img src="${optimized.sizes[0].path}" alt="${alt}"${title ? ` title="${title}"` : ""} width="${optimized.sizes[0].width || optimized.width}" height="${optimized.sizes[0].width ? Math.round((optimized.sizes[0].width * optimized.height) / optimized.width) : optimized.height}" />`;
      }

      // Get all available widths and sort them
      const availableWidths = optimized.sizes
        .map((s) => s.width)
        .filter((w) => w > 0)
        .sort((a, b) => a - b);

      // Generate dynamic sizes attribute based on actual image dimensions
      const generateSizes = (widths: number[]): string => {
        if (widths.length === 1) {
          return `${widths[0]}px`;
        }

        // Create breakpoints based on available widths
        const breakpoints = widths.slice(0, -1).map((width, index) => {
          const nextWidth = widths[index + 1];
          if (!nextWidth) {
            return `${width}px`;
          }
          const breakpoint = Math.min(width * 2, nextWidth); // Use 2x the current width or next width, whichever is smaller
          return `(max-width: ${breakpoint}px) ${width}px`;
        });

        // Add the largest size as the default
        breakpoints.push(`${widths[widths.length - 1]}px`);

        return breakpoints.join(", ");
      };

      const sizesAttribute = generateSizes(availableWidths);

      const webpSources = optimized.sizes
        .filter((s) => s.path.includes(".webp"))
        .map((s) => `${s.path} ${s.width}w`)
        .join(", ");
      const avifSources = optimized.sizes
        .filter((s) => s.path.includes(".avif"))
        .map((s) => `${s.path} ${s.width}w`)
        .join(", ");
      const jpegSources = optimized.sizes
        .filter((s) => s.path.includes(".jpeg"))
        .map((s) => `${s.path} ${s.width}w`)
        .join(", ");

      return `<picture>
        ${avifSources ? `<source srcset="${avifSources}" type="image/avif" sizes="${sizesAttribute}" />` : ""}
        ${webpSources ? `<source srcset="${webpSources}" type="image/webp" sizes="${sizesAttribute}" />` : ""}
        <img src="${optimized.sizes[0].path}" srcset="${jpegSources}" alt="${alt}"${title ? ` title="${title}"` : ""} sizes="${sizesAttribute}" width="${optimized.sizes[0].width}" height="${Math.round((optimized.sizes[0].width * optimized.height) / optimized.width)}" />
      </picture>`;
    },
  );
}

async function loadImageCache(config: GeneratorConfig): Promise<ImageCache> {
  const cacheFile = join(config.distDir, ".image-cache.json");

  try {
    // Ensure dist directory exists before trying to read cache
    await mkdir(config.distDir, { recursive: true });
    const cacheContent = await Bun.file(cacheFile).text();
    return JSON.parse(cacheContent);
  } catch {
    return {};
  }
}

// Save image cache to disk
async function saveImageCache(
  config: GeneratorConfig,
  cache: ImageCache,
): Promise<void> {
  const cacheFile = join(config.distDir, ".image-cache.json");
  await writeFile(cacheFile, JSON.stringify(cache, null, 2));
}
