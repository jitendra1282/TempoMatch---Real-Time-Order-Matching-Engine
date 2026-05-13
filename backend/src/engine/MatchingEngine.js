// Matching Engine — core match() loop + self-trade prevention

import { orderBook } from './OrderBook.js'

/**
 * Attempt to match an incoming order against the resting order book.
 *
 * @param {{
 *   orderId: string,
 *   userId:  string,
 *   side:    'BUY' | 'SELL',
 *   type:    'LIMIT' | 'MARKET',
 *   price:   number,
 *   remainingQty: number,
 *   timestamp: number,
 * }} incoming
 *
 * @returns {{
 *   trades: Array<{ makerOrderId, takerOrderId, price, qty }>,
 *   filledQty: number,
 *   updatedMakers: Array<{ orderId, remainingQty, status }>,
 *   remainingQty: number,
 *   status: 'OPEN' | 'PARTIAL' | 'FILLED',
 * }}
 */
export function match(incoming) {
  const trades = []
  const updatedMakers = []
  let remainingQty = Number(incoming.remainingQty)

  const oppSide = incoming.side === 'BUY' ? 'ask' : 'bid'
  const heap = oppSide === 'ask' ? orderBook.asks : orderBook.bids

  while (remainingQty > 0 && !heap.isEmpty()) {
    const best = heap.peek()

    // Price check for LIMIT orders
    if (incoming.type === 'LIMIT') {
      const crossable =
        incoming.side === 'BUY'
          ? Number(incoming.price) >= Number(best.price)   // bid >= ask
          : Number(incoming.price) <= Number(best.price)   // ask <= bid
      if (!crossable) break
    }

    // Self-trade prevention — skip this resting order
    if (best.userId === incoming.userId) {
      break // conservative: stop matching entirely to avoid wash trades
    }

    // Fill quantity
    const fillQty = Math.min(remainingQty, Number(best.remainingQty))
    const fillPrice = Number(best.price) // maker price priority

    remainingQty = +(remainingQty - fillQty).toFixed(8)
    const makerRemaining = +(Number(best.remainingQty) - fillQty).toFixed(8)

    // Record trade
    trades.push({
      makerOrderId: best.orderId,
      takerOrderId: incoming.orderId,
      price: fillPrice,
      qty: fillQty,
    })

    // Update last traded price
    orderBook.lastPrice = fillPrice

    // Update or remove the maker from the heap
    heap.pop()

    if (makerRemaining > 0) {
      // Partially filled maker — push back with updated qty
      heap.push({ ...best, remainingQty: makerRemaining })
      updatedMakers.push({
        orderId: best.orderId,
        remainingQty: makerRemaining,
        status: 'PARTIAL',
      })
    } else {
      updatedMakers.push({
        orderId: best.orderId,
        remainingQty: 0,
        status: 'FILLED',
      })
    }
  }

  // Determine taker status
  let status
  const filledQty = Number(incoming.remainingQty) - remainingQty
  if (filledQty === 0) status = 'OPEN'
  else if (remainingQty > 0) status = 'PARTIAL'
  else status = 'FILLED'

  // If taker is not fully filled and is a LIMIT order, add to book
  if (status !== 'FILLED' && incoming.type === 'LIMIT') {
    orderBook.addOrder({ ...incoming, remainingQty })
  }

  return { trades, filledQty, updatedMakers, remainingQty, status }
}
