import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { bookCardGenerator } from "../components/bookCard";
import type { BookData, OptimizedImage } from "../types/types";
import { templateEngine } from "../utils/template-engine";

export function generateBooksIndexHTML(
  books: BookData[],
  optimizedImages: Map<string, OptimizedImage>,
): string {
  const headData = htmlHead(`Boksamling - Eventyr`);

  const booksHtml = books
    .map((book) => bookCardGenerator(book, optimizedImages))
    .join("");

  const siteHeader = siteHeaderGenerator();
  const siteFooter = siteFooterGenerator();

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
