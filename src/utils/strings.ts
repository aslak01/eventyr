export const safeString = (string: string): string =>
  string.replace(/"/g, "&quot;");

export function joinAuthors(authors: string[]): string {
  const { length } = authors;
  if (length <= 1) return authors[0] || "";
  if (length === 2) return authors.join(" og ");
  return `${authors.slice(0, -1).join(", ")} og ${authors[length - 1]}`;
}

export function getWordCount(text: string): number {
  if (!text?.trim()) return 0;

  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // Remove markdown images
    .replace(/\n+/g, " ") // Replace newlines with single space
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
