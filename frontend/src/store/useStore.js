import { create } from 'zustand'

// Generate mock candle data
function generateMockCandles() {
  const candles = []
  let basePrice = 81000
  const now = Math.floor(Date.now() / 1000)
  const interval = 3600 // 1 hour candles

  for (let i = 100; i >= 0; i--) {
    const time = now - i * interval
    const open = basePrice + (Math.random() - 0.48) * 500
    const close = open + (Math.random() - 0.48) * 600
    const high = Math.max(open, close) + Math.random() * 300
    const low = Math.min(open, close) - Math.random() * 300
    const volume = Math.random() * 200 + 20

    candles.push({ time, open, high, low, close, volume })
    basePrice = close
  }
  return candles
}

// Generate mock order book
function generateMockOrderBook() {
  const basePrice = 81072.96
  const asks = []
  const bids = []

  for (let i = 0; i < 15; i++) {
    const askPrice = basePrice + (i + 1) * (Math.random() * 2 + 0.5)
    const bidPrice = basePrice - (i + 1) * (Math.random() * 2 + 0.5)
    const askAmt = Math.random() * 5 + 0.001
    const bidAmt = Math.random() * 5 + 0.001

    asks.push({
      price: askPrice,
      amount: askAmt,
      total: askAmt * askPrice,
    })
    bids.push({
      price: bidPrice,
      amount: bidAmt,
      total: bidAmt * bidPrice,
    })
  }

  asks.sort((a, b) => a.price - b.price)
  bids.sort((a, b) => b.price - a.price)
  return { asks, bids, lastPrice: basePrice }
}

// Generate mock recent trades
function generateMockTrades() {
  const trades = []
  let price = 81072.96
  for (let i = 0; i < 25; i++) {
    price += (Math.random() - 0.5) * 5
    const hours = String(Math.floor(Math.random() * 24)).padStart(2, '0')
    const mins = String(Math.floor(Math.random() * 60)).padStart(2, '0')
    const secs = String(Math.floor(Math.random() * 60)).padStart(2, '0')
    trades.push({
      price,
      qty: Math.random() * 2 + 0.0001,
      time: `${hours}:${mins}:${secs}`,
      makerSide: Math.random() > 0.5 ? 'BUY' : 'SELL',
    })
  }
  return trades
}

const useStore = create((set) => ({
  // Current user
  currentUser: { id: 'user-alice', name: 'Alice' },
  setCurrentUser: (user) => set({ currentUser: user }),

  // Balances
  balances: { fiat: 10000.00, asset: 0.50000 },
  setBalances: (balances) => set({ balances }),

  // Market stats
  marketStats: {
    lastPrice: 81072.96,
    change24h: 0.21,
    high24h: 82479.32,
    low24h: 80279.77,
    volume24h: 14987.75,
  },
  setMarketStats: (stats) => set({ marketStats: stats }),

  // Order book
  orderBook: generateMockOrderBook(),
  setOrderBook: (book) => set({ orderBook: book }),

  // Candle data
  candleData: { candles: generateMockCandles() },
  setCandleData: (data) => set({ candleData: data }),

  // Recent trades
  recentTrades: generateMockTrades(),
  setRecentTrades: (trades) => set({ recentTrades: trades }),

  // Open orders
  openOrders: [],
  setOpenOrders: (orders) => set({ openOrders: orders }),
}))

export default useStore
