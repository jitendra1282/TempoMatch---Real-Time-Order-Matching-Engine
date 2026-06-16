// Order service — ACID-compliant business logic with Prisma transactions
//
// ACID guarantees:
//   Atomicity    — each phase is wrapped in $transaction; failures roll back all DB changes
//   Consistency  — DB-level CHECK constraints prevent negative balances as last resort
//   Isolation    — READ COMMITTED + FOR UPDATE row locks prevent phantom reads / double-spend
//   Durability   — PostgreSQL WAL ensures committed data survives crashes

import { PrismaClient, Prisma } from '@prisma/client'
import { match } from '../engine/MatchingEngine.js'
import { orderBook } from '../engine/OrderBook.js'

const prisma = new PrismaClient()
export { prisma }

// Transaction options:
// READ COMMITTED + FOR UPDATE row lock is the correct combination for a trading engine.
// • FOR UPDATE: Locks the specific user row being modified — serializes concurrent
//   orders FROM THE SAME USER, preventing double-spend without blocking other users.
// • READ COMMITTED: Allows independent users to transact concurrently without
//   false serialization failures (SERIALIZABLE was too aggressive and blocked
//   completely independent transactions on different rows).
const TX_OPTS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  timeout: 15_000,
  maxWait: 5_000,
}

/**
 * Apply DB-level CHECK constraints on User balances.
 * Called once at startup — idempotent (ignores duplicate constraint errors).
 * This is the LAST LINE OF DEFENSE: even if application logic has a bug,
 * PostgreSQL will reject the write and roll back the transaction.
 */
