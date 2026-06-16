// Order controller — validate → engine.match() → DB persist → broadcast

import { placeOrder, cancelOrder, getUserOrders, getUserOrderHistory, getUserTradeHistory } from '../services/orderService.js'
import { broadcastOrderBook, broadcastTrade } from '../services/broadcastService.js'

/**
 * POST /api/v1/orders
 * Body: { userId, side, type, price, qty }
 */
export async function createOrder(req, res, next) {
  try {
    const { order, trades } = await placeOrder(req.body)

    // Broadcast real-time updates
    broadcastOrderBook()

    for (const trade of trades) {
      // Determine maker side by looking at the order that was resting in the book.
      // The taker side is the incoming order's side; the maker side is the opposite.
      const makerSide = req.body.side === 'BUY' ? 'SELL' : 'BUY'
      broadcastTrade({ ...trade, makerSide })
    }

    res.status(201).json({ order, trades })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/orders/:id?userId=<uuid>
 */
export async function deleteOrder(req, res, next) {
  try {
    const { id } = req.params
    const { userId } = req.query

    const order = await cancelOrder(id, userId)

    // Broadcast updated order book (order removed)
    broadcastOrderBook()

    res.json({ order })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/orders?userId=<uuid>
 * Returns open + partial orders for the user.
 */
export async function listOrders(req, res, next) {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId query param required' })

    const orders = await getUserOrders(userId)
    res.json({ orders })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/orders/history?userId=<uuid>
 * Returns complete order history for the user.
 */
export async function getHistory(req, res, next) {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId query param required' })

    const orders = await getUserOrderHistory(userId)
    res.json({ orders })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/orders/trades?userId=<uuid>
 * Returns complete trade history for the user.
 */
export async function getTrades(req, res, next) {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId query param required' })

    const trades = await getUserTradeHistory(userId)
    res.json({ trades })
  } catch (err) {
    next(err)
  }
}
