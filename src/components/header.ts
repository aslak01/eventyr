import type { BookData } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { joinAuthors, safeString } from "../utils/strings";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function headerGenerator(book: BookData, pathHelper: PathHelper) {
  return templateEngine.render("header.html", {
    homeUrl: pathHelper.page("/"),
    bookUrl: pathHelper.page(`/${book.slug}/`),
    bookName: safeString(book.name),
    author: joinAuthors(book.author),
    published: book.published,
  });
}
