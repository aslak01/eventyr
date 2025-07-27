import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateMainIndexHTML(
  books: BookData[],
  pathHelper: PathHelper,
): string {
  const headData = htmlHead(`Eventyr`, pathHelper);
  const tales = books
    .map((book) => book.chapters)
    .flat()
    .sort((a, b) => a.wordCount - b.wordCount);

  const talesHtml = tales
    .map(
      (tale) => `
<tr>
<td>
<a href="${pathHelper.page(tale.htmlPath)}">
    ${tale.title}
</a>
</td>
<td>
<a href="${pathHelper.page(`/${tale.bookSlug}/`)}">${tale.book}</a>
</td>
<td>${tale.wordCount}</td>
</tr>
`,
    )
    .join("");

  return templateEngine.renderWithLayout("main-index.html", {
    ...headData,
    bookCount: books.length,
    bookCountText: books.length !== 1 ? "bøker" : "bok",
    bookCountPlural: books.length !== 1 ? "e" : "",
    booksUrl: pathHelper.page("/books/"),
    talesHtml,
  });
}