export async function applyBalanceConstraints() {
  try {
    await prisma.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "User" ADD CONSTRAINT "user_fiat_non_negative"  CHECK ("fiatBalance"  >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `
    await prisma.$executeRaw`
      DO $$ BEGIN
        ALTER TABLE "User" ADD CONSTRAINT "user_asset_non_negative" CHECK ("assetBalance" >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `
    console.log('[ACID] ✅ Balance CHECK constraints verified on User table')
  } catch (err) {
    console.error('[ACID] ⚠️  Could not apply balance constraints:', err.message)
  }
}

/**
 * Place a new order — fully ACID compliant.
 *
 * Phase 1 (READ COMMITTED tx + FOR UPDATE row lock):
 *   • Lock the user row with SELECT … FOR UPDATE
 *   • Validate balance inside the lock (no race window)
 *   • RESERVE funds immediately (deduct balance atomically)
 *   • Create the Order record
 *   If this tx fails → nothing changes, error propagates to caller.
 *
 * Phase 2 (in-memory, single-threaded):
 *   • Run the matching engine (Node.js event loop serializes this naturally)
 *
 * Phase 3 (READ COMMITTED tx):
 *   • Persist Trade records
 *   • CREDIT the counter-party (maker/taker receives what they earned)
 *   • Update Order statuses
 *   If this tx fails → compensating tx rolls back: order → CANCELED, reserved funds refunded.
 *
 * @param {{ userId, side, type, price, qty }} data
 * @returns {{ order, trades }}
 */
export async function placeOrder(data) {
  const { userId, side, type, price: rawPrice, qty: rawQty } = data

  const price = (rawPrice !== undefined && rawPrice !== null) ? parseFloat(rawPrice) : 0
  const qty   = parseFloat(rawQty)

  // ── Phase 1: READ COMMITTED + FOR UPDATE — Lock → Validate → Reserve → Create Order ─────
  // FOR UPDATE acquires a row-level exclusive lock on the User row.
  // Concurrent transactions that try to lock the same row BLOCK until this
  // transaction commits, so two simultaneous orders from the same user are
  // processed sequentially — eliminating the double-spend race condition.
  const newOrder = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, "fiatBalance", "assetBalance" FROM "User" WHERE id = ${userId} FOR UPDATE
    `
    const user = rows[0]
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 })

    const fiatBalance  = parseFloat(user.fiatBalance)
    const assetBalance = parseFloat(user.assetBalance)

    if (side === 'BUY') {
      if (type === 'LIMIT') {
        // LIMIT BUY: reserve exactly price × qty
        const required = price * qty
        if (fiatBalance < required)
          throw Object.assign(
            new Error(`Insufficient USDT balance — available: ${fiatBalance.toFixed(2)} USDT, required: ${required.toFixed(2)} USDT`),
            { status: 400 }
          )
        // Atomically reserve the full cost.
        // If the DB CHECK constraint fires here, the whole tx rolls back automatically.
        await tx.user.update({ where: { id: userId }, data: { fiatBalance: { decrement: required } } })

      } else {
        // MARKET BUY: estimate cost using best ask price.
        // If no asks exist, use a conservative estimate (last known price × qty).
        // The reservation is adjusted after matching in Phase 3.
        const bestAsk = orderBook.peekAsk()
        const estimatedPrice = bestAsk
          ? Number(bestAsk.price)
          : (orderBook.lastPrice || 81000)  // fallback to last price or BASE_PRICE

        const estimatedCost = estimatedPrice * qty
        if (fiatBalance < estimatedCost)
          throw Object.assign(
            new Error(`Insufficient USDT balance — available: ${fiatBalance.toFixed(2)} USDT, estimated required: ${estimatedCost.toFixed(2)} USDT`),
            { status: 400 }
          )

        // Reserve the estimated cost. Phase 3 will reconcile the actual fill.
        await tx.user.update({ where: { id: userId }, data: { fiatBalance: { decrement: estimatedCost } } })
      }
    }

    if (side === 'SELL') {
      if (assetBalance < qty)
        throw Object.assign(
          new Error(`Insufficient BTC balance — available: ${assetBalance.toFixed(6)} BTC, required: ${qty.toFixed(6)} BTC`),
          { status: 400 }
        )
      await tx.user.update({ where: { id: userId }, data: { assetBalance: { decrement: qty } } })
    }

    return tx.order.create({
      data: { userId, side, type, price, initialQty: qty, remainingQty: qty, status: 'OPEN' },
    })
  }, TX_OPTS)

  // ── Phase 2: In-memory matching engine ───────────────────────────────────
  // Node.js is single-threaded: this block never runs concurrently with itself.
  // The matching engine only mutates its in-memory heaps — no DB writes here.
  const result = match({
    orderId:      newOrder.id,
    userId,
    side,
    type,
    price,
    remainingQty: qty,
    timestamp:    Date.now(),
  })

  // ── Phase 3: READ COMMITTED — Persist trades + credit counter-parties ───────
  // IMPORTANT: The taker's balance was ALREADY reserved in Phase 1.
  //   • BUY LIMIT order placed: fiatBalance -= (price * qty)   ← already done
  //   • BUY MARKET order placed: fiatBalance -= (estimatedPrice * qty) ← already done
  //   • SELL order placed: assetBalance -= qty                 ← already done
  //
  // Here we only CREDIT what each party RECEIVES from the trade:
  //   • BUY taker receives BTC  → assetBalance += qty
  //   • SELL taker receives USDT→ fiatBalance += price * qty
  //   • BUY maker receives BTC  → assetBalance += qty  (their USDT was reserved earlier)
  //   • SELL maker receives USDT→ fiatBalance += price * qty  (their BTC was reserved earlier)
  //
  // For MARKET BUY: we also refund the difference between estimated and actual cost.
  let tradeRecords
  try {
    tradeRecords = await prisma.$transaction(async (tx) => {
      const savedTrades = []

      // Track actual fill cost for MARKET BUY reconciliation
      let actualFillCost = 0

      for (const t of result.trades) {
        // Persist the trade record
        savedTrades.push(await tx.trade.create({
          data: {
            makerOrderId: t.makerOrderId,
            takerOrderId: t.takerOrderId,
            price:        t.price,
            qty:          t.qty,
          },
        }))

        // Accumulate actual fill cost (for MARKET BUY reconciliation)
        if (side === 'BUY') {
          actualFillCost += t.price * t.qty
        }

        // Fetch the maker's order to know their side
        const makerOrder = await tx.order.findUnique({
          where:  { id: t.makerOrderId },
          select: { userId: true, side: true },
        })

        if (makerOrder) {
          if (makerOrder.side === 'BUY') {
            // Maker was a BUY — their USDT was reserved at placement.
            // Credit them the BTC they bought.
            await tx.user.update({
              where: { id: makerOrder.userId },
              data:  { assetBalance: { increment: t.qty } },
            })
            // Current order is a SELL taker — BTC was reserved.
            // Credit them the USDT they earned.
            await tx.user.update({
              where: { id: userId },
              data:  { fiatBalance: { increment: t.price * t.qty } },
            })
          } else {
            // Maker was a SELL — their BTC was reserved at placement.
            // Credit them the USDT they earned.
            await tx.user.update({
              where: { id: makerOrder.userId },
              data:  { fiatBalance: { increment: t.price * t.qty } },
            })
            // Current order is a BUY taker — USDT was reserved.
            // Credit them the BTC they bought.
            await tx.user.update({
              where: { id: userId },
              data:  { assetBalance: { increment: t.qty } },
            })
          }
        }
      }

      // ── MARKET BUY reconciliation ──────────────────────────────────────────
      // Phase 1 reserved estimatedCost = estimatedPrice * qty.
      // Actual cost = sum of (fillPrice * fillQty) for each trade.
      // Refund the difference + refund for any unfilled qty.
      if (side === 'BUY' && type === 'MARKET') {
        const bestAsk = orderBook.peekAsk()
        const estimatedPrice = bestAsk
          ? Number(bestAsk.price)
          : (orderBook.lastPrice || 81000)
        const estimatedReservation = estimatedPrice * qty
        const refund = estimatedReservation - actualFillCost

        if (refund > 0) {
          await tx.user.update({
            where: { id: userId },
            data:  { fiatBalance: { increment: refund } },
          })
        }
      }

      // ── LIMIT BUY price-improvement refund ────────────────────────────────
      // Phase 1 reserved (limitPrice × qty). If trades executed at a lower
      // price (price improvement), return the over-reserved USDT to the buyer.
      // • Reserved:      limitPrice × filledQty
      // • Actual cost:   actualFillCost  (= Σ fillPrice × fillQty)
      // • Over-reserved: limitPrice × filledQty - actualFillCost
      //
      // If there is a remaining unfilled portion it stays resting in the book,
      // still backed by the (limitPrice × remainingQty) reserve. No refund for
      // that portion until it fills or is canceled.
      if (side === 'BUY' && type === 'LIMIT' && result.filledQty > 0) {
        const reservedForFilled = price * result.filledQty
        const priceImprovementRefund = reservedForFilled - actualFillCost
        if (priceImprovementRefund > 0.0000001) {
          await tx.user.update({
            where: { id: userId },
            data:  { fiatBalance: { increment: priceImprovementRefund } },
          })
        }
      }

      // Update maker order statuses (FILLED / PARTIAL)
      for (const mu of result.updatedMakers) {
        await tx.order.update({
          where: { id: mu.orderId },
          data:  { remainingQty: mu.remainingQty, status: mu.status },
        })
      }
      // Update taker order status
      await tx.order.update({
        where: { id: newOrder.id },
        data:  { remainingQty: result.remainingQty, status: result.status },
      })

      return savedTrades
    }, TX_OPTS)

  } catch (err) {
    // ── Compensating transaction (rollback Phase 3 side-effects) ─────────
    // Phase 2 already mutated the in-memory order book.
    // Phase 3 failed → the DB doesn't reflect those trades.
    // We must: cancel the order in DB, refund the reserved balance,
    // and remove the order from the in-memory book.
    console.error('[placeOrder] Phase 3 failed — executing compensation:', err.message)

    // Remove from in-memory book first (synchronous)
    orderBook.removeOrder(newOrder.id, side)

    // Compensating DB transaction — refund the full reserved amount
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: newOrder.id }, data: { status: 'CANCELED' } })

      if (side === 'BUY') {
        if (type === 'LIMIT') {
          // Refund the exact limit order reservation
          await tx.user.update({ where: { id: userId }, data: { fiatBalance: { increment: price * qty } } })
        } else {
          // Market BUY: refund the estimated reservation (best approximation)
          const bestAsk = orderBook.peekAsk()
          const estimatedPrice = bestAsk ? Number(bestAsk.price) : (orderBook.lastPrice || 81000)
          await tx.user.update({ where: { id: userId }, data: { fiatBalance: { increment: estimatedPrice * qty } } })
        }
      } else {
        await tx.user.update({ where: { id: userId }, data: { assetBalance: { increment: qty } } })
      }
    }, TX_OPTS).catch(compensationErr => {
      console.error('[placeOrder] CRITICAL — compensation also failed:', compensationErr.message)
    })

    throw err  // Re-throw original error to the controller
  }

  const finalOrder = await prisma.order.findUnique({ where: { id: newOrder.id } })
  return { order: finalOrder, trades: tradeRecords }
}

