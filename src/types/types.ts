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
};

export type BookData = {
  name: string;
  slug: string;
  path: string;
  chapters: Chapter[];
  author: string[];
  published: number;
};

export type BookInfo = {
  title: string;
  author: string[];
  published: number;
  illustrator: string[];
  chapter_index: Record<string, string>;
};

export type OptimizedImage = {
  originalPath: string;
  webpPath: string;
  avifPath: string;
  sizes: { width: number; path: string }[];
};

export type GeneratorConfig = {
  booksDir: string;
  distDir: string;
  imageSizes: number[];
  imageFormats: ("webp" | "avif" | "jpeg")[];
  basePath: string;
};

export type ImageCache = {
  [key: string]: {
    contentHash: string;
    sizes: { width: number; path: string }[];
    webpPath: string;
    avifPath: string;
  };
};
