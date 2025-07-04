import { marked } from "marked";

import type { BookData, Chapter, OptimizedImage } from "../types/types";

import { processMarkdownImages } from "../image_processing/image";

export function generateChapterHTML(book: BookData, chapter: Chapter, optimizedImages: Map<string, OptimizedImage>): string {
  const processedContent = processMarkdownImages(chapter.content, book.name, optimizedImages);
  const htmlContent = marked(processedContent);

  const currentIndex = book.chapters.findIndex(ch => ch.name === chapter.name);
  const prevChapter = currentIndex > 0 ? book.chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < book.chapters.length - 1 ? book.chapters[currentIndex + 1] : null;

  const safeTitle = chapter.title.replace(/"/g, '&quot;');
  const safeBookName = book.name.replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="nb-NO">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle} - ${safeBookName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
            color: #333;
        }
        .header {
            border-bottom: 2px solid #eee;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        .book-name {
            color: #666;
            font-size: 0.9rem;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .chapter-title {
            font-size: 2rem;
            margin: 0.5rem 0 0 0;
            color: #2c3e50;
        }
        .content {
            margin: 2rem 0;
        }
        .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            color: #2c3e50;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        .content h1 { font-size: 1.8rem; }
        .content h2 { font-size: 1.5rem; }
        .content h3 { font-size: 1.3rem; }
        .content p {
            margin: 1rem 0;
        }
        .content code {
            background: #f8f9fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 0.9rem;
        }
        .content pre {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
            border-left: 4px solid #3498db;
        }
        .content blockquote {
            border-left: 4px solid #ddd;
            margin: 1rem 0;
            padding-left: 1rem;
            color: #666;
        }
        .content img, .content picture {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            margin: 1rem 0;
            display: block;
        }
        .content picture img {
            margin: 0;
            box-shadow: none;
        }
        .navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #eee;
        }
        .nav-link {
            color: #3498db;
            text-decoration: none;
            padding: 0.5rem 1rem;
            border: 1px solid #3498db;
            border-radius: 4px;
            transition: all 0.2s ease;
        }
        .nav-link:hover {
            background: #3498db;
            color: white;
        }
        .book-link {
            color: #666;
            text-decoration: none;
        }
        .book-link:hover {
            color: #3498db;
        }
    </style>
</head>
<body>
    <div class="header">
        <p class="book-name">${book.name.replace(/[-_]/g, ' ')}</p>
        <h1 class="chapter-title">${safeTitle}</h1>
    </div>
    
    <div class="content">
        ${htmlContent}
    </div>
    
    <div class="navigation">
        <div>
            ${prevChapter ? `<a href="/${book.name}/${prevChapter.name}.html" class="nav-link">← ${prevChapter.title.replace(/"/g, '&quot;')}</a>` : '<span></span>'}
        </div>
        <div>
            <a href="/${book.name}/" class="book-link">📚 Back to ${book.name}</a>
        </div>
        <div>
            ${nextChapter ? `<a href="/${book.name}/${nextChapter.name}.html" class="nav-link">${nextChapter.title.replace(/"/g, '&quot;')} →</a>` : '<span></span>'}
        </div>
    </div>
</body>
</html>`;
}

