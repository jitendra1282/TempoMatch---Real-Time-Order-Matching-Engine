import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Order APIs
export const placeOrder = (data) => api.post('/orders', data)
export const cancelOrder = (id) => api.delete(`/orders/${id}`)

// User APIs
export const getBalance = (userId) => api.get(`/users/${userId}/balance`)

export default api
