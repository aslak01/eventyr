import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { sortableTableGenerator } from "../components/sortableTable";
import type { BookData } from "../types/types";
import { templateEngine } from "../utils/template-engine";

export function generateMainIndexHTML(books: BookData[]): string {
  const headData = htmlHead(`Eventyr`, ["sortable"], ["sortable.min"]);
  const tales = books
    .map((book) => book.chapters)
    .flat()
    .sort((a, b) => a.wordCount - b.wordCount);

  const columns = [
    { title: "Tittel" },
    { title: "Bok" },
    { title: "Alder" },
    { title: "Ord" },
  ];

  const talesHtml = sortableTableGenerator(
    columns,
    tales,
    (tale) => `
<tr>
<td>
<a href="${String(tale.htmlPath)}">
    ${tale.title}
</a>
</td>
<td class="Bok">
<a href="/${tale.bookSlug}/">${tale.book}</a>
</td>
<td class="age-rating">${tale.ageRating ? `${tale.ageRating}+` : "-"}</td>
<td class="wordcount">${tale.wordCount}</td>
</tr>
`,
  );

  const siteHeader = siteHeaderGenerator();
  const siteFooter = siteFooterGenerator();

  return templateEngine.renderWithLayout("main-index.html", {
    ...headData,
    siteHeader,
    siteFooter,
    bookCount: books.length,
    bookCountText: books.length !== 1 ? "bøker" : "bok",
    bookCountPlural: books.length !== 1 ? "e" : "",
    booksUrl: "/books/",
    talesHtml,
  });
}
