import { join } from "path";

import type { BookData, OptimizedImage } from "../types/types";
import { templateEngine } from "../utils/template-engine";
import { escapeHtml } from "../utils/strings";
import { imageKey, scaledHeight } from "../image_processing/image-simple";

export function bookCardGenerator(
  book: BookData,
  optimizedImages: Map<string, OptimizedImage>,
): string {
  const frontImage = optimizedImages.get(
    imageKey(join(book.path, "front.png")),
  );
  // The <img> is the fallback for browsers without AVIF/WebP support
  const firstSize =
    frontImage?.sizes.find((size) => size.path.endsWith(".jpeg")) ??
    frontImage?.sizes[0];

  let imageHtml: string;
  if (frontImage && firstSize) {
    const sources = [
      [frontImage.avifPath, "image/avif"],
      [frontImage.webpPath, "image/webp"],
    ]
      .filter(([path]) => path)
      .map(
        ([path, type]) =>
          `<source srcset="${escapeHtml(path!)}" type="${type}">`,
      )
      .join("\n         ");

    imageHtml = `<picture>
         ${sources}
         <img src="${escapeHtml(firstSize.path)}" alt="${escapeHtml(book.name)} cover" class="book-cover" width="${firstSize.width}" height="${scaledHeight(frontImage, firstSize.width)}">
       </picture>`;
  } else {
    imageHtml = `<div class="book-cover-placeholder">📖</div>`;
  }

  return templateEngine.render("book-card.html", {
    bookUrl: `/${escapeHtml(book.slug)}/`,
    imageHtml,
    bookName: escapeHtml(book.name),
    authors: escapeHtml(book.author.join(", ")),
    published: book.published,
    chapterCount: book.chapters.length,
  });
}
