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

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (Ensure it is running)
- Create a database in PostgreSQL named `tempomatch` (if it does not exist)

### 1. Backend Setup
Open your terminal and navigate to the backend directory:
```bash
cd backend
npm install
```

Configure environment variables:
```bash
cp .env.example .env
```
**🚨 IMPORTANT:** Open the newly created `backend/.env` file and update the `DATABASE_URL` to match your local PostgreSQL username. 
For example, if your Mac username is `jitendra`:
`DATABASE_URL="postgresql://jitendra@localhost:5432/tempomatch"`

Initialize the database schema and generate Prisma Client:
```bash
npx prisma db push
npx prisma generate
```

Start the backend server:
```bash
npm run dev
```

### 2. Frontend Setup
Open a **new, separate terminal window** and navigate to the frontend directory:
```bash
cd frontend
npm install
npm run dev
```

Once both servers are running, open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).

### 🛠️ Troubleshooting

- **`Error: listen EADDRINUSE: address already in use :::3001`**
  This means the backend is already running in the background. Find the process using `lsof -i :3001` and kill it using `kill -9 <PID>`, or close the terminal where it's currently running.

- **`User 'user' was denied access on the database 'tempomatch.public'`**
  You forgot to update the `DATABASE_URL` in your `backend/.env` file. Change the placeholder `user:password` to your actual PostgreSQL username.

## Features
- 📊 Real-time candlestick chart (lightweight-charts)
- 📗 Live order book with Bids (green) / Asks (red)
- ⚡ In-memory matching engine (MaxHeap bids + MinHeap asks)
- 🔄 WebSocket broadcast (orderbook_state + trade_executed)
- 🛡️ Crash recovery (warm boot from PostgreSQL)
- 🔒 Atomic database transactions via Prisma

## License
MIT
