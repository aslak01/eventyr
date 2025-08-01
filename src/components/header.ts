import type { BookData, Chapter } from "../types/types";
import { safeString } from "../utils/strings";
import { templateEngine } from "../utils/template-engine";

export function headerGenerator(book: BookData, chapter?: Chapter) {
  const chapterBreadcrumb = chapter
    ? `<span class="breadcrumb-separator">></span><span class="breadcrumb-current">${safeString(chapter.title)}</span>`
    : "";

  return templateEngine.render("header.html", {
    booksUrl: "/books/",
    bookUrl: `/${book.slug}/`,
    bookName: safeString(book.name),
    chapterBreadcrumb,
  });
}
