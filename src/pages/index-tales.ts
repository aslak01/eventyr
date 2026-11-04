import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { sortableTableGenerator } from "../components/sortableTable";
import type { BookData } from "../types/types";
import { templateEngine } from "../utils/template-engine";
import { escapeHtml } from "../utils/strings";

export function generateMainIndexHTML(books: BookData[]): string {
  const headData = htmlHead(`Eventyr`, ["sortable"], ["sortable.min"]);
  const tales = books
    .flatMap((book) => book.chapters)
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
<a href="${tale.htmlPath}">
    ${escapeHtml(tale.title)}
</a>
</td>
<td class="Bok">
<a href="/${tale.bookSlug}/">${escapeHtml(tale.book)}</a>
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
    booksUrl: "/books/",
    talesHtml,
  });
}
