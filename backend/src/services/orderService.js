// Order service — business logic, prisma.$transaction wrapping

import { PrismaClient } from '@prisma/client'
import { match } from '../engine/MatchingEngine.js'
import { orderBook } from '../engine/OrderBook.js'

const prisma = new PrismaClient()
export { prisma }

/**
 * Place a new order:
 *  1. Validate user balance / asset holdings
 *  2. Run the in-memory matching engine
 *  3. Persist everything in one ACID transaction
 *
 * @param {{ userId, side, type, price, qty }} data
 * @returns {{ order, trades }}
 */
export async function placeOrder(data) {
  const { userId, side, type, price: rawPrice, qty: rawQty } = data

  // For MARKET orders price may be 0 / undefined — default to 0
  const price = (rawPrice !== undefined && rawPrice !== null) ? parseFloat(rawPrice) : 0
  const qty = parseFloat(rawQty)

  // Fetch user
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 })

  const fiatBalance = parseFloat(user.fiatBalance)
  const assetBalance = parseFloat(user.assetBalance)

  // Pre-trade balance checks
  if (side === 'BUY' && type === 'LIMIT') {
    const required = price * qty
    if (fiatBalance < required)
      throw Object.assign(new Error('Insufficient USDT balance'), { status: 400 })
  }
  if (side === 'SELL') {
    if (assetBalance < qty)
      throw Object.assign(new Error('Insufficient BTC balance'), { status: 400 })
  }

  // Create the taker order record first (needed for orderId in engine)
  const newOrder = await prisma.order.create({
    data: {
      userId,
      side,
      type,
      price,
      initialQty: qty,
      remainingQty: qty,
      status: 'OPEN',
    },
  })

  // Run matching engine (in-memory, no DB calls inside)
  const result = match({
    orderId: newOrder.id,
    userId,
    side,
    type,
    price,
    remainingQty: qty,
    timestamp: Date.now(),
  })

  // Persist everything atomically
  const tradeRecords = await prisma.$transaction(async (tx) => {
    const savedTrades = []

    // Persist each trade + update maker orders + update balances
    for (const t of result.trades) {
      const tradeRecord = await tx.trade.create({
        data: {
          makerOrderId: t.makerOrderId,
          takerOrderId: t.takerOrderId,
          price: t.price,
          qty: t.qty,
        },
      })
      savedTrades.push(tradeRecord)

      // Find the maker user to update their balance
      const makerOrder = await tx.order.findUnique({
        where: { id: t.makerOrderId },
        include: { user: true },
      })

      if (makerOrder) {
        if (makerOrder.side === 'BUY') {
          // Maker is a buyer: gains BTC, loses USDT
          await tx.user.update({
            where: { id: makerOrder.userId },
            data: { 
              assetBalance: { increment: t.qty },
              fiatBalance: { decrement: t.price * t.qty }
            },
          })
        } else {
          // Maker is a seller: gains USDT, loses BTC
          await tx.user.update({
            where: { id: makerOrder.userId },
            data: { 
              fiatBalance: { increment: t.price * t.qty },
              assetBalance: { decrement: t.qty }
            },
          })
        }
      }
    }

    // Update maker order statuses
    for (const mu of result.updatedMakers) {
      await tx.order.update({
        where: { id: mu.orderId },
        data: { remainingQty: mu.remainingQty, status: mu.status },
      })
    }

    // Update taker order
    await tx.order.update({
      where: { id: newOrder.id },
      data: { remainingQty: result.remainingQty, status: result.status },
    })

    // Update taker balance
    const fillQty = result.filledQty
    const fillCost = result.trades.reduce((sum, t) => sum + t.price * t.qty, 0)
    if (side === 'BUY') {
      await tx.user.update({
        where: { id: userId },
        data: {
          fiatBalance: { decrement: fillCost },
          assetBalance: { increment: fillQty },
        },
      })
    } else {
      await tx.user.update({
        where: { id: userId },
        data: {
          assetBalance: { decrement: fillQty },
          fiatBalance: { increment: fillCost },
        },
      })
    }

    return savedTrades
  })

  const finalOrder = await prisma.order.findUnique({ where: { id: newOrder.id } })
  return { order: finalOrder, trades: tradeRecords }
}

/**
 * Cancel an open order.
 * Removes from in-memory book + marks CANCELED in DB.
 */
export async function cancelOrder(orderId, userId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (order.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 })
  if (!['OPEN', 'PARTIAL'].includes(order.status))
    throw Object.assign(new Error('Order cannot be canceled'), { status: 400 })

  // Remove from in-memory heap
  orderBook.removeOrder(orderId, order.side)

  // Mark as canceled in DB
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CANCELED' },
  })

  return updated
}

/**
 * Get open orders for a user.
 */
export async function getUserOrders(userId) {
  return prisma.order.findMany({
    where: { userId, status: { in: ['OPEN', 'PARTIAL'] } },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get complete order history for a user (all statuses).
 */
export async function getUserOrderHistory(userId) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get complete trade history for a user (maker or taker).
 */
export async function getUserTradeHistory(userId) {
  const userOrders = await prisma.order.findMany({
    where: { userId },
    select: { id: true },
  })
  const orderIds = userOrders.map((o) => o.id)

  if (orderIds.length === 0) return []

  return prisma.trade.findMany({
    where: {
      OR: [
        { makerOrderId: { in: orderIds } },
        { takerOrderId: { in: orderIds } },
      ],
    },
    orderBy: { executedAt: 'desc' },
  })
}
