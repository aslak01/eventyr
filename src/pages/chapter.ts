import { marked } from "marked";

import type { BookData, Chapter, OptimizedImage } from "../types/types";

import { processMarkdownImages } from "../image_processing/image";
import { htmlHead } from "../components/htmlHead";
import { safeString } from "../utils/strings";

export function generateChapterHTML(
  book: BookData,
  chapter: Chapter,
  optimizedImages: Map<string, OptimizedImage>,
): string {
  const processedContent = processMarkdownImages(
    chapter.content,
    book.slug,
    optimizedImages,
    chapter.path,
  );
  const htmlContent = marked(processedContent);

  const currentIndex = book.chapters.findIndex(
    (ch) => ch.name === chapter.name,
  );
  const prevChapter = currentIndex > 0 ? book.chapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex < book.chapters.length - 1
      ? book.chapters[currentIndex + 1]
      : null;

  const safeTitle = safeString(chapter.title);

  const head = htmlHead(`${safeTitle} - ${safeString(book.name)}`, ["chapter"]);
  return `${head}
    <div class="header">
        <p class="book-name">${book.name.replace(/[-_]/g, " ")}</p>
        <h1 class="chapter-title">${safeTitle}</h1>
    </div>

    <div class="content">
        ${htmlContent}
    </div>

    <div class="navigation">
        <div>
            ${prevChapter ? `<a href="/${book.name}/${prevChapter.name}.html" class="nav-link">← ${prevChapter.title.replace(/"/g, "&quot;")}</a>` : "<span></span>"}
        </div>
        <div>
            <a href="/${book.name}/" class="book-link">📚 Back to ${book.name}</a>
        </div>
        <div>
            ${nextChapter ? `<a href="/${book.name}/${nextChapter.name}.html" class="nav-link">${nextChapter.title.replace(/"/g, "&quot;")} →</a>` : "<span></span>"}
        </div>
    </div>
</body>
</html>`;
}
