import { join, extname, basename, } from "path";
import { readdir, mkdir, copyFile } from "fs/promises";
import sharp from "sharp";

import type { BookData, GeneratorConfig, OptimizedImage } from "../types/types";

export async function optimizeImages(books: BookData[], config: GeneratorConfig): Promise<Map<string, OptimizedImage>> {
  const optimizedImages = new Map<string, OptimizedImage>();

  console.log("🖼️  Optimizing images...");

  for (const book of books) {
    const imageFiles = await findImages(book.path);

    for (const imagePath of imageFiles) {
      const optimized = await processImage(imagePath, book.name, config);
      if (optimized) {
        optimizedImages.set(imagePath, optimized);
        console.log(`  ✨ Optimized: ${basename(imagePath)}`);
      }
    }
  }

  return optimizedImages;
}

export async function findImages(bookPath: string): Promise<string[]> {
  const imageFiles: string[] = [];

  try {
    const files = await readdir(bookPath);

    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
        imageFiles.push(join(bookPath, file));
      }
    }
  } catch (error) {
    console.error(`Error finding images in ${bookPath}:`, error);
  }

  return imageFiles;
}

export async function processImage(imagePath: string, bookName: string, config: GeneratorConfig): Promise<OptimizedImage | null> {
  const ext = extname(imagePath).toLowerCase();
  const baseName = basename(imagePath, ext);
  const outputDir = join(config.distDir, 'images', bookName);

  try {
    await mkdir(outputDir, { recursive: true });

    // Skip SVG files - just copy them
    if (ext === '.svg') {
      const svgPath = join(outputDir, basename(imagePath));
      await copyFile(imagePath, svgPath);
      return {
        originalPath: imagePath,
        webpPath: svgPath,
        avifPath: svgPath,
        sizes: [{ width: 0, path: `/images/${bookName}/${basename(imagePath)}` }]
      };
    }

    const image = sharp(imagePath);
    const metadata = await image.metadata();

    const optimized: OptimizedImage = {
      originalPath: imagePath,
      webpPath: '',
      avifPath: '',
      sizes: []
    };

    for (const size of config.imageSizes) {
      if (!metadata.width || size > metadata.width) continue;

      for (const format of config.imageFormats) {
        const fileName = `${baseName}_${size}w.${format}`;
        const outputPath = join(outputDir, fileName);

        await image
          .resize(size, null, { withoutEnlargement: true })
          .toFormat(format as any, { quality: 85 })
          .toFile(outputPath);

        const webPath = `/images/${bookName}/${fileName}`;
        optimized.sizes.push({ width: size, path: webPath });

        if (format === 'webp' && !optimized.webpPath) {
          optimized.webpPath = webPath;
        }
        if (format === 'avif' && !optimized.avifPath) {
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

export function processMarkdownImages(content: string, bookName: string, optimizedImages: Map<string, OptimizedImage>): string {
  return content.replace(
    /!\[([^\]]*)\]\(\.\/(.*?\.(png|jpg|jpeg|gif|svg|webp))\s*(?:"([^"]*)")?\)/gi,
    (match, alt, imagePath, ext, title) => {
      const fullImagePath = join(process.cwd(), 'src/lib/books', bookName, imagePath);
      const optimized = optimizedImages.get(fullImagePath);

      if (!optimized || optimized?.sizes?.length < 1 || !optimized?.sizes[0]?.path) {
        console.warn(`No optimized image found for: ${imagePath}`);
        return match;
      }

      if (ext.toLowerCase() === 'svg') {
        return `<img src="${optimized.sizes[0].path}" alt="${alt}"${title ? ` title="${title}"` : ''} />`;
      }

      const webpSources = optimized.sizes
        .filter(s => s.path.includes('.webp'))
        .map(s => `${s.path} ${s.width}w`)
        .join(', ');

      const avifSources = optimized.sizes
        .filter(s => s.path.includes('.avif'))
        .map(s => `${s.path} ${s.width}w`)
        .join(', ');

      const jpegSources = optimized.sizes
        .filter(s => s.path.includes('.jpeg'))
        .map(s => `${s.path} ${s.width}w`)
        .join(', ');

      return `<picture>
        ${avifSources ? `<source srcset="${avifSources}" type="image/avif" sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px" />` : ''}
        ${webpSources ? `<source srcset="${webpSources}" type="image/webp" sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px" />` : ''}
        <img src="${optimized.sizes[0].path}" srcset="${jpegSources}" alt="${alt}"${title ? ` title="${title}"` : ''} sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px" />
      </picture>`;
    }
  );
}

