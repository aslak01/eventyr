import type { BookData } from "../types/types";

export function generateMainIndexHTML(books: BookData[]): string {
    return `<!DOCTYPE html>
<html lang="nb-NO">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Book Library</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
        }
        .main-title {
            font-size: 3rem;
            margin: 0;
            color: #2c3e50;
        }
        .subtitle {
            color: #666;
            font-size: 1.1rem;
            margin-top: 0.5rem;
        }
        .books-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }
        .book-card {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            border: 1px solid #e1e8ed;
        }
        .book-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        .book-title {
            font-size: 1.5rem;
            margin: 0 0 1rem 0;
            color: #2c3e50;
        }
        .book-link {
            text-decoration: none;
            color: inherit;
        }
        .book-meta {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 1rem;
        }
        .chapter-preview {
            margin-top: 1rem;
        }
        .chapter-preview h4 {
            margin: 0 0 0.5rem 0;
            font-size: 0.9rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .chapter-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .chapter-list li {
            font-size: 0.9rem;
            color: #666;
            margin: 0.25rem 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="main-title">📚 Book Library</h1>
        <p class="subtitle">${books.length} book${books.length !== 1 ? 's' : ''} available</p>
    </div>
    
    <div class="books-grid">
        ${books.map(book => `
            <div class="book-card">
                <a href="/${book.name}/" class="book-link">
                    <h2 class="book-title">${book.name.replace(/[-_]/g, ' ')}</h2>
                </a>
                <div class="book-meta">
                    ${book.chapters.length} chapter${book.chapters.length !== 1 ? 's' : ''}
                </div>
                <div class="chapter-preview">
                    <h4>Chapters:</h4>
                    <ul class="chapter-list">
                        ${book.chapters.slice(0, 5).map(chapter => `
                            <li>• ${chapter.title}</li>
                        `).join('')}
                        ${book.chapters.length > 5 ? `<li>• ... and ${book.chapters.length - 5} more</li>` : ''}
                    </ul>
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
}

