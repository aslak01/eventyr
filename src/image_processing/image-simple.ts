import { join, extname, basename, relative } from "path";
import { readdir, mkdir, copyFile, stat, rm, writeFile } from "fs/promises";
import { createHash } from "crypto";
import sharp from "sharp";

import type {
  BookData,
  GeneratorConfig,
  OptimizedImage,
  ImageCache,
  ImageCacheEntry,
} from "../types/types";
import { logger } from "../utils/logger";
import { escapeHtml } from "../utils/strings";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
const QUALITY = 85;

// Paths can reach us in either Unicode form (macOS filenames and markdown
// written there are often NFD), so all image lookups use NFC keys
export const imageKey = (path: string): string => path.normalize("NFC");

async function getContentHash(filePath: string): Promise<string> {
  const fileBuffer = await Bun.file(filePath).arrayBuffer();
  return createHash("sha256")
    .update(new Uint8Array(fileBuffer))
    .digest("hex")
    .substring(0, 16);
}

// Output depends on these settings and the encoder versions as well as the
// source image, so a change to any of them invalidates every cache entry
function getSettingsKey(config: GeneratorConfig): string {
  return JSON.stringify({
    sizes: config.imageSizes,
    formats: config.imageFormats,
    quality: QUALITY,
    sharp: sharp.versions.sharp,
    vips: sharp.versions.vips,
  });
}

const webPathToFsPath = (webPath: string, distDir: string): string =>
  join(distDir, webPath);

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isCacheEntryValid(
  entry: ImageCacheEntry | undefined,
  contentHash: string,
  settingsKey: string,
  distDir: string,
): Promise<boolean> {
  if (
    !entry ||
    entry.contentHash !== contentHash ||
    entry.settingsKey !== settingsKey ||
    entry.sizes.length === 0
  ) {
    return false;
  }
  const exists = await Promise.all(
    entry.sizes.map((size) => fileExists(webPathToFsPath(size.path, distDir))),
  );
  return exists.every(Boolean);
}

export async function optimizeImages(
  books: BookData[],
  config: GeneratorConfig,
): Promise<Map<string, OptimizedImage>> {
  const optimizedImages = new Map<string, OptimizedImage>();
  const oldCache = await loadImageCache(config);
  // Rebuilt from scratch so entries for deleted images are dropped
  const cache: ImageCache = {};
  const settingsKey = getSettingsKey(config);
  let processedCount = 0;

  logger.info("Optimizing images", {
    cachedEntries: Object.keys(oldCache).length,
  });

  for (const book of books) {
    for (const imagePath of await findImages(book.path)) {
      const key = imageKey(imagePath);
      const contentHash = await getContentHash(imagePath);
      const cached = oldCache[key];

      let optimized: OptimizedImage | null;
      if (
        cached &&
        (await isCacheEntryValid(
          cached,
          contentHash,
          settingsKey,
          config.distDir,
        ))
      ) {
        logger.debug("Using cached image", { image: basename(imagePath) });
        optimized = { ...cached, originalPath: imagePath };
      } else {
        optimized = await processImage(imagePath, book.slug, config);
        if (!optimized) continue;
        processedCount++;
        logger.debug("Optimized image", { image: basename(imagePath) });
      }

      optimizedImages.set(key, optimized);
      cache[key] = {
        contentHash,
        settingsKey,
        sizes: optimized.sizes,
        webpPath: optimized.webpPath,
        avifPath: optimized.avifPath,
        width: optimized.width,
        height: optimized.height,
      };
    }
  }

  const removedCount = await pruneStaleImages(config.distDir, cache);
  await saveImageCache(config, cache);

  logger.info("Image optimization complete", {
    images: optimizedImages.size,
    processed: processedCount,
    cached: optimizedImages.size - processedCount,
    staleFilesRemoved: removedCount,
  });

  return optimizedImages;
}

// Removes generated files whose source image no longer exists, so they
// aren't deployed (CI restores dist/images from earlier builds)
async function pruneStaleImages(
  distDir: string,
  cache: ImageCache,
): Promise<number> {
  const imagesDir = join(distDir, "images");
  const expected = new Set(
    Object.values(cache).flatMap((entry) =>
      entry.sizes.map((size) => imageKey(webPathToFsPath(size.path, distDir))),
    ),
  );

  let files: string[];
  try {
    files = await readdir(imagesDir, { recursive: true });
  } catch {
    return 0;
  }

  let removed = 0;
  for (const file of files) {
    const fsPath = join(imagesDir, file);
    if (expected.has(imageKey(fsPath))) continue;
    if (!(await stat(fsPath)).isFile()) continue;
    await rm(fsPath);
    logger.debug("Removed stale image", { file: relative(distDir, fsPath) });
    removed++;
  }
  return removed;
}

async function listImages(dir: string): Promise<string[]> {
  return (await readdir(dir))
    .filter((file) => IMAGE_EXTENSIONS.includes(extname(file).toLowerCase()))
    .sort()
    .map((file) => join(dir, file));
}

