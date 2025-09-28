import type { BookData, OptimizedImage } from "../types/types";
import { templateEngine } from "../utils/template-engine";
import { safeString } from "../utils/strings";
import { isNonEmptyString } from "../utils/type-guards";

export function bookCardGenerator(
  book: BookData,
  optimizedImages: Map<string, OptimizedImage>,
): string {
  if (!book?.path || !book?.name || !book?.slug) {
    throw new Error("Invalid book data provided to bookCardGenerator");
  }

  const frontImagePath = `${book.path}/front.png`;
  const frontImage = optimizedImages.get(frontImagePath);

  let imageHtml: string;
  if (
    frontImage &&
    frontImage.sizes &&
    Array.isArray(frontImage.sizes) &&
    frontImage.sizes.length > 0
  ) {
    const firstSize = frontImage.sizes[0];
    const imgSrc = firstSize?.path || frontImage.originalPath || "";
    const imgWidth = firstSize?.width || frontImage.width || 200;
    const imgHeight = Math.round(
      (imgWidth * (frontImage.height || 300)) / (frontImage.width || 200),
    );

    imageHtml = `<picture>
         <source srcset="${safeString(frontImage.avifPath || "")}" type="image/avif">
         <source srcset="${safeString(frontImage.webpPath || "")}" type="image/webp">
         <img src="${safeString(imgSrc)}" alt="${safeString(book.name)} cover" class="book-cover" width="${imgWidth}" height="${imgHeight}">
       </picture>`;
  } else {
    imageHtml = `<div class="book-cover-placeholder">📖</div>`;
  }

  let authors: string;
  if (Array.isArray(book.author) && book.author.length > 0) {
    authors = book.author.filter(isNonEmptyString).join(", ");
  } else if (typeof book.author === "string" && book.author.trim()) {
    authors = book.author;
  } else {
    authors = "Unknown Author";
  }

  const chapterCount = Array.isArray(book.chapters) ? book.chapters.length : 0;

  return templateEngine.render("book-card.html", {
    bookUrl: `/${safeString(book.slug)}/`,
    imageHtml,
    bookName: safeString(book.name),
    authors: safeString(authors),
    published: book.published || 0,
    chapterCount,
  });
}
