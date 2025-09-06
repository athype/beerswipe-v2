import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost';
const API_PORT = import.meta.env.VITE_API_PORT || 8080;

const API_URL = `${API_BASE_URL}:${API_PORT}/api/v1`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
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
};

export const drinksAPI = {
  getAll: (params) => api.get('/drinks', { params }),
  getById: (id) => api.get(`/drinks/${id}`),
  create: (drinkData) => api.post('/drinks', drinkData),
  update: (id, drinkData) => api.put(`/drinks/${id}`, drinkData),
  addStock: (id, quantity) => api.post(`/drinks/${id}/add-stock`, { quantity }),
  delete: (id) => api.delete(`/drinks/${id}`),
};

export const salesAPI = {
  makeSale: (saleData) => api.post('/sales/sell', saleData),
  getHistory: (params) => api.get('/sales/history', { params }),
  getStats: (params) => api.get('/sales/stats', { params }),
};

export default api;
