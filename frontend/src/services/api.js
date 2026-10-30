import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true  // Enable session cookies
})

// Helper to get stored JWT token
export function getToken() {
  return localStorage.getItem('token') || ''
}

// Helper to check stored user
export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Request interceptor: attach JWT Bearer token to all outgoing requests
api.interceptors.request.use(
  config => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Response interceptor: handle 401 unauthorized
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    return Promise.reject(error)
  }
)

// Authentication functions
export async function register(userData) {
  const response = await api.post('/register', userData)
  if (response.data?.success && response.data?.token) {
    localStorage.setItem('token', response.data.token)
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
  }
  return response
}

export async function login(username, password) {
  const response = await api.post('/login', { username, password })
  if (response.data?.success && response.data?.token) {
    localStorage.setItem('token', response.data.token)
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
  }
  return response
}

export async function logout() {
  try {
    await api.post('/logout')
  } finally {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
}

export async function getCurrentUser() {
  try {
    return await api.get('/me')
  } catch (err) {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return null
    }
    throw err
  }
}

// Transaction analysis
export async function predict(payload) {
  return api.post('/predict', payload)
}

// Dashboard & Statistics
export async function getDashboard() {
  return api.get('/dashboard')
}

// Transaction history
export async function getTransactions(page = 1, limit = 50, search = '', filter = 'All') {
  return api.get('/transactions', {
    params: { page, limit, search, filter }
  })
}

// Get specific transaction details with SHAP values
export async function getTransactionDetail(transactionId) {
  return api.get(`/transactions/${transactionId}`, { timeout: 120000 })
}

// Real-time alerts
export async function getAlerts() {
  return api.get('/alerts')
}

// Model information
export async function getModelInfo() {
  return api.get('/model-info')
}

export async function analyzeBulk(file) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/bulk/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  })
}

export function bulkTemplateUrl() {
  return `${baseURL}/bulk/template`
}

export function bulkExportUrl(batchId, format) {
  return `${baseURL}/bulk/${batchId}/export?format=${format}`
}

export function bulkValidationReportUrl(batchId) {
  return `${baseURL}/bulk/${batchId}/validation-report`
}

export async function getBulkTransactionShap(batchId, transactionId) {
  return api.get(`/bulk/${encodeURIComponent(batchId)}/transactions/${encodeURIComponent(transactionId)}/shap`, {
    timeout: 120000
  })
}

export async function getBulkResults(batchId) {
  return api.get(`/bulk/${encodeURIComponent(batchId)}`, { timeout: 30000 })
}

export default api
