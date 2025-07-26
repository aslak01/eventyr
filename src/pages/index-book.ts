import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateBookIndexHTML(book: BookData, pathHelper: PathHelper): string {
  const head = htmlHead(`${book.name}`, pathHelper);
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
                <a href="${pathHelper.page(`/${book.slug}/${chapter.path}.html`)}" class="chapter-link">${chapter.title} - ${chapter.wordCount}</a>
            </li>
        `,
      )
      .join("")}
    </ul>

    <div class="navigation">
        <a class="book-link" href="${pathHelper.page('/')}">← Back to all books</a>
    </div>
</body>
</html>`;
}
