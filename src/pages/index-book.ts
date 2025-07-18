import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";

export function generateBookIndexHTML(book: BookData): string {
  const head = htmlHead(`${book.name}`, ["book_index"]);
  return `${head}
<body>
    <div class="header">
        <h1 class="book-title">${book.name.replace(/[-_]/g, " ")}</h1>
        <p>${book.chapters.length} chapter${book.chapters.length !== 1 ? "s" : ""}</p>
    </div>

    <ul class="chapters">
        ${book.chapters
      .map(
        (chapter) => `
            <li class="chapter-item">
                <a href="/${book.name}/${chapter.name}.html" class="chapter-link">${chapter.title} - ${chapter.wordCount}</a>
            </li>
        `,
      )
      .join("")}
    </ul>

    <div class="nav">
        <a href="/">← Back to all books</a>
    </div>
</body>
</html>`;
}
