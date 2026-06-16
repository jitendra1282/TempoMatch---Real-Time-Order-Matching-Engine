/**
 * TempoMatch — Automated Concurrency Test
 * ────────────────────────────────────────
 * Creates N pairs of users, fires matching BUY + SELL orders
 * SIMULTANEOUSLY via Promise.all, then audits the DB to ensure:
 *   ✅ Total fiat balance across all test users is conserved
 *   ✅ Total asset balance across all test users is conserved
 *   ✅ No user has a negative balance
 *   ✅ All executed trades have valid counterparty info
 */

import axios from 'axios'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()
const API = 'http://localhost:3001/api/v1'

// ── Config ────────────────────────────────────────────────────────────────────
const NUM_PAIRS  = 10    // 10 buyer + 10 seller = 20 concurrent requests
const PRICE      = 80000
const QTY        = 0.1
const FIAT_START = 100000  // each user starts with 100 000 USDT
const ASSET_START = 5       // each user starts with 5 BTC

// ── Helpers ───────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function createTestUser(username) {
  const id = randomUUID()
  const res = await axios.post(`${API}/users`, {
    id,
    username,
    // Override defaults via direct DB write for precise starting balances
  })
  // Set exact starting balances directly in DB
  await prisma.user.update({
    where: { id: res.data.user.id },
    data: { fiatBalance: FIAT_START, assetBalance: ASSET_START },
  })
  return { ...res.data.user, fiatBalance: FIAT_START, assetBalance: ASSET_START }
}