export async function findImages(bookPath: string): Promise<string[]> {
  const imageFiles: string[] = [];

  // Images in the book root (like front.png)
  try {
    imageFiles.push(...(await listImages(bookPath)));
  } catch {
    return imageFiles;
  }

  // Images in chapter directories
  const chaptersPath = join(bookPath, "chapters");
  let chapters: string[];
  try {
    chapters = (await readdir(chaptersPath)).sort();
  } catch {
    return imageFiles;
  }

  for (const chapter of chapters) {
    const chapterPath = join(chaptersPath, chapter);
    if ((await stat(chapterPath)).isDirectory()) {
      imageFiles.push(...(await listImages(chapterPath)));
    }
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

    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (ext === ".svg") {
      // Vector images are served as-is
      await copyFile(imagePath, join(outputDir, basename(imagePath)));
      return {
        originalPath: imagePath,
        webpPath: "",
        avifPath: "",
        sizes: [{ width, path: `/images/${bookSlug}/${basename(imagePath)}` }],
        width,
        height,
      };
    }

    // Never upscale; an image narrower than every configured size is
    // still emitted once at its own width
    const fittingSizes = config.imageSizes.filter((size) => size <= width);
    const sizes = fittingSizes.length > 0 ? fittingSizes : [width];

    const optimized: OptimizedImage = {
      originalPath: imagePath,
      webpPath: "",
      avifPath: "",
      sizes: [],
      width,
      height,
    };

    for (const size of sizes) {
      for (const format of config.imageFormats) {
        const fileName = `${baseName}_${size}w.${format}`;

        await image
          .clone()
          .resize(size, null, { withoutEnlargement: true })
          .toFormat(format, { quality: QUALITY })
          .toFile(join(outputDir, fileName));

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
    logger.error("Error processing image", {
      imagePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Height that keeps the image's aspect ratio at the given display width
export function scaledHeight(image: OptimizedImage, width: number): number {
  if (!image.width || !image.height) return image.height;
  return Math.round((width * image.height) / image.width);
}

// Generate a sizes attribute with breakpoints based on the available widths
function generateSizes(widths: number[]): string {
  if (widths.length === 1) {
    return `${widths[0]}px`;
  }

  const breakpoints = widths.slice(0, -1).map((width, index) => {
    const nextWidth = widths[index + 1]!;
    // Use 2x the current width or next width, whichever is smaller
    const breakpoint = Math.min(width * 2, nextWidth);
    return `(max-width: ${breakpoint}px) ${width}px`;
  });

  // Largest size as the default
  breakpoints.push(`${widths[widths.length - 1]}px`);

  return breakpoints.join(", ");
}

export function processMarkdownImages(
  content: string,
  optimizedImages: Map<string, OptimizedImage>,
  chapterPath: string,
): string {
  return content.replace(
    /!\[([^\]]*)\]\(\.\/(.*?\.(png|jpg|jpeg|gif|svg|webp))\s*(?:"([^"]*)")?\)/gi,
    (match, alt: string, imagePath: string, ext: string, title?: string) => {
      const optimized = optimizedImages.get(
        imageKey(join(chapterPath, imagePath)),
      );
      const smallest = optimized?.sizes[0];
      if (!optimized || !smallest) {
        logger.error("No optimized image found", { imagePath, chapterPath });
        return match;
      }

      const altAttr = `alt="${escapeHtml(alt)}"`;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";

      if (ext.toLowerCase() === "svg") {
        const width = smallest.width || optimized.width;
        return `<img src="${smallest.path}" ${altAttr}${titleAttr} width="${width}" height="${scaledHeight(optimized, width)}" />`;
      }

      const availableWidths = [
        ...new Set(optimized.sizes.map((s) => s.width).filter((w) => w > 0)),
      ].sort((a, b) => a - b);
      const sizesAttribute = generateSizes(availableWidths);

      const srcsetFor = (extension: string): string =>
        optimized.sizes
          .filter((s) => s.path.endsWith(extension))
          .map((s) => `${s.path} ${s.width}w`)
          .join(", ");
      const avifSources = srcsetFor(".avif");
      const webpSources = srcsetFor(".webp");
      const jpegSources = srcsetFor(".jpeg");

      // The <img> is the fallback for browsers without AVIF/WebP support,
      // so prefer a JPEG for its src
      const fallback =
        optimized.sizes.find((s) => s.path.endsWith(".jpeg")) ?? smallest;

      return `<picture>
        ${avifSources ? `<source srcset="${avifSources}" type="image/avif" sizes="${sizesAttribute}" />` : ""}
        ${webpSources ? `<source srcset="${webpSources}" type="image/webp" sizes="${sizesAttribute}" />` : ""}
        <img src="${fallback.path}"${jpegSources ? ` srcset="${jpegSources}"` : ""} ${altAttr}${titleAttr} sizes="${sizesAttribute}" width="${fallback.width}" height="${scaledHeight(optimized, fallback.width)}" />
      </picture>`;
    },
  );
}

async function loadImageCache(config: GeneratorConfig): Promise<ImageCache> {
  try {
    const cacheFile = join(config.distDir, ".image-cache.json");
    return JSON.parse(await Bun.file(cacheFile).text());
  } catch {
    return {};
  }
}

async function saveImageCache(
  config: GeneratorConfig,
  cache: ImageCache,
): Promise<void> {
  await mkdir(config.distDir, { recursive: true });
  await writeFile(
    join(config.distDir, ".image-cache.json"),
    JSON.stringify(cache, null, 2),
  );
}
