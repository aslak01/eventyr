import { serve } from "bun";
import { join } from "path";

const PORT = 3000;

function server() {
  return serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      let path = decodeURIComponent(url.pathname);

      console.log("Requested path:", path);

      if (path.includes("..")) {
        return new Response("Forbidden", { status: 403 });
      }

      if (path.endsWith("/")) {
        path = path + "index.html";
      }

      if (path === "") {
        path = "/index.html";
      }

      const filePath = join(import.meta.dir, "dist", path);
      console.log("Serving file:", filePath);

      const file = Bun.file(filePath);

      if (await file.exists()) {
        console.log("✅ File found, serving:", path);
        return new Response(file);
      }

      console.log("❌ File not found:", path);

      const indexFile = Bun.file(join(import.meta.dir, "dist", "index.html"));
      if (await indexFile.exists()) {
        console.log("📄 Serving fallback index.html");
        return new Response(indexFile);
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}

server();

console.log(`🌐 Server running on http://localhost:${PORT}`);
console.log(
  'Make sure to run "bun run build" first to generate the dist folder',
);
