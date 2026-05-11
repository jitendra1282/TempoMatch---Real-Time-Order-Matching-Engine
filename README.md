# TempoMatch — Real-Time Order Matching Engine

A high-performance, low-latency financial exchange platform built with a **Binance-inspired dark UI**. Users place Buy/Sell limit orders that are matched in real-time using **Price-Time Priority** with in-memory heaps and ACID-compliant PostgreSQL persistence.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, lightweight-charts, Zustand |
| Backend | Node.js, Express, Socket.io, Prisma ORM |
| Database | PostgreSQL |
| Language | JavaScript (ES2022) |

## Project Structure

```
TempoMatch/
├── frontend/    ← React (Vite) trading terminal UI
└── backend/     ← Node.js matching engine + REST API + WebSocket
```

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

## Features
- 📊 Real-time candlestick chart (lightweight-charts)
- 📗 Live order book with Bids (green) / Asks (red)
- ⚡ In-memory matching engine (MaxHeap bids + MinHeap asks)
- 🔄 WebSocket broadcast (orderbook_state + trade_executed)
- 🛡️ Crash recovery (warm boot from PostgreSQL)
- 🔒 Atomic database transactions via Prisma

## License
MIT
