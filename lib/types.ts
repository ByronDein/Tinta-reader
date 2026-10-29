export type BlockType = "h1" | "h2" | "p" | "li";
export interface Block {
  type: BlockType;
  text: string;
  page: number;
}
export interface TocItem {
  title: string;
  /** índice de bloque (reflow), -1 si se desconoce */
  blockIndex: number;
  /** página PDF (1-based) */
  page: number;
  level: number;
}
export interface Book {
  id: string;
  title: string;
  author?: string;
  size: number;
  pageCount: number;
  coverBlob?: Blob;
  hasText: boolean;
  blockCount: number;
  toc: TocItem[];
  addedAt: number;
  lastOpenedAt: number;
  finishedAt?: number;
  status: "new" | "reading" | "done";
}
export type ReadMode = "reflow" | "page";
export interface Progress {
  bookId: string;
  mode: ReadMode;
  blockIndex: number;
  charOffset: number;
  pdfPage: number;
  percent: number;
  updatedAt: number;
}
export type HighlightColor = "yellow" | "green" | "blue" | "pink";
export interface Annotation {
  id: string;
  bookId: string;
  kind: "bookmark" | "highlight" | "note";
  color?: HighlightColor;
  blockIndex: number;
  start: number;
  end: number;
  text: string;
  note?: string;
  page: number;
  createdAt: number;
  updatedAt?: number;
}
export interface StatRow {
  date: string;
  seconds: number;
  bookIds: string[];
}

export interface VocabEntry {
  /** palabra en minúsculas (una sola entrada por palabra) */
  id: string;
  word: string;
  /** traducción */
  meaning?: string;
  /** definición corta */
  definition?: string;
  /** frase del libro donde apareció */
  context: string;
  bookId: string;
  bookTitle: string;
  createdAt: number;
}
