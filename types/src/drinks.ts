import type { PaginationMeta } from "./common.js";
import type { Drink } from "./domain.js";

export interface ListDrinksQuery {
  search?: string;
  category?: string;
  inStock?: boolean | "true" | "false";
  page?: number;
  limit?: number;
}

export interface ListDrinksResponse {
  drinks: Drink[];
  pagination: PaginationMeta;
}

export type GetDrinkByIdResponse = Drink;

export interface CreateDrinkRequest {
  name: string;
  description?: string | null;
  price: number;
  stock?: number;
  category?: string;
}

export interface CreateDrinkResponse {
  message: string;
  drink: Drink;
}

export interface UpdateDrinkRequest {
  name?: string;
  description?: string | null;
  price?: number;
  stock?: number;
  category?: string;
  isActive?: boolean;
}

export interface UpdateDrinkResponse {
  message: string;
  drink: Drink;
}

export interface AddStockRequest {
  quantity: number;
}

export interface AddStockResponse {
  message: string;
  drink: {
    id: number;
    name: string;
    stock: number;
  };
}

export interface DeleteDrinkResponse {
  message: string;
}

export interface DrinkCsvExportParams {
  category?: string;
  inStock?: boolean;
}

export interface DrinkCsvImportResult {
  name: string;
  action: "created" | "updated";
  stock: number;
}

export interface ImportDrinksCsvResponse {
  message: string;
  imported: number;
  errors: number;
  results: DrinkCsvImportResult[];
  errorDetails: string[];
}
