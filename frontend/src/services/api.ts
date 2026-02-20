import axios from "axios";
import type { AxiosRequestConfig } from "axios";

// In production, use relative URL that nginx will proxy to backend
// In development, use full URL with port
const API_URL = import.meta.env.PROD
  ? "/api/v1"
  : `${import.meta.env.VITE_API_URL || "http://localhost"}:${import.meta.env.VITE_API_PORT || 6969}/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request interceptor - no longer needed for auth token since it's in httpOnly cookie
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface Credentials {
  username: string;
  password: string;
}

export interface AdminData {
  username: string;
  password: string;
}

export interface UserData {
  name?: string;
  username?: string;
  email?: string;
  userType?: string;
  password?: string;
  credits?: number;
}

export interface DrinkData {
  name?: string;
  price?: number;
  stock?: number;
  category?: string;
  isActive?: boolean;
}

export interface SaleData {
  userId: number;
  drinkId: number;
  quantity?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: unknown;
}

export const authAPI = {
  login: (credentials: Credentials) => api.post("/auth/login", credentials),
  logout: () => api.post("/auth/logout"),
  getCurrentUser: () => api.get("/auth/me"),
  createAdmin: (adminData: AdminData) => api.post("/auth/create-admin", adminData),
};

export const usersAPI = {
  getAll: (params?: PaginationParams) => api.get("/users", { params }),
  getById: (id: number) => api.get(`/users/${id}`),
  create: (userData: UserData) => api.post("/users", userData),
  update: (id: number, userData: UserData) => api.put(`/users/${id}`, userData),
  addCredits: (id: number, amount: number) => api.post(`/users/${id}/add-credits`, { amount }),
  importCSV: (formData: FormData) =>
    api.post("/users/import-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  exportCSV: (params?: PaginationParams) =>
    api.get("/users/export-csv", {
      params,
      responseType: "blob",
    } as AxiosRequestConfig),
};

export const drinksAPI = {
  getAll: (params?: PaginationParams) => api.get("/drinks", { params }),
  getById: (id: number) => api.get(`/drinks/${id}`),
  create: (drinkData: DrinkData) => api.post("/drinks", drinkData),
  update: (id: number, drinkData: DrinkData) => api.put(`/drinks/${id}`, drinkData),
  addStock: (id: number, quantity: number) => api.post(`/drinks/${id}/add-stock`, { quantity }),
  delete: (id: number) => api.delete(`/drinks/${id}`),
  importCSV: (formData: FormData) =>
    api.post("/drinks/import-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  exportCSV: (params?: PaginationParams) =>
    api.get("/drinks/export-csv", {
      params,
      responseType: "blob",
    } as AxiosRequestConfig),
};

export const salesAPI = {
  makeSale: (saleData: SaleData) => api.post("/sales/sell", saleData),
  getHistory: (params?: PaginationParams) => api.get("/sales/history", { params }),
  getStats: (params?: PaginationParams) => api.get("/sales/stats", { params }),
  undoTransaction: (transactionId: number) => api.delete(`/sales/undo/${transactionId}`),
};

export const passkeysAPI = {
  getRegistrationOptions: () => api.post("/passkeys/register-options"),
  verifyRegistration: (credential: unknown, deviceName: string) =>
    api.post("/passkeys/register-verify", { credential, deviceName }),
  getLoginOptions: (username: string) => api.post("/passkeys/login-options", { username }),
  verifyLogin: (credential: unknown) => api.post("/passkeys/login-verify", { credential }),
  getAll: () => api.get("/passkeys"),
  delete: (id: number) => api.delete(`/passkeys/${id}`),
  update: (id: number, deviceName: string) => api.put(`/passkeys/${id}`, { deviceName }),
};

export const leaderboardAPI = {
  getMonthly: (year: number, month: number) =>
    api.get("/leaderboard/monthly", { params: { year, month } }),
  getUserRank: (userId: number, year: number, month: number) =>
    api.get(`/leaderboard/rank/${userId}`, { params: { year, month } }),
};

export default api;