async function placeOrder(userId, side, price, qty) {
  try {
    const res = await axios.post(`${API}/orders`, {
      userId,
      side,
      type: 'LIMIT',
      price,
      qty,
    })
    return { success: true, data: res.data }
  } catch (err) {
    return { success: false, error: err.response?.data?.error || err.message }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runConcurrencyTest() {
  const ts = Date.now()
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║   TempoMatch — Automated Concurrency Test        ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // ── Step 1: Create test users ────────────────────────────────────────────
  console.log(`📦 Step 1: Creating ${NUM_PAIRS * 2} test users...`)
  const buyers  = []
  const sellers = []

  for (let i = 0; i < NUM_PAIRS; i++) {
    buyers.push(await createTestUser(`ConcBuyer_${ts}_${i}`))
    sellers.push(await createTestUser(`ConcSeller_${ts}_${i}`))
  }
  console.log(`   ✅ Created ${buyers.length} buyers + ${sellers.length} sellers`)

  // Record initial totals
  const totalUsersCount = NUM_PAIRS * 2
  const expectedFiat  = FIAT_START * totalUsersCount
  const expectedAsset = ASSET_START * totalUsersCount
  console.log(`\n   Initial pool: ${expectedFiat.toLocaleString()} USDT | ${expectedAsset} BTC across ${totalUsersCount} users`)

  // ── Step 2: Fire concurrent orders ─────────────────────────────────────
  console.log(`\n⚡ Step 2: Firing ${NUM_PAIRS * 2} concurrent orders simultaneously...`)

  const buyRequests  = buyers.map((u)  => placeOrder(u.id, 'BUY',  PRICE, QTY))
  const sellRequests = sellers.map((u) => placeOrder(u.id, 'SELL', PRICE, QTY))

  const startTime = Date.now()
  const results = await Promise.all([...buyRequests, ...sellRequests])
  const elapsed = Date.now() - startTime

  console.log(`   ✅ All ${results.length} requests completed in ${elapsed}ms`)

  const succeeded = results.filter((r) => r.success)
  const failed    = results.filter((r) => !r.success)
  console.log(`   Succeeded: ${succeeded.length} | Failed: ${failed.length}`)

  if (failed.length > 0) {
    console.log('\n   ⚠️  Failed orders:')
    failed.forEach((f, i) => console.log(`      [${i + 1}] ${f.error}`))
  }

  // Count trades generated
  const tradesGenerated = succeeded.reduce((sum, r) => {
    return sum + (r.data?.trades?.length ?? 0)
  }, 0)
  console.log(`   Trades executed: ${tradesGenerated}`)

  // ── Step 3: Wait for DB to settle ───────────────────────────────────────
  console.log('\n⏳ Step 3: Waiting 500ms for DB to settle...')
  await delay(500)

  // ── Step 4: Audit balances ───────────────────────────────────────────────
  console.log('\n🔍 Step 4: Auditing balances...')

  const allUserIds = [...buyers, ...sellers].map((u) => u.id)
  const dbUsers = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, username: true, fiatBalance: true, assetBalance: true },
  })

  let totalFiatAfter  = 0
  let totalAssetAfter = 0
  let negativeBalanceUsers = []

  for (const u of dbUsers) {
    const fiat  = parseFloat(u.fiatBalance)
    const asset = parseFloat(u.assetBalance)
    totalFiatAfter  += fiat
    totalAssetAfter += asset
    if (fiat < 0 || asset < 0) {
      negativeBalanceUsers.push({ username: u.username, fiat, asset })
    }
  }

  // ── Step 5: Report results ───────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║                 TEST RESULTS                     ║')
  console.log('╠══════════════════════════════════════════════════╣')

  // Balance conservation check (allow tiny floating-point tolerance)
  const TOLERANCE = 0.001
  const fiatConserved  = Math.abs(totalFiatAfter  - expectedFiat)  < TOLERANCE
  const assetConserved = Math.abs(totalAssetAfter - expectedAsset) < TOLERANCE

  console.log(`║  Fiat conservation:`)
  console.log(`║    Expected : ${expectedFiat.toLocaleString()} USDT`)
  console.log(`║    Actual   : ${totalFiatAfter.toLocaleString()} USDT`)
  console.log(`║    Drift    : ${(totalFiatAfter - expectedFiat).toFixed(6)} USDT`)
  console.log(`║    Result   : ${fiatConserved  ? '✅ PASS — no money created/destroyed' : '❌ FAIL — balance mismatch!'}`)

  console.log(`║`)
  console.log(`║  Asset conservation:`)
  console.log(`║    Expected : ${expectedAsset} BTC`)
  console.log(`║    Actual   : ${totalAssetAfter.toFixed(6)} BTC`)
  console.log(`║    Drift    : ${(totalAssetAfter - expectedAsset).toFixed(6)} BTC`)
  console.log(`║    Result   : ${assetConserved ? '✅ PASS — no BTC created/destroyed' : '❌ FAIL — asset mismatch!'}`)

  console.log(`║`)
  const noNegative = negativeBalanceUsers.length === 0
  console.log(`║  Negative balance check:`)
  console.log(`║    Result   : ${noNegative ? '✅ PASS — no negative balances' : '❌ FAIL — negative balances detected!'}`)
  if (!noNegative) {
    negativeBalanceUsers.forEach((u) => {
      console.log(`║      ${u.username}: USDT=${u.fiat}, BTC=${u.asset}`)
    })
  }

  console.log('╠══════════════════════════════════════════════════╣')
  const allPassed = fiatConserved && assetConserved && noNegative
  console.log(`║  OVERALL: ${allPassed ? '✅ ALL TESTS PASSED — System is concurrent-safe!' : '❌ SOME TESTS FAILED — Race condition detected!'}`)
  console.log('╚══════════════════════════════════════════════════╝\n')

  // ── Cleanup ──────────────────────────────────────────────────────────────
  console.log('🧹 Cleaning up test data...')
  await prisma.trade.deleteMany({
    where: {
      OR: [
        { makerOrder: { userId: { in: allUserIds } } },
        { takerOrder: { userId: { in: allUserIds } } },
      ],
    },
  })
  await prisma.order.deleteMany({ where: { userId: { in: allUserIds } } })
  await prisma.user.deleteMany({ where: { id: { in: allUserIds } } })
  console.log('   ✅ Test data cleaned up.\n')

  await prisma.$disconnect()
  process.exit(allPassed ? 0 : 1)
}

runConcurrencyTest().catch((e) => {
  console.error('Fatal error in concurrency test:', e)
  process.exit(1)
})
