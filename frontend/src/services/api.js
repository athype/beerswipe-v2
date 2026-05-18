import axios from 'axios';

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
  /** @param {LoginRequest} credentials */
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  /** @param {CreateBootstrapAdminRequest} adminData */
  createAdmin: (adminData) => api.post('/auth/create-admin', adminData),
};

export const usersAPI = {
  /** @param {ListUsersQuery} params */
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  /** @param {CreateUserRequest} userData */
  create: (userData) => api.post('/users', userData),
  /** @param {UpdateUserRequest} userData */
  update: (id, userData) => api.put(`/users/${id}`, userData),
  addCredits: (id, amount) => api.post(`/users/${id}/add-credits`, { amount }),
  importCSV: (formData) => api.post('/users/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  /** @param {UserCsvExportParams} params */
  exportCSV: (params) => api.get('/users/export-csv', { 
    params, 
    responseType: 'blob' 
  }),
};

export const drinksAPI = {
  /** @param {ListDrinksQuery} params */
  getAll: (params) => api.get('/drinks', { params }),
  getById: (id) => api.get(`/drinks/${id}`),
  /** @param {CreateDrinkRequest} drinkData */
  create: (drinkData) => api.post('/drinks', drinkData),
  /** @param {UpdateDrinkRequest} drinkData */
  update: (id, drinkData) => api.put(`/drinks/${id}`, drinkData),
  addStock: (id, quantity) => api.post(`/drinks/${id}/add-stock`, { quantity }),
  delete: (id) => api.delete(`/drinks/${id}`),
  importCSV: (formData) => api.post('/drinks/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  /** @param {DrinkCsvExportParams} params */
  exportCSV: (params) => api.get('/drinks/export-csv', { 
    params, 
    responseType: 'blob' 
  }),
};

export const salesAPI = {
  /** @param {SellRequest} saleData */
  makeSale: (saleData) => api.post('/sales/sell', saleData),
  /** @param {TransactionHistoryQuery} params */
  getHistory: (params) => api.get('/sales/history', { params }),
  /** @param {SalesStatsQuery} params */
  getStats: (params) => api.get('/sales/stats', { params }),
  undoTransaction: (transactionId) => api.delete(`/sales/undo/${transactionId}`),
};

export const passkeysAPI = {
  getRegistrationOptions: () => api.post('/passkeys/register-options'),
  /** @param {WebAuthnRegistrationCredentialJSON} credential */
  verifyRegistration: (credential, deviceName) => api.post('/passkeys/register-verify', { credential, deviceName }),
  /** @param {LoginPasskeyOptionsRequest['username']} username */
  getLoginOptions: (username) => api.post('/passkeys/login-options', { username }),
  /** @param {WebAuthnAuthenticationCredentialJSON} credential */
  verifyLogin: (credential) => api.post('/passkeys/login-verify', { credential }),
  getAll: () => api.get('/passkeys'),
  delete: (id) => api.delete(`/passkeys/${id}`),
  /** @param {UpdatePasskeyRequest['deviceName']} deviceName */
  update: (id, deviceName) => api.put(`/passkeys/${id}`, { deviceName }),
};

export const leaderboardAPI = {
  /** @param {MonthlyLeaderboardQuery['year']} year @param {MonthlyLeaderboardQuery['month']} month */
  getMonthly: (year, month) => api.get('/leaderboard/monthly', { params: { year, month } }),
  /** @param {number} userId @param {UserRankQuery['year']} year @param {UserRankQuery['month']} month */
  getUserRank: (userId, year, month) => api.get(`/leaderboard/rank/${userId}`, { params: { year, month } }),
};

export default api;
