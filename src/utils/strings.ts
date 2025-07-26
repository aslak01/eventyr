export const safeString = (string: string): string =>
  string.replace(/"/g, "&quot;");

export function joinAuthors(arr: string[]) {
  if (arr.length <= 1) {
    return arr[0] || "";
  } else if (arr.length === 2) {
    return arr.join(" og ");
  } else {
    return arr.slice(0, -1).join(", ") + " og " + arr[arr.length - 1];
  }
}

export function getWordCount(chapter: string): number {
  return (
    chapter
      ?.replace(/!\[[^\]]*\]\([^)]*\)/g, "") // Remove markdown images
      ?.replace(/\n/g, " ") // Replace newlines with spaces
      .trim()
      .split(/\s+/) // Split on any whitespace
      .filter((word) => word.length > 0)?.length || 0
  );
}
