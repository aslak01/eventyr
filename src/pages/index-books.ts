import { htmlHead } from "../components/htmlHead";
import type { BookData, OptimizedImage } from "../types/types";
import type { createPathHelper } from "../utils/paths";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateBooksIndexHTML(books: BookData[], optimizedImages: Map<string, OptimizedImage>, pathHelper: PathHelper): string {
  const head = htmlHead(`Boksamling - Eventyr`, pathHelper);
  
  return `${head}
    <div class="header">
        <h1 class="main-title">📚 Boksamling</h1>
        <p class="subtitle">${books.length} ${books.length !== 1 ? "bøker" : "bok"} tilgjengelig${books.length !== 1 ? "e" : ""}</p>
    </div>

<main>
<div class="books-grid">
${books
  .map((book) => {
    // Look for front.png in this book's directory  
    const frontImagePath = `${book.path}/front.png`;
    const frontImage = optimizedImages.get(frontImagePath);
    const imageHtml = frontImage 
      ? `<picture>
           <source srcset="${frontImage.avifPath}" type="image/avif">
           <source srcset="${frontImage.webpPath}" type="image/webp">
           <img src="${frontImage.sizes[0]?.path || frontImage.originalPath}" alt="${book.name} cover" class="book-cover">
         </picture>`
      : `<div class="book-cover-placeholder">📖</div>`;
    
    const authors = Array.isArray(book.author) ? book.author.join(", ") : book.author;
    const chapterCount = book.chapters.length;
    
    return `
<div class="book-card">
  <a href="${pathHelper.page(`/${book.slug}/`)}" class="book-link">
    <div class="book-cover-container">
      ${imageHtml}
    </div>
    <div class="book-info">
      <h2 class="book-title">${book.name}</h2>
      <p class="book-author">av ${authors}</p>
      <p class="book-published">Utgitt: ${book.published}</p>
      <p class="book-chapters">${chapterCount} ${chapterCount !== 1 ? "eventyr" : "eventyr"}</p>
    </div>
  </a>
</div>`;
  })
  .join("")}
</div>
</main>
</body>
</html>`;
}