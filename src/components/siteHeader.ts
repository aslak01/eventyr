import { templateEngine } from "../utils/template-engine";

export function siteHeaderGenerator() {
  return templateEngine.render("site-header.html", {
    homeUrl: "/",
    booksUrl: "/books/",
    talesUrl: "/",
  });
}
