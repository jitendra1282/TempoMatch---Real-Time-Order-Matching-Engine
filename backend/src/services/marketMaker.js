// Market Maker Bot — keeps the order book populated so user orders fill quickly
//
// Strategy:
//   • Every REFRESH_INTERVAL ms, cancel all existing bot orders then re-seed
//     the book with LEVELS bid + ask levels around the mid price.
//   • This ensures there is always a counterparty within a tight spread.

import { PrismaClient } from '@prisma/client'
import { match } from '../engine/MatchingEngine.js'
import { orderBook } from '../engine/OrderBook.js'
import { broadcastOrderBook } from './broadcastService.js'

const prisma = new PrismaClient()

const BOT_USERNAME    = 'TempoBot'
const BASE_PRICE      = 81000        // Starting mid price (USDT)
const SPREAD_PCT      = 0.0005       // 0.05% half-spread between bid/ask
const LEVELS          = 8            // How many levels on each side
const LEVEL_GAP_PCT   = 0.001        // 0.1% gap between each level
const QTY_PER_LEVEL   = 0.5         // BTC per level
const REFRESH_MS      = 8000         // Refresh every 8 seconds
const INITIAL_FIAT    = 9_999_999
const INITIAL_ASSET   = 999

let botUserId = null
let refreshTimer = null

// ── Helpers ──────────────────────────────────────────────────────────────────

function midPrice() {
  // Use last traded price if available, else fallback to BASE_PRICE
  return orderBook.lastPrice || BASE_PRICE
}

async function ensureBotUser() {
  let user = await prisma.user.findUnique({ where: { username: BOT_USERNAME } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: BOT_USERNAME,
        fiatBalance: INITIAL_FIAT,
        assetBalance: INITIAL_ASSET,
      },
    })
    console.log('[MarketMaker] Created bot user:', user.id)
  }
  return user
}

async function cancelAllBotOrders() {
  if (!botUserId) return
  // Mark all OPEN/PARTIAL bot orders as CANCELED in DB
  const orders = await prisma.order.findMany({
    where: { userId: botUserId, status: { in: ['OPEN', 'PARTIAL'] } },
    select: { id: true, side: true },
  })
  for (const o of orders) {
    orderBook.removeOrder(o.id, o.side)
  }
  if (orders.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: orders.map((o) => o.id) } },
      data: { status: 'CANCELED' },
    })
  }
}

async function placeLevel(side, price, qty) {
  const roundedPrice = Math.round(price * 100) / 100
  const order = await prisma.order.create({
    data: {
      userId: botUserId,
      side,
      type: 'LIMIT',
      price: roundedPrice,
      initialQty: qty,
      remainingQty: qty,
      status: 'OPEN',
    },
  })

  const result = match({
    orderId: order.id,
    userId: botUserId,
    side,
    type: 'LIMIT',
    price: roundedPrice,
    remainingQty: qty,
    timestamp: Date.now(),
  })

  // Persist fills if any matched (unlikely right after cancel, but be safe)
  if (result.trades.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const t of result.trades) {
        await tx.trade.create({
          data: {
            makerOrderId: t.makerOrderId,
            takerOrderId: t.takerOrderId,
            price: t.price,
            qty: t.qty,
          },
        })
        await tx.order.update({
          where: { id: t.makerOrderId },
          data: { remainingQty: 0, status: 'FILLED' },
        })
      }
      await tx.order.update({
        where: { id: order.id },
        data: { remainingQty: result.remainingQty, status: result.status },
      })
    })
  }
}

async function seedBook() {
  const mid = midPrice()

  const tasks = []
  for (let i = 1; i <= LEVELS; i++) {
    const askPrice = mid * (1 + SPREAD_PCT + (i - 1) * LEVEL_GAP_PCT)
    const bidPrice = mid * (1 - SPREAD_PCT - (i - 1) * LEVEL_GAP_PCT)
    // Slightly vary qty so the book looks natural
    const qty = QTY_PER_LEVEL * (1 + (Math.random() - 0.5) * 0.4)
    tasks.push(placeLevel('SELL', askPrice, +qty.toFixed(5)))
    tasks.push(placeLevel('BUY',  bidPrice, +qty.toFixed(5)))
  }
  await Promise.all(tasks)
  broadcastOrderBook()
}

async function refresh() {
  try {
    await cancelAllBotOrders()
    await seedBook()
  } catch (err) {
    console.error('[MarketMaker] Refresh error:', err.message)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startMarketMaker() {
  try {
    const user = await ensureBotUser()
    botUserId = user.id

    // Initial seed
    await seedBook()
    console.log(`[MarketMaker] ✅ Started — seeding ${LEVELS} levels each side every ${REFRESH_MS / 1000}s`)

    // Periodic refresh
    refreshTimer = setInterval(refresh, REFRESH_MS)
  } catch (err) {
    console.error('[MarketMaker] Failed to start:', err.message)
  }
}

export function stopMarketMaker() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}
