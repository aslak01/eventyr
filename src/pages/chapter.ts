import { join } from "path";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import markedHookFrontmatter from "marked-hook-frontmatter";
import markedSequentialHooks from "marked-sequential-hooks";

import type { BookData, Chapter, OptimizedImage } from "../types/types";

import { processMarkdownImages } from "../image_processing/image-simple";
import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { escapeHtml } from "../utils/strings";
import { headerGenerator } from "../components/header";
import { templateEngine } from "../utils/template-engine";

export function generateChapterHTML(
  book: BookData,
  chapter: Chapter,
  optimizedImages: Map<string, OptimizedImage>,
): string {
  const fullChapterPath = join(book.path, "chapters", chapter.path);

  const processedContent = processMarkdownImages(
    chapter.content,
    optimizedImages,
    fullChapterPath,
  );

  let frontmatterData: any = {};
  const marked = new Marked().use(
    markedSequentialHooks({
      markdownHooks: [markedHookFrontmatter({ dataPrefix: true })],
      htmlHooks: [
        (html, data) => {
          frontmatterData = data.matter || {};
          return html;
        },
      ],
    }),
    markedFootnote({
      description: "Fotnoter",
      backRefLabel: "Tilbake til referanse {0}",
    }),
  );

  const htmlContent = marked.parse(processedContent);

  const { chapters } = book;
  const { order } = chapter;

  const prevChapter = chapters[order - 1];
  const nextChapter = chapters[order + 1];

  const headData = htmlHead(
    `${escapeHtml(chapter.title)} - ${escapeHtml(book.name)}`,
  );
  const header = headerGenerator(book, chapter);
  const siteHeader = siteHeaderGenerator();
  const siteFooter = siteFooterGenerator();

  const prevChapterLink = prevChapter
    ? `<a href="/${book.slug}/${prevChapter.path}.html" class="nav-link">← ${escapeHtml(prevChapter.title)}</a>`
    : "<span></span>";

  const nextChapterLink = nextChapter
    ? `<a href="/${book.slug}/${nextChapter.path}.html" class="nav-link">${escapeHtml(nextChapter.title)} →</a>`
    : "<span></span>";

  const pdfLink = chapter.pdfPath
    ? `<a href="${chapter.pdfPath}" class="pdf-link" target="_blank">📄 Les som PDF</a>`
    : "";

  const chapterSubtitle = frontmatterData.subtitle
    ? `<p class="chapter-subtitle">${escapeHtml(String(frontmatterData.subtitle))}</p>`
    : "";

  return templateEngine.renderWithLayout("chapter.html", {
    ...headData,
    siteHeader,
    siteFooter,
    header,
    htmlContent,
    prevChapterLink,
    nextChapterLink,
    pdfLink,
    bookUrl: `/${book.slug}/`,
    bookName: escapeHtml(book.name),
    chapterTitle: escapeHtml(chapter.title),
    chapterSubtitle,
  });
}
