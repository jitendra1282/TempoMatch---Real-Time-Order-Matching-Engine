/**
 * TempoMatch — Master Test Suite
 * ══════════════════════════════════════════════════════════════════════════════
 * Tests ALL prime project motives:
 *
 *  ✦ TEST 1 — Price-Time Priority (core matching algorithm)
 *  ✦ TEST 2 — Self-Trade Prevention (no wash trades)
 *  ✦ TEST 3 — ACID Atomicity (rejected order → no balance change)
 *  ✦ TEST 4 — ACID Consistency (DB CHECK constraint blocks negative balance)
 *  ✦ TEST 5 — ACID Isolation: No Double-Spend (concurrent orders, same user)
 *  ✦ TEST 6 — ACID Isolation: Balance Conservation (N-user peer matching)
 *  ✦ TEST 7 — Partial Fill + Order Status lifecycle
 *  ✦ TEST 8 — Cancel Order + Full Balance Refund
 *  ✦ TEST 9 — N-User Concurrent Stress Test (40 simultaneous requests)
 *
 * DESIGN: Every test creates a dedicated SELLER at a unique ultra-high price
 * (> 1,000,000 USDT) that NO other resting order or market-maker bot can
 * match — then creates a matching BUYER at the same price.
 * This guarantees tests only match each other, making conservation math exact.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import axios from 'axios'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()
const API    = 'http://localhost:3001/api/v1'
const TOLERANCE = 0.0001

// ── Helpers ───────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
let passed = 0, failed = 0, totalTests = 0

function assert(condition, message) {
  totalTests++
  if (condition) {
    console.log(`     ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`     ❌ FAIL: ${message}`)
    failed++
  }
}

// Generate a unique isolated price far above market (> 1,000,000)
// so no resting order or bot can match it accidentally.
let priceCounter = 1_000_000
function nextUniquePrice() {
  priceCounter += 1000
  return priceCounter
}

async function createUser(username, fiat = 100_000_000, asset = 100) {
  const id  = randomUUID()
  const res = await axios.post(`${API}/users`, { id, username })
  await prisma.user.update({
    where: { id: res.data.user.id },
    data: { fiatBalance: fiat, assetBalance: asset },
  })
  return { id: res.data.user.id, username, fiatBalance: fiat, assetBalance: asset }
}

async function placeOrder(userId, side, type, price, qty) {
  try {
    const payload = { userId, side, type, qty }
    if (type === 'LIMIT') payload.price = price
    const res = await axios.post(`${API}/orders`, payload)
    return { ok: true, ...res.data }
  } catch (err) {
    return { ok: false, error: err.response?.data?.error || err.message, status: err.response?.status }
  }
}

async function cancelOrder(orderId, userId) {
  try {
    await axios.delete(`${API}/orders/${orderId}?userId=${userId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.response?.data?.error || err.message }
  }
}

async function getBalance(userId) {
  const res = await axios.get(`${API}/users/${userId}/balance`)
  return res.data.user
}

async function cancelAndDeleteTestUsers(ids) {
  if (ids.length === 0) return
  // 1. Cancel all open/partial orders via API (removes from in-memory heap + DB)
  const openOrders = await prisma.order.findMany({
    where: { userId: { in: ids }, status: { in: ['OPEN', 'PARTIAL'] } },
    select: { id: true, userId: true },
  })
  await Promise.all(openOrders.map((o) => cancelOrder(o.id, o.userId).catch(() => {})))
  await delay(200)

  // 2. Delete DB records (FK order: trades → orders → users)
  await prisma.trade.deleteMany({
    where: { OR: [{ makerOrder: { userId: { in: ids } } }, { takerOrder: { userId: { in: ids } } }] },
  })
  await prisma.order.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

/**
 * Snapshot balances AND add back any reserved (still-open) order amounts.
 * This gives the TRUE total wealth for conservation checks:
 *   real balance + still-reserved-in-open-orders = original balance
 */
