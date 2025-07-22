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
