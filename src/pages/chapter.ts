import { marked } from "marked";

import type { BookData, Chapter, OptimizedImage } from "../types/types";

import { processMarkdownImages } from "../image_processing/image";
import { htmlHead } from "../components/htmlHead";
import { safeString } from "../utils/strings";
import { headerGenerator } from "../components/header";

export function generateChapterHTML(
  book: BookData,
  chapter: Chapter,
  optimizedImages: Map<string, OptimizedImage>,
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
  );

  const htmlContent = marked(processedContent);
  const chapters = book.chapters;

  const currentIndex = chapter.order;
  const prevChapter = currentIndex > 1 ? chapters[currentIndex - 1] : undefined;

  const nextChapter =
    currentIndex < chapters.length - 1
      ? book.chapters[currentIndex + 1]
      : undefined;

  const head = htmlHead(
    `${safeString(chapter.title)} - ${safeString(book.name)}`,
  );
  const header = headerGenerator(book);
  return `${head}
${header}

    <div class="content">
        ${htmlContent}
    </div>

    <div class="navigation">
        <div>
            ${prevChapter ? `<a href="/${book.slug}/${prevChapter.path}.html" class="nav-link">← ${prevChapter.title.replace(/"/g, "&quot;")}</a>` : "<span></span>"}
        </div>
        <div>
            <a href="/${book.slug}/" class="book-link">📚 Back to ${book.name}</a>
        </div>
        <div>
            ${nextChapter ? `<a href="/${book.slug}/${nextChapter.path}.html" class="nav-link">${nextChapter.title.replace(/"/g, "&quot;")} →</a>` : "<span></span>"}
        </div>
    </div>
</body>
</html>`;
}
