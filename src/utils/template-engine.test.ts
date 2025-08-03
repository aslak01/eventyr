import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createTemplateEngine } from "./template-engine.ts";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const testTemplatesDir = "/tmp/test-templates";

describe("TemplateEngine", () => {
  beforeEach(() => {
    // Create test templates directory
    mkdirSync(testTemplatesDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test templates directory
    rmSync(testTemplatesDir, { recursive: true, force: true });
  });

  test("renders simple template with context", () => {
    // Create test template
    writeFileSync(join(testTemplatesDir, "test.html"), "<h1>{{title}}</h1><p>{{content}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.render("test.html", { title: "Hello", content: "World" });

    expect(result).toBe("<h1>Hello</h1><p>World</p>");
  });

  test("renders template without context", () => {
    writeFileSync(join(testTemplatesDir, "static.html"), "<h1>Static Content</h1>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.render("static.html");

    expect(result).toBe("<h1>Static Content</h1>");
  });

  test("leaves unmatched placeholders unchanged", () => {
    writeFileSync(join(testTemplatesDir, "partial.html"), "<h1>{{title}}</h1><p>{{missing}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.render("partial.html", { title: "Hello" });

    expect(result).toBe("<h1>Hello</h1><p>{{missing}}</p>");
  });

  test("handles nested properties", () => {
    writeFileSync(join(testTemplatesDir, "nested.html"), "<h1>{{user.name}}</h1><p>{{user.email}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.render("nested.html", { 
      user: { 
        name: "John Doe", 
        email: "john@example.com" 
      } 
    });

    expect(result).toBe("<h1>John Doe</h1><p>john@example.com</p>");
  });

  test("handles deep nested properties", () => {
    writeFileSync(join(testTemplatesDir, "deep.html"), "<span>{{config.database.host}}</span>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.render("deep.html", { 
      config: { 
        database: { 
          host: "localhost" 
        } 
      } 
    });

    expect(result).toBe("<span>localhost</span>");
  });

  test("renders with layout", () => {
    writeFileSync(join(testTemplatesDir, "layout.html"), 
      "<html><head><title>{{title}}</title></head><body>{{content}}</body></html>");
    writeFileSync(join(testTemplatesDir, "page.html"), "<h1>{{heading}}</h1><p>{{text}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.renderWithLayout("page.html", {
      title: "Test Page",
      heading: "Welcome",
      text: "Hello World"
    });

    expect(result).toBe(
      "<html><head><title>Test Page</title></head><body><h1>Welcome</h1><p>Hello World</p></body></html>"
    );
  });

  test("uses custom layout name", () => {
    writeFileSync(join(testTemplatesDir, "custom-layout.html"), 
      "<div class='wrapper'>{{content}}</div>");
    writeFileSync(join(testTemplatesDir, "content.html"), "<p>{{message}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.renderWithLayout("content.html", 
      { message: "Test" }, 
      "custom-layout.html"
    );

    expect(result).toBe("<div class='wrapper'><p>Test</p></div>");
  });

  test("caches templates", () => {
    writeFileSync(join(testTemplatesDir, "cached.html"), "<p>{{value}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    
    // First render
    const result1 = engine.render("cached.html", { value: "first" });
    expect(result1).toBe("<p>first</p>");

    // Modify file on disk (should not affect cached version)
    writeFileSync(join(testTemplatesDir, "cached.html"), "<h1>{{value}}</h1>");

    // Second render should use cached version
    const result2 = engine.render("cached.html", { value: "second" });
    expect(result2).toBe("<p>second</p>");
  });

  test("clears cache", () => {
    writeFileSync(join(testTemplatesDir, "clearable.html"), "<p>{{value}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    
    // First render
    engine.render("clearable.html", { value: "first" });

    // Modify file and clear cache
    writeFileSync(join(testTemplatesDir, "clearable.html"), "<h1>{{value}}</h1>");
    engine.clearCache();

    // Should use new template
    const result = engine.render("clearable.html", { value: "second" });
    expect(result).toBe("<h1>second</h1>");
  });

  test("handles undefined nested properties gracefully", () => {
    writeFileSync(join(testTemplatesDir, "undefined.html"), "<p>{{user.missing.property}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.render("undefined.html", { user: {} });

    expect(result).toBe("<p>{{user.missing.property}}</p>");
  });

  test("converts non-string values to strings", () => {
    writeFileSync(join(testTemplatesDir, "types.html"), 
      "<p>Number: {{num}}</p><p>Boolean: {{bool}}</p><p>Array: {{arr}}</p>");

    const engine = createTemplateEngine(testTemplatesDir);
    const result = engine.render("types.html", { 
      num: 42, 
      bool: true, 
      arr: [1, 2, 3] 
    });

    expect(result).toBe("<p>Number: 42</p><p>Boolean: true</p><p>Array: 1,2,3</p>");
  });
});