import { watch } from "fs";
import { serve } from "bun";
import { join } from "path";
import { spawn } from "child_process";
import { debounce } from "./src/utils/debounce.ts";
import { logger } from "./src/utils/logger.ts";
import { getConfig } from "./src/utils/config.ts";
import {
  validatePath,
  validateBookSlug,
  validatePdfFilename,
  validateFileExtension,
  ValidationError,
} from "./src/utils/validation.ts";
import { isNonEmptyString } from "./src/utils/type-guards.ts";

const config = getConfig();

// Store connected clients for live reload with cleanup
const clients = new Set<ReadableStreamDefaultController>();

const CLIENT_CLEANUP_INTERVAL = 30000;

interface ClientConnection {
  controller: ReadableStreamDefaultController;
  lastPing: number;
}

async function runBuild(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.debug("Starting build process");

    const buildProcess = spawn("bun", ["run", "static-generator.ts"], {
      stdio: ["inherit", "inherit", "inherit"],
      cwd: process.cwd(),
    });

    buildProcess.on("close", (code) => {
      if (code === 0) {
        logger.debug("Build process completed successfully");
        resolve();
      } else {
        const error = new Error(`Build process exited with code ${code}`);
        logger.error("Build process failed", { exitCode: code });
        reject(error);
      }
    });

    buildProcess.on("error", (error) => {
      logger.error("Build process error", { error: error.message });
      reject(error);
    });
  });
}

const debouncedBuild = debounce(async () => {
  const buildStart = Date.now();
  logger.info("Rebuilding (fresh process)...");

  try {
    await runBuild();
    const buildTime = Date.now() - buildStart;
    logger.info("Rebuild complete", { buildTimeMs: buildTime });

    // Small delay to ensure files are written
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Notify all connected clients to reload
    logger.debug("Notifying connected clients", { clientCount: clients.size });
    const disconnectedClients: ReadableStreamDefaultController[] = [];

    for (const client of clients) {
      try {
        client.enqueue("data: reload\n\n");
      } catch (error) {
        logger.debug("Client disconnected during notification", {
          error: error instanceof Error ? error.message : String(error),
        });
        disconnectedClients.push(client);
      }
    }

    // Clean up disconnected clients
    disconnectedClients.forEach((client) => clients.delete(client));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Build failed", { error: errorMessage });
  }
}, config.server.rebuildDelay);

// Watch for changes
logger.info("Setting up file watchers");

config.server.watchPaths.forEach((path) => {
  logger.debug("Watching path", { path });
  watch(path, { recursive: true }, (eventType, filename) => {
    try {
      if (filename) {
        const shouldRebuild =
          filename.endsWith(".ts") ||
          filename.endsWith(".css") ||
          filename.endsWith(".md") ||
          filename.endsWith(".json") ||
          filename.endsWith(".html");

        logger.debug("File event", { filename, eventType, shouldRebuild });

        if (shouldRebuild) {
          logger.debug("Triggering rebuild", { filename });
          debouncedBuild();
        }
      } else {
        logger.debug("File event with no filename", { eventType });
      }
    } catch (error) {
      logger.error("Error handling file watch event", {
        error: error instanceof Error ? error.message : String(error),
        eventType,
        filename,
      });
    }
  });
});

// Periodic client cleanup
setInterval(() => {
  const now = Date.now();
  const staleClients: ReadableStreamDefaultController[] = [];

  for (const client of clients) {
    try {
      client.enqueue("data: ping\n\n");
    } catch {
      staleClients.push(client);
    }
  }

  staleClients.forEach((client) => {
    clients.delete(client);
    logger.debug("Removed stale client connection");
  });

  if (staleClients.length > 0) {
    logger.debug("Client cleanup completed", {
      removedCount: staleClients.length,
      activeCount: clients.size,
    });
  }
}, CLIENT_CLEANUP_INTERVAL);