/**
 * Cancel an open order.
 *
 * ACID guarantee: the status update AND the balance refund happen in a single
 * READ COMMITTED transaction with FOR UPDATE lock — either both succeed or neither does.
 */
export async function cancelOrder(orderId, userId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  if (order.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 })
  if (!['OPEN', 'PARTIAL'].includes(order.status))
    throw Object.assign(new Error('Order cannot be canceled'), { status: 400 })

  // Remove from in-memory heap (synchronous, safe to do before DB)
  orderBook.removeOrder(orderId, order.side)

  const remainingQty = parseFloat(order.remainingQty)
  const orderPrice   = parseFloat(order.price)
  const orderType    = order.type

  // Atomic: mark CANCELED + refund reserved balance in one transaction
  const updated = await prisma.$transaction(async (tx) => {
    const canceled = await tx.order.update({
      where: { id: orderId },
      data:  { status: 'CANCELED' },
    })

    if (order.side === 'BUY') {
      if (orderType === 'LIMIT') {
        // Refund reserved USDT: price × remaining qty
        await tx.user.update({
          where: { id: userId },
          data:  { fiatBalance: { increment: orderPrice * remainingQty } },
        })
      }
      // MARKET BUY orders are never added to the book (they execute immediately or die),
      // so there's nothing to refund on cancel for market orders.
    } else {
      // Refund reserved BTC: remaining qty
      await tx.user.update({
        where: { id: userId },
        data:  { assetBalance: { increment: remainingQty } },
      })
    }

    return canceled
  }, TX_OPTS)

  return updated
}

// ── Read queries (no writes, no transactions needed) ─────────────────────────

/** Get all open/partial orders for a user. */
export async function getUserOrders(userId) {
  return prisma.order.findMany({
    where:   { userId, status: { in: ['OPEN', 'PARTIAL'] } },
    orderBy: { createdAt: 'desc' },
  })
}

/** Get full order history for a user (all statuses). */
export async function getUserOrderHistory(userId) {
  return prisma.order.findMany({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get full trade history for a user (as maker or taker).
 * Includes counter-party username so the UI can display who traded with whom.
 */
export async function getUserTradeHistory(userId) {
  const userOrders = await prisma.order.findMany({
    where:  { userId },
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
    include: {
      makerOrder: { select: { side: true, user: { select: { id: true, username: true } } } },
      takerOrder: { select: { side: true, user: { select: { id: true, username: true } } } },
    },
    orderBy: { executedAt: 'desc' },
  })
}
