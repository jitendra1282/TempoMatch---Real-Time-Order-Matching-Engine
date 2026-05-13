// Order Book — bids (MaxHeap) + asks (MinHeap)

import { MaxHeap, MinHeap } from './Heap.js'

class OrderBook {
  constructor() {
    this.bids = new MaxHeap()  // BUY orders — highest price wins
    this.asks = new MinHeap()  // SELL orders — lowest price wins
    this.lastPrice = null      // Last matched trade price
  }

  /**
   * Add an order to the appropriate heap.
   * @param {{ orderId: string, side: 'BUY'|'SELL', price: number|string, timestamp: number }} order
   */
  addOrder(order) {
    const entry = {
      orderId: order.orderId,
      price: Number(order.price),
      timestamp: order.timestamp ?? Date.now(),
      remainingQty: Number(order.remainingQty),
      userId: order.userId,
    }
    if (order.side === 'BUY') {
      this.bids.push(entry)
    } else {
      this.asks.push(entry)
    }
  }

  /**
   * Remove an order from the appropriate heap by orderId.
   */
  removeOrder(orderId, side) {
    if (side === 'BUY') {
      return this.bids.remove(orderId)
    } else {
      return this.asks.remove(orderId)
    }
  }

  /**
   * Peek at the best bid or ask without removing it.
   */
  peekBid() { return this.bids.peek() }
  peekAsk() { return this.asks.peek() }

  /**
   * Return a UI-ready snapshot of the order book.
   * Groups by price level and sums qty.
   * @returns {{ bids: Array, asks: Array, lastPrice: number|null }}
   */
  snapshot() {
    const aggregateLevel = (items) => {
      const map = new Map()
      for (const item of items) {
        const price = Number(item.price)
        if (!map.has(price)) map.set(price, 0)
        map.set(price, map.get(price) + Number(item.remainingQty))
      }
      return [...map.entries()].map(([price, amount]) => ({
        price,
        amount,
        total: price * amount,
      }))
    }

    const rawBids = this.bids.toSorted()
    const rawAsks = this.asks.toSorted()

    return {
      bids: aggregateLevel(rawBids),
      asks: aggregateLevel(rawAsks),
      lastPrice: this.lastPrice,
    }
  }
}

// Export singleton
export const orderBook = new OrderBook()
