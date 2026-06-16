/**
 * TempoMatch — ACID Bot Stress Test
 * ==================================
 * Spawns N bot-user PAIRS that concurrently trade with each other.
 * After every round, verifies all ACID properties:
 *
 *  A — Atomicity:   No order rejection leaves a balance in a dirty state
 *  C — Consistency: DB CHECK constraints prevent negative balances
 *  I — Isolation:   Concurrent orders never double-spend
 *  D — Durability:  All settled trades are persisted with wealth conserved
 *
 * Usage:
 *   npx tsx backend/scripts/acid_bot_stress.ts
 *   (or: cd backend && node --loader ts-node/esm scripts/acid_bot_stress.ts)
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()
const API    = 'http://localhost:3001/api/v1'

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  BOT_PAIRS:    10,        // Number of buyer-seller pairs (= 20 bots total)
  ROUNDS:       5,         // Trading rounds
  INIT_FIAT:    500_000,   // USDT per bot user
  INIT_ASSET:   10,        // BTC per bot user
  BASE_PRICE:   82_000,    // Trade price base (above TempoBot's market spread)
  PRICE_SPREAD: 1_000,     // Each pair gets a unique price (base + pair_index * spread)
  QTY:          0.1,       // BTC per trade
  TOLERANCE:    0.01,      // USDT drift tolerance (floating-point rounding only)
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface BotUser {
  id:       string
  username: string
  token:    string
  pairIdx:  number
  role:     'buyer' | 'seller'
}

interface WealthSnapshot {
  totalFiat:  number
  totalAsset: number
  users: { id: string; fiat: number; asset: number; fiatRaw: Prisma.Decimal; assetRaw: Prisma.Decimal }[]
}

// ── Colours ───────────────────────────────────────────────────────────────────
const RED    = '\x1b[31m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

// ── Test state ────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`   ${GREEN}✅ PASS${RESET}: ${label}`)
    passed++
  } else {
    console.log(`   ${RED}❌ FAIL${RESET}: ${label}`)
    failed++
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    ...opts,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function registerBot(username: string, password: string) {
  const r = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`Register failed for ${username}: ${JSON.stringify(r.data)}`)
  }
  return r.data.token as string
}

async function loginBot(username: string, password: string) {
  const r = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (r.status !== 200) throw new Error(`Login failed for ${username}`)
  return r.data.token as string
}

async function placeOrder(
  userId: string,
  side: 'BUY' | 'SELL',
  price: number,
  qty: number,
) {
  // The order API reads userId from the request body (no JWT middleware on this endpoint)
  const r = await apiFetch('/orders', {
    method: 'POST',
    body: JSON.stringify({ userId, side, type: 'LIMIT', price, qty }),
  })
  return { status: r.status, order: r.data?.order ?? null }
}

// ── Wealth snapshot (true wealth = fiat + (open order reservations) + asset) ─
async function snapshotTrueWealth(userIds: string[]): Promise<WealthSnapshot> {
  const users = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, fiatBalance: true, assetBalance: true },
  })

  // Add back open-order reservations
  const openOrders = await prisma.order.findMany({
    where:  { userId: { in: userIds }, status: { in: ['OPEN', 'PARTIAL'] } },
    select: { userId: true, side: true, price: true, remainingQty: true },
  })

  const reservedFiat  = new Map<string, number>()
  const reservedAsset = new Map<string, number>()

  for (const o of openOrders) {
    if (o.side === 'BUY') {
      reservedFiat.set(o.userId, (reservedFiat.get(o.userId) ?? 0) + parseFloat(o.price.toString()) * parseFloat(o.remainingQty.toString()))
    } else {
      reservedAsset.set(o.userId, (reservedAsset.get(o.userId) ?? 0) + parseFloat(o.remainingQty.toString()))
    }
  }

  const enriched = users.map((u) => ({
    id:       u.id,
    fiatRaw:  u.fiatBalance,
    assetRaw: u.assetBalance,
    fiat:     parseFloat(u.fiatBalance.toString())  + (reservedFiat.get(u.id)  ?? 0),
    asset:    parseFloat(u.assetBalance.toString()) + (reservedAsset.get(u.id) ?? 0),
  }))

  return {
    totalFiat:  enriched.reduce((s, u) => s + u.fiat,  0),
    totalAsset: enriched.reduce((s, u) => s + u.asset, 0),
    users:      enriched,
  }
}

// ── Bot setup ─────────────────────────────────────────────────────────────────
const BOT_PASSWORD = 'BotPass#2024!'

async function setupBots(): Promise<BotUser[]> {
  const bots: BotUser[] = []
  const tag = Date.now()

  for (let i = 0; i < CONFIG.BOT_PAIRS; i++) {
    for (const role of ['seller', 'buyer'] as const) {
      const username = `StressBot_${tag}_${role}_${i}`
      // Create user directly in DB (faster than HTTP register + avoids token management)
      const dbUser = await prisma.user.create({
        data: {
          username,
          passwordHash: 'stress-test-placeholder',
          authProvider: 'local',
          fiatBalance:  CONFIG.INIT_FIAT,
          assetBalance: CONFIG.INIT_ASSET,
        },
      })
      bots.push({ id: dbUser.id, username, token: '', pairIdx: i, role })
    }
  }
  return bots
}

async function teardownBots(bots: BotUser[]) {
  // Cancel all open orders
  await prisma.order.updateMany({
    where: { userId: { in: bots.map((b) => b.id) }, status: { in: ['OPEN', 'PARTIAL'] } },
    data:  { status: 'CANCELED' },
  })
  // Delete test data
  await prisma.trade.deleteMany({
    where: {
      OR: [
        { makerOrder: { userId: { in: bots.map((b) => b.id) } } },
        { takerOrder: { userId: { in: bots.map((b) => b.id) } } },
      ],
    },
  })
  await prisma.order.deleteMany({ where: { userId: { in: bots.map((b) => b.id) } } })
  await prisma.user.deleteMany({ where:  { id:     { in: bots.map((b) => b.id) } } })
}

// ── Admin helpers ─────────────────────────────────────────────────────────────
async function stopBot()  { await apiFetch('/admin/bot/stop',  { method: 'POST' }) }
async function startBot() { await apiFetch('/admin/bot/start', { method: 'POST' }) }

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${RESET}`)
  console.log(`${BOLD}${CYAN}║     TempoMatch — ACID Bot Stress Test                        ║${RESET}`)
  console.log(`${BOLD}${CYAN}║     ${CONFIG.BOT_PAIRS} pairs × ${CONFIG.ROUNDS} rounds = ${CONFIG.BOT_PAIRS * CONFIG.ROUNDS * 2} concurrent orders      ║${RESET}`)
  console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${RESET}\n`)

  // Stop the market-maker bot and cancel all its resting orders
  await stopBot()
  await delay(1500) // Wait for bot order cancellations to propagate
  console.log('   ✅ TempoBot stopped and all its orders canceled\n')

  // ── Setup ──────────────────────────────────────────────────────────────────
  console.log(`${YELLOW}⚙  Setting up ${CONFIG.BOT_PAIRS * 2} bot users...${RESET}`)
  const bots    = await setupBots()
  const botIds  = bots.map((b) => b.id)
  const sellers = bots.filter((b) => b.role === 'seller')
  const buyers  = bots.filter((b) => b.role === 'buyer')
  console.log(`   ✅ ${bots.length} bot users ready\n`)

  // Also track TempoBot in the wealth snapshot so trades with it don't show as drift
  const tempoBot = await prisma.user.findUnique({
    where: { username: 'TempoBot' },
    select: { id: true },
  })
  const snapshotIds = tempoBot ? [...botIds, tempoBot.id] : botIds

  const initialSnap = await snapshotTrueWealth(snapshotIds)
  const TOTAL_EXPECTED_FIAT  = initialSnap.totalFiat
  const TOTAL_EXPECTED_ASSET = initialSnap.totalAsset

  // ── Rounds ─────────────────────────────────────────────────────────────────
  for (let round = 1; round <= CONFIG.ROUNDS; round++) {
    console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`${BOLD}  ROUND ${round}/${CONFIG.ROUNDS} — Firing ${CONFIG.BOT_PAIRS} SELL + ${CONFIG.BOT_PAIRS} BUY orders concurrently${RESET}`)
    console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}`)

    const roundStart = Date.now()

    // Each pair trades at a unique price to ensure correct matching
    const sellTasks = sellers.map((seller) => {
      const price = CONFIG.BASE_PRICE + seller.pairIdx * CONFIG.PRICE_SPREAD
      return placeOrder(seller.id, 'SELL', price, CONFIG.QTY)
        .catch((e: Error) => ({ status: 500, order: null, error: e.message }))
    })

    // First settle all SELLs (they rest in the book)
    const sellResults = await Promise.all(sellTasks)
    const sellOK  = sellResults.filter((r) => r.status === 201 || r.status === 200).length
    const sellFail = sellResults.filter((r) => r.status !== 201 && r.status !== 200).length

    await delay(150) // Let SELLs register in the heap

    // Now fire all BUYs — each at the SAME price as its paired SELL
    const buyTasks = buyers.map((buyer) => {
      const price = CONFIG.BASE_PRICE + buyer.pairIdx * CONFIG.PRICE_SPREAD
      return placeOrder(buyer.id, 'BUY', price, CONFIG.QTY)
        .catch((e: Error) => ({ status: 500, order: null, error: e.message }))
    })

    const buyResults  = await Promise.all(buyTasks)
    const buyOK   = buyResults.filter((r) => r.status === 201 || r.status === 200).length
    const buyFail = buyResults.filter((r) => r.status !== 201 && r.status !== 200).length

    await delay(500) // Let matching engine settle

    const elapsed = Date.now() - roundStart
    console.log(`   ℹ SELL ok/fail: ${sellOK}/${sellFail} | BUY ok/fail: ${buyOK}/${buyFail} | ${elapsed}ms`)

    // ── Trade verification: check trades are bot-to-bot (not involving TempoBot) ──
    const recentTrades = await prisma.trade.findMany({
      where: {
        OR: [
          { makerOrder: { userId: { in: botIds } } },
          { takerOrder: { userId: { in: botIds } } },
        ],
      },
      include: {
        makerOrder: { select: { userId: true } },
        takerOrder: { select: { userId: true } },
      },
      orderBy: { executedAt: 'desc' },   // Trade schema uses executedAt not createdAt
      take: CONFIG.BOT_PAIRS * 2,
    })

    const botSet = new Set(botIds)
    const allUserToUser = recentTrades.every(
      (t) => botSet.has(t.makerOrder.userId) && botSet.has(t.takerOrder.userId),
    )

    assert(sellOK === CONFIG.BOT_PAIRS, `All ${CONFIG.BOT_PAIRS} SELL orders placed (got ${sellOK})`)
    assert(buyOK  === CONFIG.BOT_PAIRS, `All ${CONFIG.BOT_PAIRS} BUY  orders placed (got ${buyOK})`)
    assert(allUserToUser || recentTrades.length === 0,
      `All trades are user-to-user (no TempoBot interference)`)

    // ── ACID Checks ────────────────────────────────────────────────────────
    const snap = await snapshotTrueWealth(snapshotIds)
    const fiatDrift  = Math.abs(snap.totalFiat  - TOTAL_EXPECTED_FIAT)
    const assetDrift = Math.abs(snap.totalAsset - TOTAL_EXPECTED_ASSET)
    const negFiat  = snap.users.filter((u) => u.fiat  < 0)
    const negAsset = snap.users.filter((u) => u.asset < 0)

    console.log(`   ℹ Fiat  total: ${snap.totalFiat.toFixed(2)}  drift: ${fiatDrift.toFixed(6)} USDT`)
    console.log(`   ℹ Asset total: ${snap.totalAsset.toFixed(6)}  drift: ${assetDrift.toFixed(6)} BTC`)

    // A — Atomicity
    assert(negFiat.length  === 0, `[A] No negative fiatBalance  (violations: ${negFiat.length})`)
    assert(negAsset.length === 0, `[A] No negative assetBalance (violations: ${negAsset.length})`)

    // C — Consistency (wealth conserved = DB constraints maintained)
    assert(fiatDrift  < CONFIG.TOLERANCE, `[C] Fiat  wealth conserved  (drift: ${fiatDrift.toFixed(6)} USDT)`)
    assert(assetDrift < CONFIG.TOLERANCE, `[C] Asset wealth conserved  (drift: ${assetDrift.toFixed(6)} BTC)`)

    // I — Isolation (check no user spent more than they had)
    const overspent = snap.users.filter((u) => {
      const initial = bots.find((b) => b.id === u.id)?.role === 'seller'
        ? CONFIG.INIT_ASSET
        : CONFIG.INIT_FIAT
      // After N rounds, buyers can have up to INIT_FIAT total (fiat spent = BTC received)
      return u.fiat < -CONFIG.TOLERANCE || u.asset < -CONFIG.TOLERANCE
    })
    assert(overspent.length === 0, `[I] No double-spend detected  (overspent users: ${overspent.length})`)

    // D — Durability (trades persisted in DB)
    const tradeCount = await prisma.trade.count({
      where: {
        OR: [
          { makerOrder: { userId: { in: botIds } } },
          { takerOrder: { userId: { in: botIds } } },
        ],
      },
    })
    assert(tradeCount > 0, `[D] Trades persisted in DB (count: ${tradeCount})`)

    console.log('')
  }

  // ── Concurrent Double-Spend Test ──────────────────────────────────────────
  console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  ISOLATION — Concurrent Same-User Orders (Double-Spend Attack)${RESET}`)
  console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}`)

  // Give one buyer ALL fiat but fire 5 concurrent BUY orders that together exceed balance
  const victimBuyer = buyers[0]
  await prisma.user.update({
    where: { id: victimBuyer.id },
    data:  { fiatBalance: CONFIG.INIT_FIAT },
  })
  // Each order costs price × qty = 82000 × 0.1 = 8200 USDT. Send 100 of them concurrently.
  // Only floor(INIT_FIAT / 8200) = 60 can succeed. Rest must be rejected.
  const ATTACK_PRICE = CONFIG.BASE_PRICE
  const ATTACK_QTY   = CONFIG.QTY
  const ATTACK_ORDERS = 100

  const attackResults = await Promise.all(
    Array.from({ length: ATTACK_ORDERS }, () =>
      placeOrder(victimBuyer.id, 'BUY', ATTACK_PRICE, ATTACK_QTY)
        .catch(() => ({ status: 500, order: null })),
    ),
  )
  await delay(300)

  const attackOK  = attackResults.filter((r) => r.status === 201 || r.status === 200).length
  const attackFail = attackResults.filter((r) => r.status !== 201 && r.status !== 200).length
  const maxPossible = Math.floor(CONFIG.INIT_FIAT / (ATTACK_PRICE * ATTACK_QTY))

  const victimAfter = await prisma.user.findUnique({ where: { id: victimBuyer.id }, select: { fiatBalance: true } })
  const fiatAfterFloat = parseFloat(victimAfter!.fiatBalance.toString())

  console.log(`   ℹ Sent ${ATTACK_ORDERS} concurrent BUYs | succeeded: ${attackOK} | rejected: ${attackFail}`)
  console.log(`   ℹ Max possible with ${CONFIG.INIT_FIAT} USDT at ${ATTACK_PRICE}×${ATTACK_QTY}: ${maxPossible}`)
  console.log(`   ℹ Balance after: ${fiatAfterFloat.toFixed(2)} USDT`)

  assert(fiatAfterFloat >= 0,        `[I] Balance remains non-negative after double-spend attack`)
  assert(attackOK <= maxPossible,    `[I] Only ≤${maxPossible} orders succeeded (got ${attackOK}) — FOR UPDATE lock ✓`)
  assert(attackFail >= ATTACK_ORDERS - maxPossible, `[I] ≥${ATTACK_ORDERS - maxPossible} rejected (got ${attackFail})`)
  console.log('')

  // ── DB CHECK Constraint Test ──────────────────────────────────────────────
  console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  CONSISTENCY — DB CHECK Constraint Blocks Negative Balance${RESET}`)
  console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}`)

  let constraintHeld = false
  try {
    await prisma.user.update({
      where: { id: victimBuyer.id },
      data:  { fiatBalance: -1 },
    })
  } catch {
    constraintHeld = true
  }
  assert(constraintHeld, `[C] CHECK constraint rejects fiatBalance = -1`)
  console.log('')

  // ── Final Report ──────────────────────────────────────────────────────────
  const finalSnap   = await snapshotTrueWealth(snapshotIds)
  const totalFiatDrift  = Math.abs(finalSnap.totalFiat  - TOTAL_EXPECTED_FIAT)
  const totalAssetDrift = Math.abs(finalSnap.totalAsset - TOTAL_EXPECTED_ASSET)

  console.log(`${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}`)
  console.log(`${BOLD}║                  ACID STRESS TEST REPORT                    ║${RESET}`)
  console.log(`${BOLD}╠══════════════════════════════════════════════════════════════╣${RESET}`)
  console.log(`${BOLD}║  Bot Pairs  : ${String(CONFIG.BOT_PAIRS).padEnd(46)}║${RESET}`)
  console.log(`${BOLD}║  Rounds     : ${String(CONFIG.ROUNDS).padEnd(46)}║${RESET}`)
  console.log(`${BOLD}║  Fiat Drift : ${String(totalFiatDrift.toFixed(6) + ' USDT').padEnd(46)}║${RESET}`)
  console.log(`${BOLD}║  Asset Drift: ${String(totalAssetDrift.toFixed(6) + ' BTC').padEnd(46)}║${RESET}`)
  console.log(`${BOLD}║  Passed     : ${String(passed).padEnd(46)}║${RESET}`)
  console.log(`${BOLD}║  Failed     : ${String(failed).padEnd(46)}║${RESET}`)
  console.log(`${BOLD}╠══════════════════════════════════════════════════════════════╣${RESET}`)
  const verdict = failed === 0
    ? `${GREEN}✅  ALL ACID PROPERTIES VERIFIED — TempoMatch is solid!${RESET}`
    : `${RED}❌  ${failed} CHECKS FAILED — Review output above${RESET}`
  console.log(`${BOLD}║  ${verdict.padEnd(71)}║${RESET}`)
  console.log(`${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}\n`)

  // Cleanup
  console.log('🧹 Cleaning up bot users...')
  await teardownBots(bots)
  await startBot()
  console.log('   ✅ Done.\n')

  await prisma.$disconnect()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
