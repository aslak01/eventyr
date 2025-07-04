import { serve, type Server } from "bun";
import { join, extname, basename } from "path";
import { marked } from "marked";
import { readdir, stat } from "fs/promises";

// Types
interface Chapter {
  name: string;
  title: string;
  content: string;
  path: string;
}

interface BookData {
  name: string;
  path: string;
  chapters: Chapter[];
}

interface RequestContext {
  request: Request;
  params: Record<string, string>;
  query: Record<string, string>;
  url: URL;
  method: string;
  path: string;
}

type RouteHandler = (ctx: RequestContext) => Response | Promise<Response>;
type Middleware = (request: Request) => Response | Promise<Response | void> | void;

interface RouterState {
  routes: Map<string, RouteHandler>;
  bookStructure: Map<string, BookData>;
  middlewares: Middleware[];
  booksDir: string;
}

// Configure marked for better rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false
});

// Create initial router state
function createRouter(booksDir = "./src/lib/books"): RouterState {
  return {
    routes: new Map(),
    bookStructure: new Map(),
    middlewares: [],
    booksDir
  };
}

// Add middleware
function addMiddleware(state: RouterState, middleware: Middleware): RouterState {
  return {
    ...state,
    middlewares: [...state.middlewares, middleware]
  };
}

// Load all books and generate routes
async function loadBooks(state: RouterState): Promise<RouterState> {
  const booksPath = join(process.cwd(), state.booksDir);

  try {
    // Check if books directory exists
    let exists = false;
    try {
      await readdir(booksPath);
      exists = true;
    } catch {
      console.log(`📁 Books directory not found: ${booksPath}`);
      console.log(`Please create the directory and add some books!`);
      return state;
    }

    const entries = await readdir(booksPath);

    let newState = { ...state };

    for (const entry of entries) {
      const bookPath = join(booksPath, entry);

      try {
        const stats = await stat(bookPath);

        if (stats.isDirectory()) {
          // Get markdown files in this directory
          const mdFiles = await readdir(bookPath);
          const markdownFiles = mdFiles.filter(file => file.endsWith('.md'));

          if (markdownFiles.length > 0) {
            newState = await registerBook(newState, entry, bookPath, markdownFiles);
          }
        }
      } catch (e) {
        // Skip files/directories we can't access
        continue;
      }
    }

    return newState;
  } catch (error) {
    console.error("Error loading books:", error);
    return state;
  }
}

// Register a book and its markdown files
async function registerBook(
  state: RouterState,
  bookName: string,
  bookPath: string,
  mdFiles: string[]
): Promise<RouterState> {
  console.log(`📚 Registering book: ${bookName}`);

  const bookData: BookData = {
    name: bookName,
    path: bookPath,
    chapters: []
  };

  // Sort markdown files for consistent ordering
  const sortedFiles = mdFiles.sort();
  const newRoutes = new Map(state.routes);

  // Read each markdown file
  for (const mdFile of sortedFiles) {
    const filePath = join(bookPath, mdFile);
    const chapterName = basename(mdFile, '.md');

    try {
      const fileContent = await Bun.file(filePath).text();

      // Extract title from first heading or use filename
      const titleMatch = fileContent.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1] : chapterName.replace(/[-_]/g, ' ');

      bookData.chapters.push({
        name: chapterName,
        title: title,
        content: fileContent,
        path: `/${encodeURIComponent(bookName)}/${encodeURIComponent(chapterName)}`
      });

      // Register route for individual chapter
      const routeKey = `GET:/${bookName}/${chapterName}`;
      newRoutes.set(routeKey, (ctx) => renderMarkdown(bookData, chapterName, ctx));

      console.log(`  📄 Added chapter: ${chapterName} -> ${title}`);
    } catch (error) {
      console.error(`Error reading ${mdFile}:`, error);
    }
  }

  // Register book index route
  const indexKey = `GET:/${bookName}`;
  newRoutes.set(indexKey, (ctx) => renderBookIndex(bookData, ctx));

  console.log(`  🏠 Added book index: /${bookName}`);

  // Update state with new book and routes
  const newBookStructure = new Map(state.bookStructure);
  newBookStructure.set(bookName, bookData);

  return {
    ...state,
    routes: newRoutes,
    bookStructure: newBookStructure
  };
}

// Serve static images from book directories
async function serveImage(state: RouterState, bookName: string, imagePath: string): Promise<Response | null> {
  const book = state.bookStructure.get(bookName);
  if (!book) return null;

  const imageFilePath = join(book.path, imagePath);

  try {
    const imageFile = Bun.file(imageFilePath);
    if (await imageFile.exists()) {
      const ext = extname(imagePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
      };

      return new Response(imageFile, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    }
  } catch (error) {
    console.error(`Error serving image ${imageFilePath}:`, error);
  }

  return null;
}

// Render book index page
function renderBookIndex(bookData: BookData, ctx: RequestContext): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bookData.name}</title>
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
        <h1 class="book-title">${bookData.name.replace(/[-_]/g, ' ')}</h1>
        <p>${bookData.chapters.length} chapter${bookData.chapters.length !== 1 ? 's' : ''}</p>
    </div>
    
    <ul class="chapters">
        ${bookData.chapters.map(chapter => `
            <li class="chapter-item">
                <a href="${chapter.path}" class="chapter-link">${chapter.title}</a>
            </li>
        `).join('')}
    </ul>
    
    <div class="nav">
        <a href="/">← Back to all books</a>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Render individual markdown chapter
