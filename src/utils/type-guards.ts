import type {
  AgeRating,
  BookData,
  BookInfo,
  Chapter,
  ChapterMeta,
  OptimizedImage,
} from "../types/types.ts";

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isArray<T>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T,
): value is T[] {
  if (!Array.isArray(value)) return false;
  if (!itemGuard) return true;
  return value.every(itemGuard);
}

export function isStringArray(value: unknown): value is string[] {
  return isArray(value, isString);
}

export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

export function isValidAgeRating(value: unknown): value is AgeRating {
  return value === 3 || value === 5 || value === 7 || value === 9;
}

export function isValidChapterMeta(value: unknown): value is ChapterMeta {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isNonEmptyString(obj.title) && isValidAgeRating(obj.ageRating);
}

export function isValidChapterIndexEntry(
  value: unknown,
): value is string | ChapterMeta {
  return isNonEmptyString(value) || isValidChapterMeta(value);
}

export function isValidBookInfo(value: unknown): value is BookInfo {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    isNonEmptyString(obj.title) &&
    isStringArray(obj.author) &&
    isNumber(obj.published) &&
    obj.published > 0 &&
    isStringArray(obj.illustrator) &&
    typeof obj.chapter_index === "object" &&
    obj.chapter_index !== null &&
    Object.keys(obj.chapter_index).length > 0 &&
    Object.entries(obj.chapter_index).every(
      ([key, value]) =>
        isNonEmptyString(key) && isValidChapterIndexEntry(value),
    )
  );
}

export function isValidChapter(value: unknown): value is Chapter {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    isNonEmptyString(obj.title) &&
    isString(obj.content) &&
    isNonEmptyString(obj.path) &&
    isNonEmptyString(obj.htmlPath) &&
    isNumber(obj.wordCount) &&
    obj.wordCount >= 0 &&
    isNonEmptyString(obj.book) &&
    isNonEmptyString(obj.bookSlug) &&
    isNumber(obj.order) &&
    obj.order >= 0 &&
    (obj.pdfPath === undefined || isString(obj.pdfPath)) &&
    (obj.pdfSourcePath === undefined || isString(obj.pdfSourcePath)) &&
    (obj.subtitle === undefined || isString(obj.subtitle)) &&
    (obj.ageRating === undefined || isValidAgeRating(obj.ageRating))
  );
}

export function isValidBookData(value: unknown): value is BookData {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    isNonEmptyString(obj.name) &&
    isNonEmptyString(obj.slug) &&
    isNonEmptyString(obj.path) &&
    isArray(obj.chapters, isValidChapter) &&
    isStringArray(obj.author) &&
    obj.author.length > 0 &&
    isNumber(obj.published) &&
    obj.published > 0
  );
}

export function isValidOptimizedImage(value: unknown): value is OptimizedImage {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    isNonEmptyString(obj.originalPath) &&
    isNonEmptyString(obj.webpPath) &&
    isNonEmptyString(obj.avifPath) &&
    isArray(obj.sizes) &&
    isNumber(obj.width) &&
    obj.width > 0 &&
    isNumber(obj.height) &&
    obj.height > 0
  );
}

export function assertIsString(
  value: unknown,
  name: string,
): asserts value is string {
  if (!isString(value)) {
    throw new Error(`Expected ${name} to be a string, got ${typeof value}`);
  }
}

export function assertIsNonEmptyString(
  value: unknown,
  name: string,
): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`Expected ${name} to be a non-empty string`);
  }
}

export function assertIsNumber(
  value: unknown,
  name: string,
): asserts value is number {
  if (!isNumber(value)) {
    throw new Error(`Expected ${name} to be a number, got ${typeof value}`);
  }
}
