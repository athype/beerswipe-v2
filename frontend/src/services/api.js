import axios from 'axios';

// In production, use relative URL that nginx will proxy to backend
// In development, use full URL with port
const API_URL = import.meta.env.PROD 
  ? '/api/v1' 
  : `${import.meta.env.VITE_API_URL || 'http://localhost'}:${import.meta.env.VITE_API_PORT || 6969}/api/v1`;

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
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  createAdmin: (adminData) => api.post('/auth/create-admin', adminData),
};

export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (userData) => api.post('/users', userData),
  update: (id, userData) => api.put(`/users/${id}`, userData),
  addCredits: (id, amount) => api.post(`/users/${id}/add-credits`, { amount }),
  importCSV: (formData) => api.post('/users/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  exportCSV: (params) => api.get('/users/export-csv', { 
    params, 
    responseType: 'blob' 
  }),
};

export const drinksAPI = {
  getAll: (params) => api.get('/drinks', { params }),
  getById: (id) => api.get(`/drinks/${id}`),
  create: (drinkData) => api.post('/drinks', drinkData),
  update: (id, drinkData) => api.put(`/drinks/${id}`, drinkData),
  addStock: (id, quantity) => api.post(`/drinks/${id}/add-stock`, { quantity }),
  delete: (id) => api.delete(`/drinks/${id}`),
  importCSV: (formData) => api.post('/drinks/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  exportCSV: (params) => api.get('/drinks/export-csv', { 
    params, 
    responseType: 'blob' 
  }),
};

export const salesAPI = {
  makeSale: (saleData) => api.post('/sales/sell', saleData),
  getHistory: (params) => api.get('/sales/history', { params }),
  getStats: (params) => api.get('/sales/stats', { params }),
  undoTransaction: (transactionId) => api.delete(`/sales/undo/${transactionId}`),
};

export default api;
