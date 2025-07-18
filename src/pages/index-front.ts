import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";

export function generateMainIndexHTML(books: BookData[]): string {
  const head = htmlHead(`Eventyr`, ["main"]);
  return `${head}
    <div class="header">
        <h1 class="main-title">📚 Book Library</h1>
        <p class="subtitle">${books.length} book${books.length !== 1 ? "s" : ""} available</p>
    </div>

    <div class="books-grid">
        ${books
      .map(
        (book) => `
            <div class="book-card">
                <a href="/${book.name}/" class="book-link">
                    <h2 class="book-title">${book.name.replace(/[-_]/g, " ")}</h2>
                </a>
                <div class="book-meta">
                    ${book.chapters.length} chapter${book.chapters.length !== 1 ? "s" : ""}
                </div>
                <div class="chapter-preview">
                    <h4>Chapters:</h4>
                    <ul class="chapter-list">
                        ${book.chapters
            .slice(0, 5)
            .map(
              (chapter) => `
                            <li>• ${chapter.title}</li>
                        `,
            )
            .join("")}
                        ${book.chapters.length > 5 ? `<li>• ... and ${book.chapters.length - 5} more</li>` : ""}
                    </ul>
                </div>
            </div>
        `,
      )
      .join("")}
    </div>
</body>
</html>`;
}
