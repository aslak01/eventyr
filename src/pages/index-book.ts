import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";

export function generateBookIndexHTML(book: BookData): string {
  const head = htmlHead(`${book.name}`);
  return `${head}
<body>
    <div class="header">
        <h1 class="book-title">${book.name.replace(/[-_]/g, " ")}</h1>
        <p>${book.chapters.length} chapter${Object.values(book.chapters).length !== 1 ? "s" : ""}</p>
    </div>

    <ul class="chapters">
        ${Object.values(book.chapters)
      .map(
        (chapter) => `
            <li class="chapter-item">
                <a href="/${book.slug}/${chapter.path}.html" class="chapter-link">${chapter.title} - ${chapter.wordCount}</a>
            </li>
        `,
      )
      .join("")}
    </ul>

    <div class="navigation">
        <a class="book-link" href="/">← Back to all books</a>
    </div>
</body>
</html>`;
}