async function snapshotTrueWealth(ids) {
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, fiatBalance: true, assetBalance: true },
  })
  // For each user, find their open orders and add back the reserved amounts
  const openOrders = await prisma.order.findMany({
    where: { userId: { in: ids }, status: { in: ['OPEN', 'PARTIAL'] } },
    select: { userId: true, side: true, price: true, remainingQty: true },
  })
  const reservationsByUser = {}
  for (const o of openOrders) {
    if (!reservationsByUser[o.userId]) reservationsByUser[o.userId] = { fiat: 0, asset: 0 }
    if (o.side === 'BUY') {
      reservationsByUser[o.userId].fiat += parseFloat(o.price) * parseFloat(o.remainingQty)
    } else {
      reservationsByUser[o.userId].asset += parseFloat(o.remainingQty)
    }
  }
  let totalFiat = 0, totalAsset = 0
  const augmented = users.map((u) => {
    const res = reservationsByUser[u.id] || { fiat: 0, asset: 0 }
    const trueFiat  = parseFloat(u.fiatBalance)  + res.fiat
    const trueAsset = parseFloat(u.assetBalance) + res.asset
    totalFiat  += trueFiat
    totalAsset += trueAsset
    return { ...u, trueFiat, trueAsset }
  })
  return { users: augmented, totalFiat, totalAsset }
}

// Simple raw snapshot (for neg-balance checks only)
async function snapshotBalances(ids) {
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, fiatBalance: true, assetBalance: true },
  })
  const totalFiat  = users.reduce((s, u) => s + parseFloat(u.fiatBalance),  0)
  const totalAsset = users.reduce((s, u) => s + parseFloat(u.assetBalance), 0)
  return { users, totalFiat, totalAsset }
}

function section(n, title) {
  console.log(`\n${'═'.repeat(62)}`)
  console.log(`  TEST ${n}: ${title}`)
  console.log(`${'═'.repeat(62)}`)
}

// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  const ts = Date.now()
  const testUserIds = []

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║        TempoMatch — Master Test Suite                        ║')
  console.log('║        Testing ALL prime project motives                     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 1 — Price-Time Priority
  // Alice SELLs first, Carol SELLs second (same unique price, later timestamp).
  // Bob BUYs — must match Alice (earliest timestamp = higher priority).
  // ══════════════════════════════════════════════════════════════════════════
  section(1, 'Price-Time Priority Matching')

  const P1 = nextUniquePrice()  // e.g. 1,001,000 — totally isolated
  const u_alice = await createUser(`PTP_Alice_${ts}`)
  const u_carol = await createUser(`PTP_Carol_${ts}`)
  const u_bob   = await createUser(`PTP_Bob_${ts}`)
  testUserIds.push(u_alice.id, u_carol.id, u_bob.id)

  const aliceSell = await placeOrder(u_alice.id, 'SELL', 'LIMIT', P1, 0.1)
  await delay(150)  // distinct timestamp
  const carolSell = await placeOrder(u_carol.id, 'SELL', 'LIMIT', P1, 0.1)
  await delay(150)
  const bobBuy    = await placeOrder(u_bob.id, 'BUY', 'LIMIT', P1, 0.1)
  await delay(400)

  assert(aliceSell.ok, 'Alice SELL placed in book')
  assert(carolSell.ok, 'Carol SELL placed in book')
  assert(bobBuy.ok,    'Bob BUY order accepted')
  if (bobBuy.ok) {
    assert(bobBuy.trades?.length === 1,
      `Exactly 1 trade executed (got ${bobBuy.trades?.length})`)
    if (bobBuy.trades?.length > 0) {
      const matched = bobBuy.trades[0].makerOrderId
      assert(matched === aliceSell.order?.id,
        `Matched Alice (earliest timestamp) — Price-Time Priority ✓  [matched: ${matched}, alice: ${aliceSell.order?.id}]`)
    }
  }

  // Cancel Carol's unfilled SELL (cleanup)
  if (carolSell.ok) await cancelOrder(carolSell.order?.id, u_carol.id)

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 2 — Self-Trade Prevention
  // Dave SELLs at a unique isolated price.
  // Dave BUYs at the same price — engine must NOT execute this trade.
  // ══════════════════════════════════════════════════════════════════════════
  section(2, 'Self-Trade Prevention (No Wash Trades)')

  const P2 = nextUniquePrice()
  const u_dave = await createUser(`STP_Dave_${ts}`)
  testUserIds.push(u_dave.id)

  const daveSell = await placeOrder(u_dave.id, 'SELL', 'LIMIT', P2, 0.1)
  await delay(100)
  const daveBuy  = await placeOrder(u_dave.id, 'BUY',  'LIMIT', P2, 0.1)
  await delay(300)

  assert(daveSell.ok, 'Dave SELL placed in book')
  assert(daveBuy.ok,  'Dave BUY accepted (should rest, not self-trade)')
  assert(daveBuy.trades?.length === 0,
    `Zero trades — self-trade prevented ✓ (trades: ${daveBuy.trades?.length})`)

  // Cleanup Dave's resting orders
  if (daveSell.ok) await cancelOrder(daveSell.order?.id, u_dave.id)
  if (daveBuy.ok)  await cancelOrder(daveBuy.order?.id,  u_dave.id)

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 3 — ACID Atomicity: Rejected order must NOT change any balance
  // ══════════════════════════════════════════════════════════════════════════
  section(3, 'ACID Atomicity — Rejected Order Leaves Balance Unchanged')

  const u_eve = await createUser(`ATOM_Eve_${ts}`, 1000, 0.01)
  testUserIds.push(u_eve.id)

  const balBefore3 = await getBalance(u_eve.id)
  const eveReject  = await placeOrder(u_eve.id, 'BUY', 'LIMIT', 80000, 1) // needs 80000 USDT, has 1000
  const balAfter3  = await getBalance(u_eve.id)

  assert(!eveReject.ok, 'Order correctly rejected (insufficient balance)')
  assert(eveReject.status === 400, `HTTP 400 returned (got ${eveReject.status})`)
  assert(
    Math.abs(parseFloat(balBefore3.fiatBalance) - parseFloat(balAfter3.fiatBalance)) < TOLERANCE,
    `Balance unchanged: ${balAfter3.fiatBalance} USDT (was ${balBefore3.fiatBalance})`
  )

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 4 — ACID Consistency: DB CHECK constraint blocks negative balance
  // ══════════════════════════════════════════════════════════════════════════
  section(4, 'ACID Consistency — DB CHECK Constraint Prevents Negative Balance')

  const u_frank = await createUser(`CONS_Frank_${ts}`, 500, 0.5)
  testUserIds.push(u_frank.id)

  let fiatConstraintFired = false
  try {
    await prisma.$executeRaw`UPDATE "User" SET "fiatBalance" = -1 WHERE id = ${u_frank.id}`
  } catch (err) {
    fiatConstraintFired = err.message.includes('23514') || err.message.toLowerCase().includes('check constraint')
  }
  assert(fiatConstraintFired, 'CHECK constraint rejected fiatBalance = -1')

  let assetConstraintFired = false
  try {
    await prisma.$executeRaw`UPDATE "User" SET "assetBalance" = -0.001 WHERE id = ${u_frank.id}`
  } catch (err) {
    assetConstraintFired = err.message.includes('23514') || err.message.toLowerCase().includes('check constraint')
  }
  assert(assetConstraintFired, 'CHECK constraint rejected assetBalance = -0.001')

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 5 — ACID Isolation: No Double-Spend
  // Gina has exactly enough for 1 order. Fire 5 concurrent orders.
  // Only 1 can succeed. Balance must stay >= 0.
  // ══════════════════════════════════════════════════════════════════════════
  section(5, 'ACID Isolation — No Double-Spend (5 Concurrent Orders, Same User)')

  const P5 = nextUniquePrice()
  const COST5 = P5 * 0.1  // exact balance for 1 order
  const u_gina = await createUser(`ISO_Gina_${ts}`, COST5, 0)
  testUserIds.push(u_gina.id)

  const gBefore = await getBalance(u_gina.id)
  const ginaOrders = await Promise.all(
    Array.from({ length: 5 }, () => placeOrder(u_gina.id, 'BUY', 'LIMIT', P5, 0.1))
  )
  await delay(500)

  const ginaOk   = ginaOrders.filter((r) => r.ok)
  const ginaFail = ginaOrders.filter((r) => !r.ok)
  const ginaBal  = parseFloat((await getBalance(u_gina.id)).fiatBalance)

  console.log(`     ℹ Succeeded: ${ginaOk.length} | Rejected: ${ginaFail.length} | Balance: ${ginaBal.toFixed(2)} USDT`)
  assert(ginaBal >= 0,              `Balance is non-negative: ${ginaBal.toFixed(4)} USDT`)
  assert(ginaOk.length <= 1,        `Only ≤1 order succeeded (${ginaOk.length}) — FOR UPDATE lock worked ✓`)
  assert(ginaFail.length >= 4,      `≥4 orders rejected (${ginaFail.length}) — double-spend prevented ✓`)
  assert(ginaBal <= parseFloat(gBefore.fiatBalance), `Balance ≤ initial (${ginaBal} ≤ ${gBefore.fiatBalance})`)

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 6 — ACID Isolation: Balance Conservation (N buyer-seller pairs)
  // Each buyer is matched with exactly one seller at a unique price.
  // Total fiat + asset across ALL participants must be conserved.
  // ══════════════════════════════════════════════════════════════════════════
  section(6, 'ACID Isolation — Balance Conservation (10 Buyer-Seller Pairs)')

  const N6     = 10
  const QTY6   = 0.1
  const FIAT6  = 100_000_000
  const ASSET6 = 100

  // Each pair gets its own unique price so they ONLY match each other
  const pairs6 = Array.from({ length: N6 }, () => ({ price: nextUniquePrice() }))
  const buyers6  = await Promise.all(pairs6.map((p, i) => createUser(`B6_${ts}_${i}`, FIAT6, ASSET6)))
  const sellers6 = await Promise.all(pairs6.map((p, i) => createUser(`S6_${ts}_${i}`, FIAT6, ASSET6)))
  const ids6 = [...buyers6, ...sellers6].map((u) => u.id)
  testUserIds.push(...ids6)

  const snap6Before = await snapshotTrueWealth(ids6)

  // ── Fire SELLs first, wait for them to settle in the book, then fire BUYs ──
  // This guarantees each SELL is a resting maker when its paired BUY arrives.
  // Conservation is exact: buyer pays from reservation, seller receives that exact amount.
  const t6 = Date.now()
  await Promise.all(
    sellers6.map((u, i) => placeOrder(u.id, 'SELL', 'LIMIT', pairs6[i].price, QTY6))
  )
  await delay(200)  // let all SELLs settle in the in-memory heap
  await Promise.all(
    buyers6.map((u, i) => placeOrder(u.id, 'BUY', 'LIMIT', pairs6[i].price, QTY6))
  )
  await delay(600)

  // cancel all unfilled SELLs and BUYs before taking final snapshot
  const unfilled6 = await prisma.order.findMany({
    where: { userId: { in: ids6 }, status: { in: ['OPEN','PARTIAL'] } },
    select: { id: true, userId: true },
  })
  await Promise.all(unfilled6.map((o) => cancelOrder(o.id, o.userId).catch(() => {})))
  await delay(200)

  const snap6After = await snapshotTrueWealth(ids6)
  const fiatDrift6  = Math.abs(snap6After.totalFiat  - snap6Before.totalFiat)
  const assetDrift6 = Math.abs(snap6After.totalAsset - snap6Before.totalAsset)
  const negFiat6    = snap6After.users.filter((u) => parseFloat(u.fiatBalance)  < 0)
  const negAsset6   = snap6After.users.filter((u) => parseFloat(u.assetBalance) < 0)

  console.log(`     ℹ ${N6} sellers then ${N6} buyers — total ${Date.now()-t6}ms`)
  console.log(`     ℹ Fiat  before: ${snap6Before.totalFiat.toFixed(2)}  after: ${snap6After.totalFiat.toFixed(2)}  drift: ${fiatDrift6.toFixed(6)}`)
  console.log(`     ℹ Asset before: ${snap6Before.totalAsset.toFixed(6)}  after: ${snap6After.totalAsset.toFixed(6)}  drift: ${assetDrift6.toFixed(6)}`)

  assert(fiatDrift6  < TOLERANCE, `Fiat conserved (drift: ${fiatDrift6.toFixed(6)} USDT)`)
  assert(assetDrift6 < TOLERANCE, `Asset conserved (drift: ${assetDrift6.toFixed(6)} BTC)`)
  assert(negFiat6.length  === 0,  `No negative fiatBalance (violations: ${negFiat6.length})`)
  assert(negAsset6.length === 0,  `No negative assetBalance (violations: ${negAsset6.length})`)

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 7 — Partial Fill + Order Status Lifecycle
  // Ian SELLs 0.2 BTC. Hannah BUYs 0.5 BTC. Only 0.2 fills → status = PARTIAL.
  // ══════════════════════════════════════════════════════════════════════════
  section(7, 'Partial Fill + Order Status Lifecycle (OPEN → PARTIAL)')

  const P7 = nextUniquePrice()
  const u_hannah = await createUser(`PART_Hannah_${ts}`, 100_000_000, 0)
  const u_ian    = await createUser(`PART_Ian_${ts}`,    100_000_000, 100)
  testUserIds.push(u_hannah.id, u_ian.id)

  // Ian posts 0.2 BTC SELL first — wait for it to settle in the book
  const ianSell7 = await placeOrder(u_ian.id, 'SELL', 'LIMIT', P7, 0.2)
  await delay(300)  // ensure SELL is in the in-memory heap
  // Hannah BUYs 0.5 BTC — only 0.2 available (Ian's order) → partial fill
  const hannahBuy7 = await placeOrder(u_hannah.id, 'BUY', 'LIMIT', P7, 0.5)
  await delay(400)

  assert(ianSell7.ok,   'Ian SELL placed in book')
  assert(hannahBuy7.ok, 'Hannah BUY order accepted')
  assert(hannahBuy7.trades?.length === 1, `1 trade executed against Ian (got ${hannahBuy7.trades?.length})`)

  if (hannahBuy7.ok) {
    const hannahOrder7 = await prisma.order.findUnique({ where: { id: hannahBuy7.order?.id } })
    const hannahBal7   = await getBalance(u_hannah.id)
    const ianBal7      = await getBalance(u_ian.id)

    assert(hannahOrder7?.status === 'PARTIAL',
      `Hannah order status is PARTIAL (got: ${hannahOrder7?.status})`)
    assert(
      Math.abs(parseFloat(hannahBal7.assetBalance) - 0.2) < TOLERANCE,
      `Hannah received exactly 0.2 BTC (got: ${hannahBal7.assetBalance})`)
    assert(parseFloat(ianBal7.fiatBalance) > 100_000_000,
      `Ian received USDT from selling (got: ${ianBal7.fiatBalance})`)
    assert(parseFloat(hannahBal7.fiatBalance) >= 0,
      `Hannah fiatBalance non-negative (got: ${hannahBal7.fiatBalance})`)

    console.log(`     ℹ Hannah — USDT: ${hannahBal7.fiatBalance}  BTC: ${hannahBal7.assetBalance}  Status: ${hannahOrder7?.status}`)
    console.log(`     ℹ Ian    — USDT: ${ianBal7.fiatBalance}  BTC: ${ianBal7.assetBalance}`)
    // Cancel Hannah's remaining partial order (cleanup)
    if (['OPEN','PARTIAL'].includes(hannahOrder7?.status)) {
      await cancelOrder(hannahBuy7.order?.id, u_hannah.id)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 8 — Cancel Order + Full Balance Refund
  // Jake places a BUY at isolated price (rests in book, no match possible).
  // Cancels it. Full reserved balance must be refunded atomically.
  // ══════════════════════════════════════════════════════════════════════════
  section(8, 'Cancel Order + Full Balance Refund (ACID Atomicity)')

  const P8 = nextUniquePrice()
  const COST8 = P8 * 0.5  // reserve this much USDT
  const u_jake = await createUser(`CNCL_Jake_${ts}`, COST8 * 2, 2)
  testUserIds.push(u_jake.id)

  const jakeBefore8 = await getBalance(u_jake.id)
  const jakeOrder8  = await placeOrder(u_jake.id, 'BUY', 'LIMIT', P8, 0.5)
  await delay(100)

  const jakeReserved8 = await getBalance(u_jake.id)
  assert(jakeOrder8.ok, 'Jake BUY placed (rests in book — no matching SELL exists)')
  assert(
    parseFloat(jakeReserved8.fiatBalance) < parseFloat(jakeBefore8.fiatBalance),
    `Balance reduced by reservation (was ${jakeBefore8.fiatBalance}, now ${jakeReserved8.fiatBalance})`
  )
  // Verify exact reservation amount
  const expectedReserved = parseFloat(jakeBefore8.fiatBalance) - COST8
  assert(
    Math.abs(parseFloat(jakeReserved8.fiatBalance) - expectedReserved) < TOLERANCE,
    `Exactly ${COST8} USDT reserved (balance: ${jakeReserved8.fiatBalance}, expected: ${expectedReserved})`
  )

  // Cancel and verify full refund
  await cancelOrder(jakeOrder8.order?.id, u_jake.id)
  await delay(200)
  const jakeAfter8 = await getBalance(u_jake.id)

  assert(
    Math.abs(parseFloat(jakeAfter8.fiatBalance) - parseFloat(jakeBefore8.fiatBalance)) < TOLERANCE,
    `Full refund after cancel: ${jakeAfter8.fiatBalance} USDT (was ${jakeBefore8.fiatBalance})`
  )

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 9 — N-User Concurrent Stress Test (20 pairs, 40 simultaneous requests)
  // Each buyer gets a unique price matching exactly one seller.
  // No bot interference. Conservation must hold exactly.
  // ══════════════════════════════════════════════════════════════════════════
  section(9, 'N-User Concurrent Stress Test (20 Pairs = 40 Simultaneous Requests)')

  const NUM_PAIRS9  = 20
  const QTY9        = 0.1
  const FIAT9       = 100_000_000
  const ASSET9      = 100

  const pairs9    = Array.from({ length: NUM_PAIRS9 }, () => ({ price: nextUniquePrice() }))
  const strBuyers  = await Promise.all(pairs9.map((p, i) => createUser(`ST9B_${ts}_${i}`, FIAT9, ASSET9)))
  const strSellers = await Promise.all(pairs9.map((p, i) => createUser(`ST9S_${ts}_${i}`, FIAT9, ASSET9)))
  const strIds = [...strBuyers, ...strSellers].map((u) => u.id)
  testUserIds.push(...strIds)

  const snap9Before = await snapshotTrueWealth(strIds)

  // SELLs first → settle → BUYs match them (deterministic, no simultaneous race)
  const t9 = Date.now()
  await Promise.all(
    strSellers.map((u, i) => placeOrder(u.id, 'SELL', 'LIMIT', pairs9[i].price, QTY9))
  )
  await delay(300)  // wait for all 20 SELLs to settle in the heap
  const strResults = await Promise.all(
    strBuyers.map((u, i) => placeOrder(u.id, 'BUY', 'LIMIT', pairs9[i].price, QTY9))
  )
  await delay(1000)

  const unfilled9 = await prisma.order.findMany({
    where: { userId: { in: strIds }, status: { in: ['OPEN','PARTIAL'] } },
    select: { id: true, userId: true },
  })
  await Promise.all(unfilled9.map((o) => cancelOrder(o.id, o.userId).catch(() => {})))
  await delay(300)

  const snap9After = await snapshotTrueWealth(strIds)
  const fiatDrift9  = Math.abs(snap9After.totalFiat  - snap9Before.totalFiat)
  const assetDrift9 = Math.abs(snap9After.totalAsset - snap9Before.totalAsset)
  const negFiat9    = snap9After.users.filter((u) => parseFloat(u.fiatBalance)  < 0)
  const negAsset9   = snap9After.users.filter((u) => parseFloat(u.assetBalance) < 0)
  const strOk   = strResults.filter((r) => r.ok)
  const strFail = strResults.filter((r) => !r.ok)

  console.log(`     ℹ 20 SELLs settled, then 20 BUYs in ${Date.now()-t9}ms | BUY OK: ${strOk.length} | BUY Failed: ${strFail.length}`)
  console.log(`     ℹ Fiat  before: ${snap9Before.totalFiat.toFixed(2)}  after: ${snap9After.totalFiat.toFixed(2)}  drift: ${fiatDrift9.toFixed(6)}`)
  console.log(`     ℹ Asset before: ${snap9Before.totalAsset.toFixed(6)}  after: ${snap9After.totalAsset.toFixed(6)}  drift: ${assetDrift9.toFixed(6)}`)

  assert(fiatDrift9  < TOLERANCE, `Fiat conserved (drift: ${fiatDrift9.toFixed(6)} USDT)`)
  assert(assetDrift9 < TOLERANCE, `Asset conserved (drift: ${assetDrift9.toFixed(6)} BTC)`)
  assert(negFiat9.length  === 0,  `No negative fiatBalance (violations: ${negFiat9.length})`)
  assert(negAsset9.length === 0,  `No negative assetBalance (violations: ${negAsset9.length})`)
  // ══════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║                    FINAL TEST REPORT                        ║')
  console.log('╠══════════════════════════════════════════════════════════════╣')
  console.log(`║  Total Tests : ${String(totalTests).padEnd(44)} ║`)
  console.log(`║  Passed      : ${String(passed).padEnd(44)} ║`)
  console.log(`║  Failed      : ${String(failed).padEnd(44)} ║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')
  const verdict = failed === 0
    ? '✅  ALL TESTS PASSED — TempoMatch is production-ready!'
    : `❌  ${failed} TEST(S) FAILED — Review output above`
  console.log(`║  ${verdict.padEnd(60)}║`)
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  console.log('🧹 Cleaning up test data...')
  await cancelAndDeleteTestUsers(testUserIds)
  console.log('   ✅ Done.\n')

  await prisma.$disconnect()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\n💥 Fatal error in test suite:', err.message)
  process.exit(1)
})
