import axios from 'axios'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth token injection ───────────────────────────────────────────────────────
// Automatically attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tm_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Order APIs ────────────────────────────────────────────────────────────────
export const placeOrder = (data) => api.post('/orders', data)
export const cancelOrder = (id, userId) => api.delete(`/orders/${id}?userId=${userId}`)
export const getOpenOrders = (userId) => api.get(`/orders?userId=${userId}`)
export const getOrderHistory = (userId) => api.get(`/orders/history?userId=${userId}`)
export const getTradeHistory = (userId) => api.get(`/orders/trades?userId=${userId}`)

// ── User APIs ─────────────────────────────────────────────────────────────────
export const getBalance = (userId) => api.get(`/users/${userId}/balance`)
export const createUser = (username) => api.post('/users', { username })
export const listUsers = () => api.get('/users')

// ── Auth APIs ─────────────────────────────────────────────────────────────────
export const registerUser = (data) => api.post('/auth/register', data)
export const loginUser = (data) => {
  // Route to correct endpoint based on method
  if (data.method === 'phone') {
    const { method, ...rest } = data
    return api.post('/auth/phone-login', rest)
  }
  const { method, ...rest } = data
  return api.post('/auth/login', rest)
}
export const googleAuthUser = (data) => api.post('/auth/google', data)
export const getMe = () => api.get('/auth/me')

export default api
