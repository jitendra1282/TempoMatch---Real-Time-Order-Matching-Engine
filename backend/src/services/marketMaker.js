// Market Maker Bot — keeps the order book populated so user orders fill quickly
//
// KEY DESIGN PRINCIPLE — "User-First" Market Making:
//   The bot NEVER competes with user orders at the same price.
//   Before seeding each side, it checks the order book for non-bot orders and
//   places bot orders OUTSIDE the user-order range. This guarantees that when
//   User A and User B place matching orders, they trade with EACH OTHER — not
//   with the bot.
//
//   • Bot BUY  levels → always BELOW the highest non-bot BID
//   • Bot SELL levels → always ABOVE the lowest  non-bot ASK
//
//   If no user orders exist, the bot fills the entire book normally.

import { PrismaClient } from '@prisma/client'
import { match } from '../engine/MatchingEngine.js'
import { orderBook } from '../engine/OrderBook.js'
import { broadcastOrderBook } from './broadcastService.js'

const prisma = new PrismaClient()

const BOT_USERNAME  = 'TempoBot'
const BASE_PRICE    = 81_000      // Starting mid price (USDT)
const SPREAD_PCT    = 0.004       // 0.4% half-spread (wider = less interference)
const LEVELS        = 8           // How many levels on each side
const LEVEL_GAP_PCT = 0.002       // 0.2% gap between each level
const QTY_PER_LEVEL = 0.5        // BTC per level
const REFRESH_MS    = 8_000       // Refresh every 8 seconds
const INITIAL_FIAT  = 9_999_999
const INITIAL_ASSET = 999
// Bot orders will never be placed within this % of a resting user order.
// E.g. 0.5% means: bot SELL floor = lowestUserAsk × 1.005
const USER_ORDER_BUFFER = 0.005

let botUserId    = null
let refreshTimer = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function midPrice() {
  const last = orderBook.lastPrice
  // Safety guard: ignore unrealistic prices from test orders
  if (!last || last > BASE_PRICE * 10 || last < BASE_PRICE * 0.1) return BASE_PRICE
  return last
}

/**
 * Return the lowest non-bot SELL price and highest non-bot BUY price in the DB.
 * Used to keep bot orders outside the user-order price range.
 */
async function getUserOrderBounds() {
  if (!botUserId) return { lowestUserAsk: null, highestUserBid: null }

  const [lowestAsk, highestBid] = await Promise.all([
    prisma.order.findFirst({
      where: { userId: { not: botUserId }, side: 'SELL', status: { in: ['OPEN', 'PARTIAL'] } },
      orderBy: { price: 'asc' },
      select: { price: true },
    }),
    prisma.order.findFirst({
      where: { userId: { not: botUserId }, side: 'BUY',  status: { in: ['OPEN', 'PARTIAL'] } },
      orderBy: { price: 'desc' },
      select: { price: true },
    }),
  ])

  return {
    lowestUserAsk:  lowestAsk  ? parseFloat(lowestAsk.price)  : null,
    highestUserBid: highestBid ? parseFloat(highestBid.price) : null,
  }
}

async function ensureBotUser() {
  let user = await prisma.user.findUnique({ where: { username: BOT_USERNAME } })
  if (!user) {
    user = await prisma.user.create({
      data: { username: BOT_USERNAME, fiatBalance: INITIAL_FIAT, assetBalance: INITIAL_ASSET },
    })
    console.log('[MarketMaker] Created bot user:', user.id)
  }
  return user
}

async function cancelAllBotOrders() {
  if (!botUserId) return
  const orders = await prisma.order.findMany({
    where:  { userId: botUserId, status: { in: ['OPEN', 'PARTIAL'] } },
    select: { id: true, side: true, price: true, remainingQty: true },
  })

  for (const o of orders) orderBook.removeOrder(o.id, o.side)

  if (orders.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) } },
        data:  { status: 'CANCELED' },
      })
      for (const o of orders) {
        if (o.side === 'BUY') {
          await tx.user.update({
            where: { id: botUserId },
            data:  { fiatBalance: { increment: parseFloat(o.price) * parseFloat(o.remainingQty) } },
          })
        } else {
          await tx.user.update({
            where: { id: botUserId },
            data:  { assetBalance: { increment: parseFloat(o.remainingQty) } },
          })
        }
      }
    })
  }
}

/** Exported version so admin routes can cancel bot orders without restarting */
export async function cancelAllBotOrdersForAdmin() {
  if (!botUserId) {
    // Bot might not be initialized — look up the user
    const user = await prisma.user.findUnique({ where: { username: BOT_USERNAME } })
    if (user) botUserId = user.id
  }
  await cancelAllBotOrders()
}


