import axios from 'axios';

import type * as types from '@beerswipe/types';

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
  
  logout: () => api.post<types.LogoutResponse>('/auth/logout'),

  getCurrentUser: () => api.get<types.CurrentUserResponse>('/auth/me'),

  createAdmin: (adminData: types.CreateBootstrapAdminRequest) => api.post<types.CreateBootstrapAdminResponse>('/auth/create-admin', adminData),
};

export const usersAPI = {
  getAll: (params: types.ListUsersQuery) => 
    api.get<types.ListUsersResponse>('/users', { params }),

  getById: (id: number) => api.get<types.User>(`/users/${id}`),

  create: (userData: types.CreateUserRequest) => api.post<types.CreateUserResponse>('/users', userData),

  update: (id: number, userData: types.UpdateUserRequest) => api.put<types.UpdateUserResponse>(`/users/${id}`, userData),

  addCredits: (id: number, amount: number) => api.post<types.AddCreditsResponse>(`/users/${id}/add-credits`, { amount }),

  importCSV: (formData: FormData) => api.post<types.ImportUsersCsvResponse>('/users/import-csv', formData, {
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
  
  create: (drinkData: types.CreateDrinkRequest) => api.post<types.CreateDrinkResponse>('/drinks', drinkData),
  
  update: (id: number, drinkData: types.UpdateDrinkRequest) => api.put<types.UpdateDrinkResponse>(`/drinks/${id}`, drinkData),
  
  addStock: (id: number, quantity: number) => api.post<types.AddStockResponse>(`/drinks/${id}/add-stock`, { quantity }),
  
  delete: (id: number) => api.delete<types.DeleteDrinkResponse>(`/drinks/${id}`),
  
  importCSV: (formData: FormData) => api.post<types.ImportDrinksCsvResponse>('/drinks/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  exportCSV: (params: types.DrinkCsvExportParams) => api.get('/drinks/export-csv', { 
    params, 
    responseType: 'blob' 
  }),
};

export const salesAPI = {
  makeSale: (saleData: types.SellRequest) => api.post<types.SellResponse>('/sales/sell', saleData),
  
  getHistory: (params: types.TransactionHistoryQuery) => api.get<types.TransactionHistoryResponse>('/sales/history', { params }),
  
  getStats: (params: types.SalesStatsQuery) => api.get<types.SalesStatsResponse>('/sales/stats', { params }),
  
  undoTransaction: (transactionId: number) => api.delete<types.UndoTransactionResponse>(`/sales/undo/${transactionId}`),
};

export const passkeysAPI = {
  getRegistrationOptions: () => api.post<types.WebAuthnRegistrationOptions>('/passkeys/register-options'),
  
  verifyRegistration: (credential: types.WebAuthnRegistrationCredentialJSON, deviceName: string) => api.post<types.RegisterPasskeyVerifyResponse>('/passkeys/register-verify', { credential, deviceName }),
  
  getLoginOptions: (username: types.LoginPasskeyOptionsRequest['username']) => api.post<types.WebAuthnAuthenticationOptions>('/passkeys/login-options', { username }),
  
  verifyLogin: (credential: types.WebAuthnAuthenticationCredentialJSON) => api.post<types.LoginPasskeyVerifyResponse>('/passkeys/login-verify', { credential }),

  getAll: () => api.get<types.ListPasskeysResponse>('/passkeys'),

  delete: (id: number) => api.delete<types.DeletePasskeyResponse>(`/passkeys/${id}`),

  update: (id: number, deviceName: types.UpdatePasskeyRequest['deviceName']) => api.put<types.UpdatePasskeyResponse>(`/passkeys/${id}`, { deviceName }),
};

export const leaderboardAPI = {
  getMonthly: (year: types.MonthlyLeaderboardQuery['year'], month: types.MonthlyLeaderboardQuery['month']) => api.get<types.MonthlyLeaderboardResponse>('/leaderboard/monthly', { params: { year, month } }),

  getUserRank: (userId: number, year: types.UserRankQuery['year'], month: types.UserRankQuery['month']) => api.get<types.UserRankResponse>(`/leaderboard/rank/${userId}`, { params: { year, month } }),
};

export default api;
