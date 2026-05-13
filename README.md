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

### Backend Setup
1. Navigate to the backend directory:
```bash
cd backend
```
2. Install dependencies:
```bash
npm install
```
3. Configure environment variables. Create a `.env` file in the `backend` directory (you can copy from `.env.example`):
```bash
cp .env.example .env
```
*Note: Update the `DATABASE_URL` in the `.env` file to match your local PostgreSQL setup (e.g., `postgresql://<your-mac-username>@localhost:5432/tempomatch`).*

4. Push the database schema:
```bash
npx prisma db push
```
5. Start the backend server:
```bash
npm run dev
```

### Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
```
2. Install dependencies:
```bash
npm install
```
3. Start the frontend development server:
```bash
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