async function placeLevel(side, price, qty) {
  const roundedPrice = Math.round(price * 100) / 100

  const botUser = await prisma.user.findUnique({
    where:  { id: botUserId },
    select: { fiatBalance: true, assetBalance: true },
  })
  if (!botUser) return

  const fiat  = parseFloat(botUser.fiatBalance)
  const asset = parseFloat(botUser.assetBalance)

  if (side === 'BUY'  && fiat  < roundedPrice * qty) return
  if (side === 'SELL' && asset < qty)                return

  // Reserve funds
  await prisma.user.update({
    where: { id: botUserId },
    data: side === 'BUY'
      ? { fiatBalance:  { decrement: roundedPrice * qty } }
      : { assetBalance: { decrement: qty } },
  })

  const order = await prisma.order.create({
    data: {
      userId:      botUserId,
      side,
      type:        'LIMIT',
      price:       roundedPrice,
      initialQty:  qty,
      remainingQty: qty,
      status:      'OPEN',
    },
  })

  const result = match({
    orderId:      order.id,
    userId:       botUserId,
    side,
    type:         'LIMIT',
    price:        roundedPrice,
    remainingQty: qty,
    timestamp:    Date.now(),
  })

  // Persist fills if any matched
  if (result.trades.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const t of result.trades) {
        await tx.trade.create({
          data: {
            makerOrderId: t.makerOrderId,
            takerOrderId: t.takerOrderId,
            price: t.price,
            qty:   t.qty,
          },
        })
        const makerOrder = await tx.order.findUnique({
          where: { id: t.makerOrderId },
          select: { userId: true, side: true },
        })
        if (makerOrder) {
          if (makerOrder.side === 'BUY') {
            await tx.user.update({ where: { id: makerOrder.userId }, data: { assetBalance: { increment: t.qty } } })
          } else {
            await tx.user.update({ where: { id: makerOrder.userId }, data: { fiatBalance:  { increment: t.price * t.qty } } })
          }
        }
        if (side === 'BUY') {
          const fiatRefund = roundedPrice * t.qty - t.price * t.qty
          if (fiatRefund > 0) {
            await tx.user.update({ where: { id: botUserId }, data: { fiatBalance: { increment: fiatRefund } } })
          }
          await tx.user.update({ where: { id: botUserId }, data: { assetBalance: { increment: t.qty } } })
        } else {
          await tx.user.update({ where: { id: botUserId }, data: { fiatBalance: { increment: t.price * t.qty } } })
        }
        await tx.order.update({ where: { id: t.makerOrderId }, data: { remainingQty: 0, status: 'FILLED' } })
      }
      await tx.order.update({
        where: { id: order.id },
        data:  { remainingQty: result.remainingQty, status: result.status },
      })
    })
  }
}

async function seedBook() {
  const mid = midPrice()

  // ── User-First Constraint ──────────────────────────────────────────────────
  // Determine floors/ceilings so bot orders never compete with user orders.
  const { lowestUserAsk, highestUserBid } = await getUserOrderBounds()

  // Bot SELL floor: must be strictly ABOVE the cheapest user SELL (+ buffer)
  // If no user SELLs exist, use the default spread from mid.
  const defaultAskBase = mid * (1 + SPREAD_PCT)
  const botAskBase = lowestUserAsk
    ? Math.max(defaultAskBase, lowestUserAsk * (1 + USER_ORDER_BUFFER))
    : defaultAskBase

  // Bot BUY ceiling: must be strictly BELOW the highest user BUY (- buffer)
  // If no user BUYs exist, use the default spread from mid.
  const defaultBidBase = mid * (1 - SPREAD_PCT)
  const botBidBase = highestUserBid
    ? Math.min(defaultBidBase, highestUserBid * (1 - USER_ORDER_BUFFER))
    : defaultBidBase

  if (lowestUserAsk) {
    console.log(`[MarketMaker] User SELL detected at ${lowestUserAsk} → bot ASKs start at ${botAskBase.toFixed(2)}`)
  }
  if (highestUserBid) {
    console.log(`[MarketMaker] User BUY  detected at ${highestUserBid} → bot BIDs start at ${botBidBase.toFixed(2)}`)
  }

  const tasks = []
  for (let i = 0; i < LEVELS; i++) {
    const askPrice = botAskBase * (1 + i * LEVEL_GAP_PCT)
    const bidPrice = botBidBase * (1 - i * LEVEL_GAP_PCT)
    const qty = QTY_PER_LEVEL * (1 + (Math.random() - 0.5) * 0.4)
    tasks.push(placeLevel('SELL', askPrice, +qty.toFixed(5)))
    tasks.push(placeLevel('BUY',  bidPrice, +qty.toFixed(5)))
  }

  // Sequential execution to avoid balance race conditions on the bot account
  for (const task of tasks) await task
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
    await seedBook()
    console.log(`[MarketMaker] ✅ Started — seeding ${LEVELS} levels each side every ${REFRESH_MS / 1000}s`)
    refreshTimer = setInterval(refresh, REFRESH_MS)
  } catch (err) {
    console.error('[MarketMaker] Failed to start:', err.message)
  }
}

export function stopMarketMaker() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
    console.log('[MarketMaker] ⏹ Stopped')
  }
}
