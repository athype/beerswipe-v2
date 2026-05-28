export type ISODateString = string;

export interface ApiErrorResponse {
  error: string;
  [key: string]: unknown;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export type PaginatedResponse<TItem, TKey extends string> = {
  pagination: PaginationMeta;
} & Record<TKey, TItem[]>;

export type StoreActionResult<TData = void> =
  | { success: true; data?: TData }
  | { success: false; error: string };
