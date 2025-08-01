import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { bookCardGenerator } from "../components/bookCard";
import type { BookData, OptimizedImage } from "../types/types";
import type { createPathHelper } from "../utils/paths";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateBooksIndexHTML(
  books: BookData[],
  optimizedImages: Map<string, OptimizedImage>,
  pathHelper: PathHelper,
): string {
  const headData = htmlHead(`Boksamling - Eventyr`, pathHelper);

  const booksHtml = books
    .map((book) => bookCardGenerator(book, optimizedImages, pathHelper))
    .join("");

  const siteHeader = siteHeaderGenerator(pathHelper);
  const siteFooter = siteFooterGenerator(pathHelper);

  return templateEngine.renderWithLayout("books-index.html", {
    ...headData,
    siteHeader,
    siteFooter,
    bookCount: books.length,
    bookCountText: books.length !== 1 ? "bøker" : "bok",
    bookCountPlural: books.length !== 1 ? "e" : "",
    booksHtml,
  });
}
