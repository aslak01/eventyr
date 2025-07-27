import { htmlHead } from "../components/htmlHead";
import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateBookIndexHTML(
  book: BookData,
  pathHelper: PathHelper,
): string {
  const headData = htmlHead(`${book.name}`, pathHelper);

  const chaptersHtml = Object.values(book.chapters)
    .map(
      (chapter) => `
          <li class="chapter-item">
              <a href="${pathHelper.page(`/${book.slug}/${chapter.path}.html`)}" class="chapter-link">${chapter.title} - ${chapter.wordCount}</a>
          </li>
      `,
    )
    .join("");

  return templateEngine.renderWithLayout("book-index.html", {
    ...headData,
    bookName: book.name.replace(/[-_]/g, " "),
    chapterCount: book.chapters.length,
    chapterCountPlural: Object.values(book.chapters).length !== 1 ? "s" : "",
    chaptersHtml,
    homeUrl: pathHelper.page("/"),
  });
}
