import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { sortableTableGenerator } from "../components/sortableTable";
import type { BookData } from "../types/types";
import { templateEngine } from "../utils/template-engine";

export function generateBookIndexHTML(book: BookData): string {
  const headData = htmlHead(`${book.name}`, ["sortable"], ["sortable.min"]);

  const columns = [{ title: "Tittel" }, { title: "Ord" }];

  const chaptersHtml = sortableTableGenerator(
    columns,
    Object.values(book.chapters),
    (chapter) => `
<tr>
<td>
<a href="/${book.slug}/${chapter.path}.html">
    ${chapter.title}
</a>
</td>
<td>${chapter.wordCount}</td>
</tr>
`,
  );

  const siteHeader = siteHeaderGenerator();
  const siteFooter = siteFooterGenerator();

  return templateEngine.renderWithLayout("book-index.html", {
    ...headData,
    siteHeader,
    siteFooter,
    bookName: book.name.replace(/[-_]/g, " "),
    chapterCount: book.chapters.length,
    chapterCountPlural: Object.values(book.chapters).length !== 1 ? "s" : "",
    chaptersHtml,
    homeUrl: "/",
  });
}
