import { watch } from "fs";
import { serve } from "bun";
import { join } from "path";
import { spawn } from "child_process";
import { debounce } from "./src/utils/debounce.ts";
import { logger } from "./src/utils/logger.ts";
import { getConfig } from "./src/utils/config.ts";
import {
  validatePath,
  validateFileExtension,
  ValidationError,
} from "./src/utils/validation.ts";

const config = getConfig();

// Connected live reload clients, each with the keep-alive timer to clear
// when it disconnects
const clients = new Map<ReadableStreamDefaultController, Timer>();

const PING_INTERVAL = 30000;

function removeClient(controller: ReadableStreamDefaultController): void {
  clearInterval(clients.get(controller));
  clients.delete(controller);
}

// Sends an event, dropping the client if its stream has closed
function sendEvent(
  controller: ReadableStreamDefaultController,
  data: string,
): void {
  try {
    controller.enqueue(`data: ${data}\n\n`);
  } catch {
    removeClient(controller);
    logger.debug("Removed disconnected client", { totalClients: clients.size });
  }
}

const liveReloadScript = `  <script>
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
</body>`;

async function htmlResponse(file: ReturnType<typeof Bun.file>) {
  let html = await file.text();
  if (config.server.enableLiveReload) {
    html = html.replace("</body>", liveReloadScript);
  }
  return new Response(html, { headers: { "Content-Type": "text/html" } });
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
    // Copy the keys, since sendEvent may remove clients mid-iteration
    for (const client of Array.from(clients.keys())) {
      sendEvent(client, "reload");
    }
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

        let streamController: ReadableStreamDefaultController;
        return new Response(
          new ReadableStream({
            start(controller) {
              streamController = controller;
              clients.set(
                controller,
                setInterval(() => sendEvent(controller, "ping"), PING_INTERVAL),
              );
              sendEvent(controller, "connected");
              logger.debug("Client connected for live reload", {
                totalClients: clients.size,
              });
            },
            cancel() {
              removeClient(streamController);
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
        logger.debug("File served successfully", { path });
        return path.endsWith(".html") ? htmlResponse(file) : new Response(file);
      }

      logger.debug("File not found", { path });

      // Fallback to index.html for SPA routing
      const indexFile = Bun.file(join(distDir, "index.html"));
      if (await indexFile.exists()) {
        logger.debug("Serving fallback index.html");
        return htmlResponse(indexFile);
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
