import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateMainIndexHTML(books: BookData[], pathHelper: PathHelper): string {
  const head = htmlHead(`Eventyr`, pathHelper);
  const tales = books
    .map((book) => book.chapters)
    .flat()
    .sort((a, b) => a.wordCount - b.wordCount);
  return `${head}
    <div class="header">
        <h1 class="main-title">📚 Eventyrsamling</h1>
        <p class="subtitle">${books.length} ${books.length !== 1 ? "bøker" : "bok"} tilgjengelig${books.length !== 1 ? "e" : ""}</p>
        <nav class="header-nav">
            <a href="${pathHelper.page('/books/')}" class="nav-link">📖 Bøker</a>
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
      .join("")}
</tbody>
</table>
</main>
</body>
</html>`;
}
