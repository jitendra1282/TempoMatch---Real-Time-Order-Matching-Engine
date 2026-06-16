// Market Maker Bot — keeps the order book populated so user orders fill quickly
//
// Strategy:
//   • Every REFRESH_INTERVAL ms, cancel all existing bot orders then re-seed
//     the book with LEVELS bid + ask levels around the mid price.
//   • This ensures there is always a counterparty within a tight spread.
//   • Bot respects its own balance — will not place orders it can't afford.

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
  // Use last traded price if available, else fallback to BASE_PRICE.
  // Safety guard: if lastPrice is unrealistically high (> 10× BASE_PRICE,
  // e.g., set by test orders or manipulation), reset to BASE_PRICE.
  const last = orderBook.lastPrice
  if (!last || last > BASE_PRICE * 10 || last < BASE_PRICE * 0.1) {
    return BASE_PRICE
  }
  return last
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
    select: { id: true, side: true, price: true, remainingQty: true },
  })

  for (const o of orders) {
    orderBook.removeOrder(o.id, o.side)
  }

  if (orders.length > 0) {
    // Refund reserved balances when canceling bot orders
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) } },
        data: { status: 'CANCELED' },
      })
      for (const o of orders) {
        if (o.side === 'BUY') {
          await tx.user.update({
            where: { id: botUserId },
            data: { fiatBalance: { increment: parseFloat(o.price) * parseFloat(o.remainingQty) } },
          })
        } else {
          await tx.user.update({
            where: { id: botUserId },
            data: { assetBalance: { increment: parseFloat(o.remainingQty) } },
          })
        }
      }
    })
  }
}

async function placeLevel(side, price, qty) {
  const roundedPrice = Math.round(price * 100) / 100

  // ── Balance check before placing bot order ────────────────────────────────
  const botUser = await prisma.user.findUnique({
    where: { id: botUserId },
    select: { fiatBalance: true, assetBalance: true },
  })
  if (!botUser) return

  const fiat  = parseFloat(botUser.fiatBalance)
  const asset = parseFloat(botUser.assetBalance)

  if (side === 'BUY' && fiat < roundedPrice * qty) {
    console.warn(`[MarketMaker] Skipping BUY level — insufficient fiat (have ${fiat.toFixed(2)}, need ${(roundedPrice * qty).toFixed(2)})`)
    return
  }
  if (side === 'SELL' && asset < qty) {
    console.warn(`[MarketMaker] Skipping SELL level — insufficient asset (have ${asset.toFixed(6)}, need ${qty.toFixed(6)})`)
    return
  }

  // Reserve funds before creating order in DB
  await prisma.user.update({
    where: { id: botUserId },
    data: side === 'BUY'
      ? { fiatBalance:  { decrement: roundedPrice * qty } }
      : { assetBalance: { decrement: qty } },
  })

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
        // Credit maker (user whose order was resting)
        const makerOrder = await tx.order.findUnique({
          where: { id: t.makerOrderId },
          select: { userId: true, side: true },
        })
        if (makerOrder) {
          if (makerOrder.side === 'BUY') {
            await tx.user.update({ where: { id: makerOrder.userId }, data: { assetBalance: { increment: t.qty } } })
          } else {
            await tx.user.update({ where: { id: makerOrder.userId }, data: { fiatBalance: { increment: t.price * t.qty } } })
          }
        }
        // Credit taker (bot)
        if (side === 'BUY') {
          // Bot bought BTC — refund unused fiat reservation and credit BTC
          const actualCost = t.price * t.qty
          const reservedCost = roundedPrice * t.qty
          const fiatRefund = reservedCost - actualCost
          if (fiatRefund > 0) {
            await tx.user.update({ where: { id: botUserId }, data: { fiatBalance: { increment: fiatRefund } } })
          }
          await tx.user.update({ where: { id: botUserId }, data: { assetBalance: { increment: t.qty } } })
        } else {
          await tx.user.update({ where: { id: botUserId }, data: { fiatBalance: { increment: t.price * t.qty } } })
        }

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
  // Execute sequentially to avoid balance race conditions on the bot account
  for (const task of tasks) {
    await task
  }
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
