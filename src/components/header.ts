import type { BookData, Chapter } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { safeString } from "../utils/strings";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function headerGenerator(
  book: BookData,
  pathHelper: PathHelper,
  chapter?: Chapter,
) {
  const chapterBreadcrumb = chapter
    ? `<span class="breadcrumb-separator">></span><span class="breadcrumb-current">${safeString(chapter.title)}</span>`
    : "";

  return templateEngine.render("header.html", {
    booksUrl: pathHelper.page("/books/"),
    bookUrl: pathHelper.page(`/${book.slug}/`),
    bookName: safeString(book.name),
    chapterBreadcrumb,
  });
}
