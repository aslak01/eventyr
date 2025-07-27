import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function siteHeaderGenerator(pathHelper: PathHelper) {
  return templateEngine.render("site-header.html", {
    homeUrl: pathHelper.page("/"),
    booksUrl: pathHelper.page("/books/"),
    talesUrl: pathHelper.page("/"),
  });
}