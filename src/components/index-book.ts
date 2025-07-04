import type { BookData } from "../types/types";

export function generateBookIndexHTML(book: BookData): string {
    return `<!DOCTYPE html>
<html lang="nb-NO">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${book.name}</title>
    <link rel="stylesheet" href="/css/book_index.css">
</head>
<body>
    <div class="header">
        <h1 class="book-title">${book.name.replace(/[-_]/g, ' ')}</h1>
        <p>${book.chapters.length} chapter${book.chapters.length !== 1 ? 's' : ''}</p>
    </div>
    
    <ul class="chapters">
        ${book.chapters.map(chapter => `
            <li class="chapter-item">
                <a href="/${book.name}/${chapter.name}.html" class="chapter-link">${chapter.title}</a>
            </li>
        `).join('')}
    </ul>
    
    <div class="nav">
        <a href="/">← Back to all books</a>
    </div>
</body>
</html>`;
}


