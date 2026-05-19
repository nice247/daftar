import axios from 'axios';

// API base URL: from env variable, or relative path (for same-domain deployment), or localhost fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if the 401 is NOT from the login endpoint itself
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ Auth API ============

export const authAPI = {
  // Step 1: Request phone verification (sends code to admin via Telegram)
  verifyPhone: (phone) => api.post('/auth/verify-phone', { phone }),

  // Step 2: Confirm phone verification code
  confirmPhone: (phone, code) => api.post('/auth/confirm-phone', { phone, code }),

  // Step 3: Complete registration
  register: (data) => api.post('/auth/register', data),

  // Login
  login: (phone, password) => api.post('/auth/login', { phone, password }),

  // Forgot password - request OTP
  forgotPassword: (phone) => api.post('/auth/forgot-password', { phone }),

  // Verify OTP
  verifyOTP: (phone, code) => api.post('/auth/verify-otp', { phone, code }),

  // Reset password
  resetPassword: (phone, code, new_password) =>
    api.post('/auth/reset-password', { phone, code, new_password }),
};

// ============ User API ============

export const userAPI = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
};

// ============ EOD API ============

export const eodAPI = {
  save: (data) => api.post('/eod/save', data),
  getLastRestock: () => api.get('/eod/last-restock'),
  getCycleStatus: () => api.get('/eod/cycle-status'),
  getToday: () => api.get('/eod/today'),
  getYesterday: () => api.get('/eod/yesterday'),
};

// ============ Customer API ============

export const customerAPI = {
  list: () => api.get('/customers/'),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers/', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  addDebt: (data) => api.post('/customers/debt', data),
  payDebt: (data) => api.post('/customers/debt/pay', data),
  waiveDebt: (data) => api.post('/customers/debt/waive', data),
};

// ============ Expense API ============

export const expenseAPI = {
  list: (params) => api.get('/expenses/', { params }),
  create: (data) => api.post('/expenses/', data),
  delete: (id) => api.delete(`/expenses/${id}`),
};

// ============ Report API ============

export const reportAPI = {
  get: () => api.get('/reports/'),
};

// ============ Product API ============

export const productAPI = {
  list: () => api.get('/products/'),
  create: (data) => api.post('/products/', data),
  supply: (data) => api.post('/products/supply', data),
};

// ============ Subscription API ============

export const subscriptionAPI = {
  uploadReceipt: (formData) => api.post('/subscriptions/upload-receipt', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getMy: () => api.get('/subscriptions/my'),
  getPending: () => api.get('/subscriptions/pending'),
  review: (data) => api.post('/subscriptions/review', data),
  getPrices: () => api.get('/subscriptions/prices'),
};

// ============ Admin API ============

export const adminAPI = {
  listUsers: (params) => api.get('/admin/users', { params }),
  extendSubscription: (data) => api.post('/admin/extend-subscription', data),
  toggleUser: (data) => api.post('/admin/toggle-user', data),
  addUser: (data) => api.post('/admin/add-user', data),
  getStats: () => api.get('/admin/stats'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
};

// ============ OCR API ============

export const ocrAPI = {
  extract: (formData) => api.post('/ocr/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  verify: (formData) => api.post('/ocr/verify', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ============ Merchant Debt API ============

export const merchantDebtAPI = {
  list: (params) => api.get('/merchant-debts/', { params }),
  create: (data) => api.post('/merchant-debts/', data),
  pay: (data) => api.post('/merchant-debts/pay', data),
  getPayments: (debtId) => api.get(`/merchant-debts/${debtId}/payments`),
  delete: (debtId) => api.delete(`/merchant-debts/${debtId}`),
  summary: () => api.get('/merchant-debts/summary'),
};

export default api;