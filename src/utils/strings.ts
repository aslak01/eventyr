export const safeString = (string: string): string =>
  string.replace(/"/g, "&quot;");
