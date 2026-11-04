import { test, expect, describe } from "bun:test";
import { escapeHtml, getWordCount } from "./strings.ts";

describe("escapeHtml", () => {
  test("escapes double quotes", () => {
    expect(escapeHtml('Hello "world"')).toBe("Hello &quot;world&quot;");
  });

  test("escapes ampersands and angle brackets", () => {
    expect(escapeHtml("Per & Pål <i>")).toBe("Per &amp; Pål &lt;i&gt;");
  });

  test("does not double-escape when ampersand comes first", () => {
    expect(escapeHtml('"&"')).toBe("&quot;&amp;&quot;");
  });

  test("returns unchanged string with no special characters", () => {
    expect(escapeHtml("Hello world")).toBe("Hello world");
  });

  test("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("getWordCount", () => {
  test("counts words in simple text", () => {
    expect(getWordCount("Hello world test")).toBe(3);
  });

  test("handles empty string", () => {
    expect(getWordCount("")).toBe(0);
  });

  test("handles null/undefined", () => {
    expect(getWordCount(null as any)).toBe(0);
    expect(getWordCount(undefined as any)).toBe(0);
  });

  test("handles whitespace-only string", () => {
    expect(getWordCount("   \n\t  ")).toBe(0);
  });

  test("removes markdown images and counts words", () => {
    const text = "Hello ![alt text](image.png) world ![another](test.jpg) test";
    expect(getWordCount(text)).toBe(3); // "Hello", "world", "test" (3 words, not 4)
  });

  test("handles multiple newlines", () => {
    expect(getWordCount("Hello\n\n\nworld\ntest")).toBe(3);
  });

  test("handles mixed whitespace", () => {
    expect(getWordCount("  Hello   world  \n  test  ")).toBe(3);
  });

  test("counts Norwegian text correctly", () => {
    expect(getWordCount("Dette er en norsk tekst")).toBe(5);
  });

  test("handles text with punctuation", () => {
    expect(getWordCount("Hello, world! How are you?")).toBe(5);
  });
});
