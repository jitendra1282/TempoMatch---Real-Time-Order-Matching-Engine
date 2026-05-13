// Warm boot — repopulate in-memory heaps from PostgreSQL on server start
// Ensures crash recovery: open orders survive restarts

import { prisma } from '../services/orderService.js'
import { orderBook } from '../engine/OrderBook.js'

export async function repopulateHeaps() {
  console.log('[WarmBoot] Loading open orders from database...')

  const openOrders = await prisma.order.findMany({
    where: { status: { in: ['OPEN', 'PARTIAL'] } },
    orderBy: { createdAt: 'asc' }, // maintain time priority
  })

  for (const order of openOrders) {
    orderBook.addOrder({
      orderId: order.id,
      userId: order.userId,
      side: order.side,
      price: Number(order.price),
      remainingQty: Number(order.remainingQty),
      timestamp: new Date(order.createdAt).getTime(),
    })
  }

  console.log(`[WarmBoot] Loaded ${openOrders.length} open order(s) into memory.`)
}
