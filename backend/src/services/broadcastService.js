// Broadcast service — emit orderbook_state + trade_executed via Socket.io

import { orderBook } from '../engine/OrderBook.js'

let _io = null

/**
 * Initialize with the Socket.io server instance.
 * Called once at server startup.
 */
export function init(io) {
  _io = io
}

/**
 * Broadcast the current order book snapshot to all connected clients.
 */
export function broadcastOrderBook() {
  if (!_io) return
  _io.emit('orderbook_state', orderBook.snapshot())
}

/**
 * Broadcast a trade execution event.
 * @param {{ makerOrderId, takerOrderId, price, qty, executedAt, makerSide }} trade
 */
export function broadcastTrade(trade) {
  if (!_io) return
  _io.emit('trade_executed', {
    price:        trade.price,
    qty:          trade.qty,
    makerOrderId: trade.makerOrderId,
    takerOrderId: trade.takerOrderId,
    executedAt:   trade.executedAt,
    makerSide:    trade.makerSide, // actual maker side — not hardcoded
  })
}
