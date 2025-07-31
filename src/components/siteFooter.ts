import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function siteFooterGenerator(pathHelper: PathHelper) {
  return templateEngine.render("site-footer.html", {
    aboutUrl: pathHelper.page("/om/"),
    booksUrl: pathHelper.page("/books/"),
    talesUrl: pathHelper.page("/"),
  });
}

