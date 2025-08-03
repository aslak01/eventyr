import { test, expect, describe } from "bun:test";
import { safeString, joinAuthors, getWordCount } from "./strings.ts";

describe("safeString", () => {
  test("escapes double quotes", () => {
    expect(safeString('Hello "world"')).toBe("Hello &quot;world&quot;");
  });

  test("returns unchanged string with no quotes", () => {
    expect(safeString("Hello world")).toBe("Hello world");
  });

  test("handles empty string", () => {
    expect(safeString("")).toBe("");
  });

  test("handles multiple quotes", () => {
    expect(safeString('"Hello" "world" "test"')).toBe("&quot;Hello&quot; &quot;world&quot; &quot;test&quot;");
  });
});

describe("joinAuthors", () => {
  test("returns single author unchanged", () => {
    expect(joinAuthors(["John Doe"])).toBe("John Doe");
  });

  test("returns empty string for empty array", () => {
    expect(joinAuthors([])).toBe("");
  });

  test("joins two authors with 'og'", () => {
    expect(joinAuthors(["John Doe", "Jane Smith"])).toBe("John Doe og Jane Smith");
  });

  test("joins three authors with comma and 'og'", () => {
    expect(joinAuthors(["John", "Jane", "Bob"])).toBe("John, Jane og Bob");
  });

  test("joins four authors correctly", () => {
    expect(joinAuthors(["John", "Jane", "Bob", "Alice"])).toBe("John, Jane, Bob og Alice");
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