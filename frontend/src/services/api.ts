import axios from 'axios';

import type * as types from '@beerswipe/types';

/**
 * @typedef {import('@beerswipe/types').CreateBootstrapAdminRequest} CreateBootstrapAdminRequest
 * @typedef {import('@beerswipe/types').CreateDrinkRequest} CreateDrinkRequest
 * @typedef {import('@beerswipe/types').CreateUserRequest} CreateUserRequest
 * @typedef {import('@beerswipe/types').DrinkCsvExportParams} DrinkCsvExportParams
 * @typedef {import('@beerswipe/types').ListDrinksQuery} ListDrinksQuery
 * @typedef {import('@beerswipe/types').ListUsersQuery} ListUsersQuery
 * @typedef {import('@beerswipe/types').LoginPasskeyOptionsRequest} LoginPasskeyOptionsRequest
 * @typedef {import('@beerswipe/types').LoginPasskeyVerifyRequest} LoginPasskeyVerifyRequest
 * @typedef {import('@beerswipe/types').LoginRequest} LoginRequest
 * @typedef {import('@beerswipe/types').MonthlyLeaderboardQuery} MonthlyLeaderboardQuery
 * @typedef {import('@beerswipe/types').RegisterPasskeyVerifyRequest} RegisterPasskeyVerifyRequest
 * @typedef {import('@beerswipe/types').SalesStatsQuery} SalesStatsQuery
 * @typedef {import('@beerswipe/types').SellRequest} SellRequest
 * @typedef {import('@beerswipe/types').TransactionHistoryQuery} TransactionHistoryQuery
 * @typedef {import('@beerswipe/types').UpdateDrinkRequest} UpdateDrinkRequest
 * @typedef {import('@beerswipe/types').UpdatePasskeyRequest} UpdatePasskeyRequest
 * @typedef {import('@beerswipe/types').UpdateUserRequest} UpdateUserRequest
 * @typedef {import('@beerswipe/types').UserCsvExportParams} UserCsvExportParams
 * @typedef {import('@beerswipe/types').UserRankQuery} UserRankQuery
 * @typedef {import('@beerswipe/types').WebAuthnAuthenticationCredentialJSON} WebAuthnAuthenticationCredentialJSON
 * @typedef {import('@beerswipe/types').WebAuthnRegistrationCredentialJSON} WebAuthnRegistrationCredentialJSON
 */

// In production, use relative URL that nginx will proxy to backend
// In development, use full URL with port
const API_URL = import.meta.env.PROD 
  ? '/api/v1' 
  : `${import.meta.env.VITE_API_URL || 'http://localhost'}:${import.meta.env.VITE_API_PORT || 8080}/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
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
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials: types.LoginRequest) => 
    api.post<types.LoginResponse>('/auth/login', credentials),
  
  logout: () => api.post('/auth/logout'),

  getCurrentUser: () => api.get('/auth/me'),

  createAdmin: (adminData: types.CreateBootstrapAdminRequest) => api.post('/auth/create-admin', adminData),
};

export const usersAPI = {
  getAll: (params: types.ListUsersQuery) => 
    api.get<types.ListUsersResponse>('/users', { params }),

  getById: (id: number) => api.get<types.User>(`/users/${id}`),

  create: (userData: types.CreateUserRequest) => api.post<types.User>('/users', userData),

  update: (id: number, userData: types.UpdateUserRequest) => api.put<types.User>(`/users/${id}`, userData),

  addCredits: (id: number, amount: number) => api.post(`/users/${id}/add-credits`, { amount }),

  importCSV: (formData: FormData) => api.post('/users/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  exportCSV: (params: types.UserCsvExportParams) => api.get('/users/export-csv', { 
    params, 
    responseType: 'blob' 
  }),
};

export const drinksAPI = {
  getAll: (params: types.ListDrinksQuery) => api.get<types.ListDrinksResponse>('/drinks', { params }),
  
  getById: (id: number) => api.get<types.Drink>(`/drinks/${id}`),
  
  create: (drinkData: types.CreateDrinkRequest) => api.post<types.Drink>('/drinks', drinkData),
  
  update: (id: number, drinkData: types.UpdateDrinkRequest) => api.put<types.Drink>(`/drinks/${id}`, drinkData),
  
  addStock: (id: number, quantity: number) => api.post(`/drinks/${id}/add-stock`, { quantity }),
  
  delete: (id: number) => api.delete(`/drinks/${id}`),
  
  importCSV: (formData: FormData) => api.post('/drinks/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  exportCSV: (params: types.DrinkCsvExportParams) => api.get('/drinks/export-csv', { 
    params, 
    responseType: 'blob' 
  }),
};

export const salesAPI = {
  makeSale: (saleData: types.SellRequest) => api.post('/sales/sell', saleData),
  
  getHistory: (params: types.TransactionHistoryQuery) => api.get('/sales/history', { params }),
  
  getStats: (params: types.SalesStatsQuery) => api.get('/sales/stats', { params }),
  
  undoTransaction: (transactionId: number) => api.delete(`/sales/undo/${transactionId}`),
};

export const passkeysAPI = {
  getRegistrationOptions: () => api.post('/passkeys/register-options'),
  
  verifyRegistration: (credential: types.WebAuthnRegistrationCredentialJSON, deviceName: string) => api.post('/passkeys/register-verify', { credential, deviceName }),
  
  getLoginOptions: (username: types.LoginPasskeyOptionsRequest['username']) => api.post('/passkeys/login-options', { username }),
  
  verifyLogin: (credential: types.WebAuthnAuthenticationCredentialJSON) => api.post('/passkeys/login-verify', { credential }),

  getAll: () => api.get('/passkeys'),

  delete: (id: number) => api.delete(`/passkeys/${id}`),

  update: (id: number, deviceName: types.UpdatePasskeyRequest['deviceName']) => api.put(`/passkeys/${id}`, { deviceName }),
};

export const leaderboardAPI = {
  getMonthly: (year: types.MonthlyLeaderboardQuery['year'], month: types.MonthlyLeaderboardQuery['month']) => api.get('/leaderboard/monthly', { params: { year, month } }),

  getUserRank: (userId: number, year: types.UserRankQuery['year'], month: types.UserRankQuery['month']) => api.get(`/leaderboard/rank/${userId}`, { params: { year, month } }),
};

export default api;
