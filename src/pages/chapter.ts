import { marked } from "marked";

import type { BookData, Chapter, OptimizedImage } from "../types/types";
import type { createPathHelper } from "../utils/paths";

import { processMarkdownImages } from "../image_processing/image";
import { htmlHead } from "../components/htmlHead";
import { safeString } from "../utils/strings";
import { headerGenerator } from "../components/header";
import { templateEngine } from "../utils/template-engine";

type PathHelper = ReturnType<typeof createPathHelper>;

export function generateChapterHTML(
  book: BookData,
  chapter: Chapter,
  optimizedImages: Map<string, OptimizedImage>,
  pathHelper: PathHelper,
): string {
  const chapterDir = chapter.path.includes(".md")
    ? chapter.path.substring(0, chapter.path.lastIndexOf("/"))
    : chapter.path;

  // Construct full chapter path for image processing
  const fullChapterPath = `${book.path}/chapters/${chapterDir}`;

  const processedContent = processMarkdownImages(
    chapter.content,
    book.slug,
    optimizedImages,
    fullChapterPath,
    pathHelper,
  );

  const htmlContent = marked(processedContent);
  const chapters = book.chapters;

  const currentIndex = chapter.order;

  const prevChapter =
    currentIndex > 0 ? chapters[chapter.order - 1] : undefined;

  const nextChapter =
    currentIndex < chapters.length - 1
      ? book.chapters[currentIndex + 1]
      : undefined;

  const head = htmlHead(
    `${safeString(chapter.title)} - ${safeString(book.name)}`,
    pathHelper,
  );
  const header = headerGenerator(book, pathHelper);

  const prevChapterLink = prevChapter
    ? `<a href="${pathHelper.page(`/${book.slug}/${prevChapter.path}.html`)}" class="nav-link">← ${prevChapter.title.replace(/"/g, "&quot;")}</a>`
    : "<span></span>";

  const nextChapterLink = nextChapter
    ? `<a href="${pathHelper.page(`/${book.slug}/${nextChapter.path}.html`)}" class="nav-link">${nextChapter.title.replace(/"/g, "&quot;")} →</a>`
    : "<span></span>";

  return templateEngine.render("chapter.html", {
    head,
    header,
    htmlContent,
    prevChapterLink,
    nextChapterLink,
    bookUrl: pathHelper.page(`/${book.slug}/`),
    bookName: book.name,
  });
}
