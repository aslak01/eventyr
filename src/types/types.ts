export type Chapter = {
  title: string;
  content: string;
  path: string;
  htmlPath: string;
  wordCount: number;
  book: string;
  bookSlug: string;
  order: number;
  pdfPath?: string;
  pdfSourcePath?: string;
  subtitle?: string;
  ageRating?: AgeRating;
};

export type BookData = {
  name: string;
  slug: string;
  path: string;
  chapters: Chapter[];
  author: string[];
  published: number;
};

export type AgeRating = 3 | 5 | 7 | 9;

export type ChapterMeta = {
  title: string;
  ageRating: AgeRating;
};

export type BookInfo = {
  title: string;
  author: string[];
  published: number;
  illustrator: string[];
  chapter_index: Record<string, string | ChapterMeta>;
};

export type ImageSize = {
  width: number;
  path: string;
};

export type OptimizedImage = {
  originalPath: string;
  webpPath: string;
  avifPath: string;
  sizes: ImageSize[];
  width: number;
  height: number;
};

export type GeneratorConfig = {
  booksDir: string;
  distDir: string;
  imageSizes: number[];
  imageFormats: ("webp" | "avif" | "jpeg")[];
};

export type ImageCacheEntry = {
  contentHash: string;
  sizes: ImageSize[];
  webpPath: string;
  avifPath: string;
  width: number;
  height: number;
};

export type ImageCache = Record<string, ImageCacheEntry>;

export type ChapterLoadParams = {
  chapterDir: string;
  chapterTitle: string;
  order: number;
  chaptersPath: string;
  bookData: BookData;
  ageRating?: AgeRating;
};
