import { join, extname, basename } from "path";
import { readdir, mkdir, copyFile, stat } from "fs/promises";
import sharp from "sharp";

import type {
  BookData,
  GeneratorConfig,
  OptimizedImage,
  ImageCache,
} from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { writeFile } from "fs/promises";

type PathHelper = ReturnType<typeof createPathHelper>;

export async function optimizeImages(
  books: BookData[],
  config: GeneratorConfig,
  pathHelper: PathHelper,
): Promise<Map<string, OptimizedImage>> {
  const optimizedImages = new Map<string, OptimizedImage>();
  const cache = await loadImageCache(config);
  let cacheUpdated = false;

  console.log("🖼️  Optimizing images...");

  for (const book of books) {
    const imageFiles = await findImages(book.path);

    for (const imagePath of imageFiles) {
      const needsUpdate = await needsProcessing(imagePath, cache);

      if (needsUpdate) {
        const optimized = await processImage(
          imagePath,
          book.slug,
          config,
          pathHelper,
        );
        if (optimized) {
          optimizedImages.set(imagePath, optimized);

          // Update cache
          const stats = await stat(imagePath);
          cache[imagePath] = {
            mtime: stats.mtime.getTime(),
            sizes: optimized.sizes,
            webpPath: optimized.webpPath,
            avifPath: optimized.avifPath,
          };
          cacheUpdated = true;

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

        optimizedImages.set(imagePath, {
          originalPath: imagePath,
          webpPath: cachedData.webpPath,
          avifPath: cachedData.avifPath,
          sizes: cachedData.sizes,
        });

        console.log(`  💾 Cached: ${basename(imagePath)}`);
      }
    }
  }

  // Save cache if updated
  if (cacheUpdated) {
    await saveImageCache(config, cache);
    console.log("💾 Updated image cache");
  }

  return optimizedImages;
}

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
  pathHelper: PathHelper,
): Promise<OptimizedImage | null> {
  const ext = extname(imagePath).toLowerCase();
  const baseName = basename(imagePath, ext);
  const outputDir = join(config.distDir, "images", bookSlug);

  try {
    await mkdir(outputDir, { recursive: true });

    if (ext === ".svg") {
      const svgPath = join(outputDir, basename(imagePath));
      await copyFile(imagePath, svgPath);
      return {
        originalPath: imagePath,
        webpPath: svgPath,
        avifPath: svgPath,
        sizes: [
          {
            width: 0,
            path: pathHelper.asset(
              `/images/${bookSlug}/${basename(imagePath)}`,
            ),
          },
        ],
      };
    }

    const image = sharp(imagePath);
    const metadata = await image.metadata();

    const optimized: OptimizedImage = {
      originalPath: imagePath,
      webpPath: "",
      avifPath: "",
      sizes: [],
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

        const webPath = pathHelper.asset(`/images/${bookSlug}/${fileName}`);
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
  bookSlug: string,
  optimizedImages: Map<string, OptimizedImage>,
  chapterPath: string,
  pathHelper: PathHelper,
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
        return `<img src="${optimized.sizes[0].path}" alt="${alt}"${title ? ` title="${title}"` : ""} />`;
      }

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
        ${avifSources ? `<source srcset="${avifSources}" type="image/avif" sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px" />` : ""}
        ${webpSources ? `<source srcset="${webpSources}" type="image/webp" sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px" />` : ""}
        <img src="${optimized.sizes[0].path}" srcset="${jpegSources}" alt="${alt}"${title ? ` title="${title}"` : ""} sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px" />
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

// Check if image needs processing based on modification time
async function needsProcessing(
  imagePath: string,
  cache: ImageCache,
): Promise<boolean> {
  const cacheKey = imagePath;

  try {
    const stats = await stat(imagePath);
    const currentMtime = stats.mtime.getTime();

    // If not in cache or file is newer, needs processing
    if (!cache[cacheKey] || cache[cacheKey].mtime < currentMtime) {
      return true;
    }

    // Verify cached files still exist (important for CI environments)
    const cachedData = cache[cacheKey];
    if (cachedData.webpPath || cachedData.avifPath) {
      // Check if at least one of the cached image files exists
      const hasValidCache = await Promise.all([
        cachedData.webpPath ? checkFileExists(cachedData.webpPath) : Promise.resolve(false),
        cachedData.avifPath ? checkFileExists(cachedData.avifPath) : Promise.resolve(false),
        ...cachedData.sizes.map(size => checkFileExists(size.path))
      ]).then(results => results.some(exists => exists));

      if (!hasValidCache) {
        console.log(`  🔄 Cache invalid for ${basename(imagePath)}, regenerating...`);
        return true;
      }
    }

    return false;
  } catch {
    // If we can't stat the file, assume it needs processing
    return true;
  }
}

// Helper function to check if a file exists
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    // Convert web path back to filesystem path for checking
    // Remove base path and prepend dist directory
    const cleanPath = filePath.replace(/^\/[^/]*\//, ''); // Remove base path like /eventyr/
    const fsPath = join('./dist', cleanPath);
    await stat(fsPath);
    return true;
  } catch {
    return false;
  }
}
