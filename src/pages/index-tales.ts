import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";

export function generateMainIndexHTML(books: BookData[]): string {
  const head = htmlHead(`Eventyr`);
  const tales = books
    .map((book) => book.chapters)
    .flat()
    .sort((a, b) => a.wordCount - b.wordCount);
  return `${head}
    <div class="header">
        <h1 class="main-title">📚 Eventyrsamling</h1>
        <p class="subtitle">${books.length} ${books.length !== 1 ? "bøker" : "bok"} tilgjengelig${books.length !== 1 ? "e" : ""}</p>
        <nav class="header-nav">
            <a href="/books/" class="nav-link">📖 Bøker</a>
        </nav>
    </div>

<main>
<table class="tale-table">
<thead>
<tr>
<th>Tittel</th>
<th>Bok</th>
<th>Ord</th>
</tr>
</thead>
<tbody>
${tales
      .map(
        (tale) => `
<tr>
<td>
<a href="${tale.htmlPath}">
    ${tale.title}
</a>
</td>
<td>
<a href="${tale.bookSlug}/">${tale.book}</a>
</td>
<td>${tale.wordCount}</td>
</tr>
  `,
      )
      .join("")}
</tbody>
</table>
</main>
</body>
</html>`;
}
