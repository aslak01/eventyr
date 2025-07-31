import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { sortableTableGenerator } from "../components/sortableTable";
import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateMainIndexHTML(
  books: BookData[],
  pathHelper: PathHelper,
): string {
  const headData = htmlHead(
    `Eventyr`,
    pathHelper,
    ["sortable"],
    ["sortable.min"],
  );
  const tales = books
    .map((book) => book.chapters)
    .flat()
    .sort((a, b) => a.wordCount - b.wordCount);

  const columns = [{ title: "Tittel" }, { title: "Bok" }, { title: "Ord" }];

  const talesHtml = sortableTableGenerator(
    columns,
    tales,
    pathHelper,
    (tale) => `
<tr>
<td>
<a href="${pathHelper.page(String(tale.htmlPath))}">
    ${tale.title}
</a>
</td>
<td>
<a href="${pathHelper.page(`/${tale.bookSlug}/`)}">${tale.book}</a>
</td>
<td class="wordcount">${tale.wordCount}</td>
</tr>
`,
  );

  const siteHeader = siteHeaderGenerator(pathHelper);
  const siteFooter = siteFooterGenerator(pathHelper);

  return templateEngine.renderWithLayout("main-index.html", {
    ...headData,
    siteHeader,
    siteFooter,
    bookCount: books.length,
    bookCountText: books.length !== 1 ? "bøker" : "bok",
    bookCountPlural: books.length !== 1 ? "e" : "",
    booksUrl: pathHelper.page("/books/"),
    talesHtml,
  });
}
