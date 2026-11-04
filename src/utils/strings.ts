// Escapes text for use in HTML element content and double-quoted attributes
export const escapeHtml = (string: string): string =>
  string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function getWordCount(text: string): number {
  if (!text?.trim()) return 0;

  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // Remove markdown images
    .replace(/\n+/g, " ") // Replace newlines with single space
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
