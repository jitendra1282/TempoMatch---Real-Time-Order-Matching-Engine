// Express + Socket.io server setup

import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import orderRoutes from './routes/orders.js'
import userRoutes from './routes/users.js'
import { errorHandler } from './middleware/errorHandler.js'
import { init as initBroadcast, broadcastOrderBook } from './services/broadcastService.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export const app = express()
export const httpServer = createServer(app)
export const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
})

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json())

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/v1/orders', orderRoutes)
app.use('/api/v1/users', userRoutes)

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Socket.io ────────────────────────────────────────────────────────────────
initBroadcast(io)

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)

  // Send the current order book snapshot immediately on connection
  broadcastOrderBook()

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`)
  })
})

// ── Error Handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler)
