export type Chapter = {
  name: string;
  title: string;
  content: string;
  path: string;
  htmlPath: string;
  wordCount: number;
  book: string;
};

export type BookData = {
  name: string;
  path: string;
  chapters: Chapter[];
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
};

export type ImageCache = {
  [key: string]: {
    mtime: number;
    sizes: { width: number; path: string }[];
    webpPath: string;
    avifPath: string;
  };
};
