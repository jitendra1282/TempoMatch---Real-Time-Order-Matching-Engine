import axios from 'axios'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
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

export default api
