import { create } from 'zustand'

// ── Mock data generators (used as initial/fallback state) ─────────────────────

function generateMockCandles(interval = 86400, count = 2000) {
  const candles = []
  let basePrice = 81000
  const now = Math.floor(Date.now() / 1000)
  const alignedNow = Math.floor(now / interval) * interval

  for (let i = count; i >= 0; i--) {
    const time = alignedNow - i * interval
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

function generateMockOrderBook() {
  const basePrice = 81072.96
  const asks = []
  const bids = []
  for (let i = 0; i < 15; i++) {
    const askPrice = basePrice + (i + 1) * (Math.random() * 2 + 0.5)
    const bidPrice = basePrice - (i + 1) * (Math.random() * 2 + 0.5)
    const askAmt = Math.random() * 5 + 0.001
    const bidAmt = Math.random() * 5 + 0.001
    asks.push({ price: askPrice, amount: askAmt, total: askAmt * askPrice })
    bids.push({ price: bidPrice, amount: bidAmt, total: bidAmt * bidPrice })
  }
  asks.sort((a, b) => a.price - b.price)
  bids.sort((a, b) => b.price - a.price)
  return { asks, bids, lastPrice: basePrice }
}

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

// ── Store ────────────────────────────────────────────────────────────────────

const useStore = create((set, get) => ({
  // Socket connection status
  socketConnected: false,
  setSocketConnected: (v) => set({ socketConnected: v }),

  // Current user (set after login/user-select)
  currentUser: null,
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

  // Order book (replaced by live WS data when connected)
  orderBook: generateMockOrderBook(),
  setOrderBook: (book) => set({ orderBook: book }),

  // Candle data and timeframe
  timeframe: '1D',
  chartInterval: 86400,
  candleData: { candles: generateMockCandles(86400, 2000) },
  setCandleData: (data) => set({ candleData: data }),
  setTimeframe: (tf) => {
    let interval = 86400
    if (tf === '1m') interval = 60
    else if (tf === '5m') interval = 300
    else if (tf === '15m') interval = 900
    else if (tf === '1H') interval = 3600
    else if (tf === '4H') interval = 14400
    else if (tf === '1D') interval = 86400
    else if (tf === '1W') interval = 604800
    
    set({
      timeframe: tf,
      chartInterval: interval,
      candleData: { candles: generateMockCandles(interval, 2000) }
    })
  },

  // Recent trades (replaced by live WS data when connected)
  recentTrades: generateMockTrades(),
  setRecentTrades: (trades) => set({ recentTrades: trades }),

  // Open orders for current user
  openOrders: [],
  setOpenOrders: (orders) => set({ openOrders: orders }),

  // Append or update a single order in openOrders list
  upsertOpenOrder: (order) => {
    const orders = get().openOrders
    const idx = orders.findIndex(o => o.id === order.id)
    if (idx === -1) {
      set({ openOrders: [order, ...orders] })
    } else {
      const updated = [...orders]
      updated[idx] = order
      set({ openOrders: updated })
    }
  },

  // Remove an order from openOrders list
  removeOpenOrder: (orderId) => {
    set({ openOrders: get().openOrders.filter(o => o.id !== orderId) })
  },
}))

export default useStore
