import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import markedHookFrontmatter from "marked-hook-frontmatter";
import markedSequentialHooks from "marked-sequential-hooks";

import type { BookData, Chapter, OptimizedImage } from "../types/types";

import { processMarkdownImages } from "../image_processing/image-simple";
import { htmlHead } from "../components/htmlHead";
import { siteHeaderGenerator } from "../components/siteHeader";
import { siteFooterGenerator } from "../components/siteFooter";
import { safeString } from "../utils/strings";
import { headerGenerator } from "../components/header";
import { templateEngine } from "../utils/template-engine";

export function generateChapterHTML(
  book: BookData,
  chapter: Chapter,
  optimizedImages: Map<string, OptimizedImage>,
): string {
  const chapterDir = chapter.path.includes(".md")
    ? chapter.path.substring(0, chapter.path.lastIndexOf("/"))
    : chapter.path;

  const fullChapterPath = `${book.path}/chapters/${chapterDir}`;

  const processedContent = processMarkdownImages(
    chapter.content,
    optimizedImages,
    fullChapterPath,
  );

  // Extract frontmatter and generate HTML
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

  const chapters = book.chapters;

  const currentIndex = chapter.order;

  const prevChapter =
    currentIndex > 0 ? chapters[chapter.order - 1] : undefined;

  const nextChapter =
    currentIndex < chapters.length - 1
      ? book.chapters[currentIndex + 1]
      : undefined;

  const headData = htmlHead(
    `${safeString(chapter.title)} - ${safeString(book.name)}`,
  );
  const header = headerGenerator(book, chapter);
  const siteHeader = siteHeaderGenerator();
  const siteFooter = siteFooterGenerator();

  const prevChapterLink = prevChapter
    ? `<a href="/${book.slug}/${prevChapter.path}.html" class="nav-link">← ${prevChapter.title.replace(/"/g, "&quot;")}</a>`
    : "<span></span>";

  const nextChapterLink = nextChapter
    ? `<a href="/${book.slug}/${nextChapter.path}.html" class="nav-link">${nextChapter.title.replace(/"/g, "&quot;")} →</a>`
    : "<span></span>";

  const pdfLink = chapter.pdfPath
    ? `<a href="${chapter.pdfPath}" class="pdf-link" target="_blank">📄 Les som PDF</a>`
    : "";

  const chapterSubtitle = frontmatterData.subtitle
    ? `<p class="chapter-subtitle">${safeString(frontmatterData.subtitle)}</p>`
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
    bookName: book.name,
    chapterTitle: safeString(chapter.title),
    chapterSubtitle,
  });
}
