import { templateEngine } from "../utils/template-engine";

export function siteFooterGenerator() {
  return templateEngine.render("site-footer.html", {
    aboutUrl: "/om/",
    booksUrl: "/books/",
    talesUrl: "/",
  });
}