function renderMarkdown(bookData: BookData, chapterName: string, ctx: RequestContext): Response {
  const chapter = bookData.chapters.find(ch => ch.name === chapterName);

  if (!chapter) {
    return new Response('Chapter not found', { status: 404 });
  }

  // Convert markdown to HTML
  const htmlContent = marked(chapter.content);

  // Find current chapter index for navigation
  const currentIndex = bookData.chapters.findIndex(ch => ch.name === chapterName);
  const prevChapter = currentIndex > 0 ? bookData.chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < bookData.chapters.length - 1 ? bookData.chapters[currentIndex + 1] : null;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${chapter.title} - ${bookData.name}</title>
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
        .content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            margin: 1rem 0;
            display: block;
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
        .nav-link:disabled {
            color: #ccc;
            border-color: #ccc;
            cursor: not-allowed;
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
        <p class="book-name">${bookData.name.replace(/[-_]/g, ' ')}</p>
        <h1 class="chapter-title">${chapter.title}</h1>
    </div>
    
    <div class="content">
        ${htmlContent}
    </div>
    
    <div class="navigation">
        <div>
            ${prevChapter ? `<a href="${prevChapter.path}" class="nav-link">← ${prevChapter.title}</a>` : '<span></span>'}
        </div>
        <div>
            <a href="/${encodeURIComponent(bookData.name)}" class="book-link">📚 Back to ${bookData.name}</a>
        </div>
        <div>
            ${nextChapter ? `<a href="${nextChapter.path}" class="nav-link">${nextChapter.title} →</a>` : '<span></span>'}
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Render main index with all books
function renderMainIndex(state: RouterState): Response {
  const books = Array.from(state.bookStructure.values());

  const html = `
<!DOCTYPE html>
<html lang="en">
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
                <a href="/${encodeURIComponent(book.name)}" class="book-link">
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

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Match route with parameters
function matchRoute(state: RouterState, method: string, path: string): { handler: RouteHandler; params: Record<string, string> } | null {
  // Decode URL components to handle special characters
  const decodedPath = decodeURIComponent(path);

  // Try exact match first with decoded path
  const exactKey = `${method}:${decodedPath}`;
  if (state.routes.has(exactKey)) {
    return { handler: state.routes.get(exactKey)!, params: {} };
  }

  // Also try with original path for backwards compatibility
  const originalKey = `${method}:${path}`;
  if (state.routes.has(originalKey)) {
    return { handler: state.routes.get(originalKey)!, params: {} };
  }

  return null;
}

// Main request handler
async function handleRequest(state: RouterState, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  // Decode the pathname to handle special characters properly
  const path = decodeURIComponent(url.pathname);

  // Apply middlewares
  for (const middleware of state.middlewares) {
    const result = await middleware(request);
    if (result instanceof Response) {
      return result;
    }
  }

  // Handle static image files
  const imageMatch = path.match(/^\/([^\/]+)\/(.+\.(png|jpg|jpeg|gif|svg|webp))$/i);
  if (imageMatch && method === 'GET') {
    const [, bookName, imagePath] = imageMatch;
    const response = await serveImage(state, bookName, imagePath);
    if (response) return response;
  }

  // Handle root path - show all books
  if (path === '/') {
    return renderMainIndex(state);
  }

  // Find matching route
  const match = matchRoute(state, method, path);

  if (!match) {
    return new Response('Page not found', { status: 404 });
  }

  try {
    // Create request context
    const context: RequestContext = {
      request,
      params: match.params,
      query: Object.fromEntries(url.searchParams),
      url,
      method,
      path
    };

    // Call route handler
    return await match.handler(context);
  } catch (error) {
    console.error('Route handler error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Start the server
async function listen(state: RouterState, port = 3000): Promise<Server> {
  const loadedState = await loadBooks(state);

  const server = serve({
    port,
    fetch: (request) => handleRequest(loadedState, request),
  });

  console.log(`🚀 Book server running on http://localhost:${port}`);
  console.log(`📖 Serving books from: ${state.booksDir}`);
  return server;
}

// Main function to create and start the router
async function createBookRouter(booksDir = "./src/lib/books", port = 3000): Promise<Server> {
  let router = createRouter(booksDir);

  // Add logging middleware
  router = addMiddleware(router, async (request) => {
    const url = new URL(request.url);
    console.log(`${request.method} ${url.pathname}`);
  });

  // Start server
  return listen(router, port);
}

// Export the main function
export { createBookRouter, createRouter, addMiddleware, loadBooks, listen };
export type { RouterState, Middleware, RequestContext, BookData, Chapter };

// Auto-start if this is the main module
if (import.meta.main) {
  createBookRouter('./src/lib/books', 3000);
}