// Initial build
logger.info("Running initial build");
try {
  await runBuild();
  logger.info("Initial build completed successfully");
} catch (error) {
  logger.error("Initial build failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

// Start development server
serve({
  port: config.server.port,
  async fetch(req) {
    const url = new URL(req.url);
    try {
      let path = decodeURIComponent(url.pathname);

      logger.debug("Request received", { method: req.method, path });

      // Handle Server-Sent Events for live reload
      if (path === "/dev-reload") {
        if (!config.server.enableLiveReload) {
          return new Response("Live reload disabled", { status: 404 });
        }

        return new Response(
          new ReadableStream({
            start(controller) {
              clients.add(controller);
              controller.enqueue("data: connected\n\n");
              logger.debug("Client connected for live reload", {
                totalClients: clients.size,
              });

              // Keep connection alive with periodic pings
              const interval = setInterval(() => {
                try {
                  controller.enqueue("data: ping\n\n");
                } catch (error) {
                  clearInterval(interval);
                  clients.delete(controller);
                  logger.debug("Client disconnected during ping", {
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }, 30000);
            },
            cancel() {
              clients.delete(this as any);
              logger.debug("Client connection cancelled", {
                totalClients: clients.size,
              });
            },
          }),
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      // Security and validation checks
      try {
        path = validatePath(path);
      } catch (error) {
        if (error instanceof ValidationError) {
          logger.warn("Invalid path request", {
            path: url.pathname,
            error: error.message,
          });
          return new Response("Bad Request", { status: 400 });
        }
        throw error;
      }

      // Handle PDF requests by serving directly from the books directory
      if (path.endsWith(".pdf")) {
        try {
          const segments = path.split("/").filter(Boolean);
          if (segments.length === 2) {
            const [bookSlug, pdfFilename] = segments;

            if (!isNonEmptyString(bookSlug) || !isNonEmptyString(pdfFilename)) {
              return new Response("Bad Request", { status: 400 });
            }

            // Validate inputs
            validateBookSlug(bookSlug);
            validatePdfFilename(pdfFilename);

            const chapterName = pdfFilename.replace(".pdf", "");
            const baseBooksDir = join(import.meta.dir, "src/lib/books");
            const pdfPath = validatePath(
              join(bookSlug, "chapters", chapterName, pdfFilename),
              baseBooksDir,
            );

            const pdfFile = Bun.file(pdfPath);
            if (await pdfFile.exists()) {
              logger.debug("Serving PDF", {
                path: pdfPath,
                bookSlug,
                filename: pdfFilename,
              });
              return new Response(pdfFile, {
                headers: {
                  "Content-Type": "application/pdf",
                  "Content-Disposition": `inline; filename="${pdfFilename}"`,
                },
              });
            } else {
              logger.debug("PDF not found", { path: pdfPath });
            }
          }
        } catch (error) {
          if (error instanceof ValidationError) {
            logger.warn("Invalid PDF request", { path, error: error.message });
            return new Response("Bad Request", { status: 400 });
          }
          logger.error("Error serving PDF", {
            path,
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response("Internal Server Error", { status: 500 });
        }
      }

      // Handle directory requests
      if (path.endsWith("/")) {
        path = path + "index.html";
      }

      if (path === "") {
        path = "/index.html";
      }

      // Validate file extension
      const filename = path.split("/").pop();
      if (filename && !validateFileExtension(filename)) {
        logger.warn("Blocked request for unsupported file type", {
          filename,
          path,
        });
        return new Response("Forbidden", { status: 403 });
      }

      const distDir = join(import.meta.dir, "dist");
      const filePath = validatePath(path, distDir);
      logger.debug("Serving file", { path });

      const file = Bun.file(filePath);

      if (await file.exists()) {
        let response = new Response(file);

        // Inject live reload script into HTML responses
        if (path.endsWith(".html") && config.server.enableLiveReload) {
          try {
            const html = await file.text();
            const htmlWithLiveReload = html.replace(
              "</body>",
              `  <script>
    console.log('🔄 Live reload enabled');
    const eventSource = new EventSource('/dev-reload');
    eventSource.onmessage = function(event) {
      if (event.data === 'reload') {
        console.log('🔄 Reloading page...');
        location.reload();
      }
    };
    eventSource.onerror = function(event) {
      console.log('❌ Live reload connection lost');
    };
  </script>
</body>`,
            );
            response = new Response(htmlWithLiveReload, {
              headers: {
                "Content-Type": "text/html",
              },
            });
          } catch (error) {
            logger.error("Error injecting live reload script", {
              path,
              error: error instanceof Error ? error.message : String(error),
            });
            // Serve original file if injection fails
          }
        }

        logger.debug("File served successfully", { path });
        return response;
      }

      logger.debug("File not found", { path });

      // Fallback to index.html for SPA routing
      const indexFile = Bun.file(join(import.meta.dir, "dist", "index.html"));
      if (await indexFile.exists()) {
        logger.debug("Serving fallback index.html");
        try {
          const html = await indexFile.text();
          let htmlContent = html;

          if (config.server.enableLiveReload) {
            htmlContent = html.replace(
              "</body>",
              `  <script>
    console.log('🔄 Live reload enabled');
    const eventSource = new EventSource('/dev-reload');
    eventSource.onmessage = function(event) {
      if (event.data === 'reload') {
        console.log('🔄 Reloading page...');
        location.reload();
      }
    };
    eventSource.onerror = function(event) {
      console.log('❌ Live reload connection lost');
    };
  </script>
</body>`,
            );
          }

          return new Response(htmlContent, {
            headers: {
              "Content-Type": "text/html",
            },
          });
        } catch (error) {
          logger.error("Error serving fallback index.html", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      logger.error("Unhandled error in request handler", {
        path: url.pathname,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});

logger.info("Development server running", {
  port: config.server.port,
  url: `http://localhost:${config.server.port}`,
  liveReload: config.server.enableLiveReload,
});

if (config.server.enableLiveReload) {
  logger.info(
    "Live reload enabled - changes to .ts, .css, .md, .json, and .html files will trigger rebuilds",
  );
}
