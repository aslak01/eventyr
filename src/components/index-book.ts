import type { BookData } from "../types/types";

export function generateBookIndexHTML(book: BookData): string {
    return `<!DOCTYPE html>
<html lang="nb-NO">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${book.name}</title>
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
        .book-title {
            font-size: 2.5rem;
            margin: 0;
            color: #2c3e50;
        }
        .chapters {
            list-style: none;
            padding: 0;
        }
        .chapter-item {
            margin: 1rem 0;
            padding: 1rem;
            border: 1px solid #ddd;
            border-radius: 8px;
            transition: all 0.2s ease;
        }
        .chapter-item:hover {
            border-color: #3498db;
            box-shadow: 0 2px 8px rgba(52, 152, 219, 0.1);
        }
        .chapter-link {
            text-decoration: none;
            color: #3498db;
            font-size: 1.2rem;
            font-weight: 500;
        }
        .chapter-link:hover {
            color: #2980b9;
        }
        .nav {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
        }
        .nav a {
            color: #666;
            text-decoration: none;
        }
        .nav a:hover {
            color: #3498db;
        }
    </style>
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


