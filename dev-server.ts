import { watch } from "fs";
import { serve } from "bun";
import { join } from "path";
import { spawn } from "child_process";
import { debounce } from "./src/utils/debounce.ts";

const PORT = 3000;
const REBUILD_DELAY = 300; // ms

// Store connected clients for live reload
const clients = new Set<ReadableStreamDefaultController>();

async function runBuild(): Promise<void> {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn("bun", ["run", "static-generator.ts"], {
      stdio: ["inherit", "inherit", "inherit"],
      cwd: process.cwd()
    });

    buildProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build process exited with code ${code}`));
      }
    });

    buildProcess.on("error", (error) => {
      reject(error);
    });
  });
}

const debouncedBuild = debounce(async () => {
  const buildStart = Date.now();
  console.log("🔄 Rebuilding (fresh process)...");
  try {
    await runBuild();
    const buildTime = Date.now() - buildStart;
    console.log(`✅ Rebuild complete (${buildTime}ms)`);
    
    // Small delay to ensure files are written
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Notify all connected clients to reload
    console.log(`📡 Notifying ${clients.size} connected clients`);
    for (const client of clients) {
      try {
        client.enqueue("data: reload\n\n");
      } catch {
        // Client disconnected, remove it
        clients.delete(client);
      }
    }
  } catch (error) {
    console.error("❌ Build failed:", error);
    console.error(error);
  }
}, REBUILD_DELAY);

// Watch for changes
const watchPaths = [
  "./src",
  "./static-generator.ts",
  "./load-books.ts"
];

console.log("👀 Setting up file watchers...");

watchPaths.forEach(path => {
  console.log(`  🔍 Watching: ${path}`);
  watch(path, { recursive: true }, (eventType, filename) => {
    if (filename) {
      const shouldRebuild = filename.endsWith('.ts') || 
                           filename.endsWith('.css') || 
                           filename.endsWith('.md') || 
                           filename.endsWith('.json');
      
      console.log(`📂 File event: ${filename} (${eventType}) - Will rebuild: ${shouldRebuild}`);
      
      if (shouldRebuild) {
        console.log(`🔄 Triggering rebuild for: ${filename}`);
        debouncedBuild();
      }
    } else {
      console.log(`📂 File event with no filename (${eventType})`);
    }
  });
});

// Initial build
console.log("🏗️  Running initial build...");
await runBuild();

// Start development server
const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);

    // Handle Server-Sent Events for live reload
    if (path === "/dev-reload") {
      return new Response(
        new ReadableStream({
          start(controller) {
            clients.add(controller);
            controller.enqueue("data: connected\n\n");
            
            // Keep connection alive with periodic pings
            const interval = setInterval(() => {
              try {
                controller.enqueue("data: ping\n\n");
              } catch {
                clearInterval(interval);
                clients.delete(controller);
              }
            }, 30000);
          },
          cancel() {
            clients.delete(this as any);
          }
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Security check
    if (path.includes("..")) {
      return new Response("Forbidden", { status: 403 });
    }

    // Handle directory requests
    if (path.endsWith("/")) {
      path = path + "index.html";
    }

    if (path === "") {
      path = "/index.html";
    }

    const filePath = join(import.meta.dir, "dist", path);
    console.log("📄 Serving:", path);

    const file = Bun.file(filePath);

    if (await file.exists()) {
      let response = new Response(file);
      
      // Inject live reload script into HTML responses
      if (path.endsWith(".html")) {
        const html = await file.text();
        const htmlWithLiveReload = html.replace(
          '</body>',
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
</body>`
        );
        response = new Response(htmlWithLiveReload, {
          headers: {
            "Content-Type": "text/html",
          },
        });
      }
      
      console.log("✅ File served:", path);
      return response;
    }

    console.log("❌ File not found:", path);

    // Fallback to index.html for SPA routing
    const indexFile = Bun.file(join(import.meta.dir, "dist", "index.html"));
    if (await indexFile.exists()) {
      console.log("📄 Serving fallback index.html");
      const html = await indexFile.text();
      const htmlWithLiveReload = html.replace(
        '</body>',
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
</body>`
      );
      return new Response(htmlWithLiveReload, {
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🌐 Development server running on http://localhost:${PORT}`);
console.log(`🔄 Live reload enabled - changes to .ts, .css, .md, and .json files will trigger rebuilds`);