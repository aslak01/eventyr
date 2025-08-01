import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { sortableTableGenerator } from "../components/sortableTable";
import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateBookIndexHTML(
  book: BookData,
  pathHelper: PathHelper,
): string {
  const headData = htmlHead(
    `${book.name}`,
    pathHelper,
    ["sortable"],
    ["sortable.min"],
  );

  const columns = [{ title: "Tittel" }, { title: "Ord" }];

  const chaptersHtml = sortableTableGenerator(
    columns,
    Object.values(book.chapters),
    pathHelper,
    (chapter) => `
<tr>
<td>
<a href="${pathHelper.page(`/${book.slug}/${chapter.path}.html`)}">
    ${chapter.title}
</a>
</td>
<td>${chapter.wordCount}</td>
</tr>
`,
  );

  const siteHeader = siteHeaderGenerator(pathHelper);
  const siteFooter = siteFooterGenerator(pathHelper);

  return templateEngine.renderWithLayout("book-index.html", {
    ...headData,
    siteHeader,
    siteFooter,
    bookName: book.name.replace(/[-_]/g, " "),
    chapterCount: book.chapters.length,
    chapterCountPlural: Object.values(book.chapters).length !== 1 ? "s" : "",
    chaptersHtml,
    homeUrl: pathHelper.page("/"),
  });
}
