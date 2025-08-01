import type { BookData, OptimizedImage } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function bookCardGenerator(
  book: BookData,
  optimizedImages: Map<string, OptimizedImage>,
  pathHelper: PathHelper,
): string {
  const frontImagePath = `${book.path}/front.png`;
  const frontImage = optimizedImages.get(frontImagePath);
  const imageHtml = frontImage
    ? `<picture>
         <source srcset="${frontImage.avifPath}" type="image/avif">
         <source srcset="${frontImage.webpPath}" type="image/webp">
         <img src="${frontImage.sizes[0]?.path || frontImage.originalPath}" alt="${book.name} cover" class="book-cover">
       </picture>`
    : `<div class="book-cover-placeholder">📖</div>`;

  const authors = Array.isArray(book.author)
    ? book.author.join(", ")
    : book.author;
  const chapterCount = book.chapters.length;

  return templateEngine.render("book-card.html", {
    bookUrl: pathHelper.page(`/${book.slug}/`),
    imageHtml,
    bookName: book.name,
    authors,
    published: book.published,
    chapterCount,
  });
}
