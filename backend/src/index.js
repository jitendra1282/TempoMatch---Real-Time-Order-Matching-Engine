// TempoMatch Backend — Entry Point

import 'dotenv/config'
import { httpServer } from './server.js'
import { repopulateHeaps } from './warmBoot/repopulateHeaps.js'
import { startMarketMaker } from './services/marketMaker.js'
import { applyBalanceConstraints } from './services/orderService.js'

const PORT = process.env.PORT || 3001

async function main() {
  // Apply DB-level CHECK constraints (idempotent — safe to run every startup)
  // This is the LAST LINE OF DEFENSE: PostgreSQL will reject any write that
  // would make fiatBalance or assetBalance go negative, even if app logic has a bug.
  await applyBalanceConstraints()

  // Crash recovery: reload open orders into memory before accepting connections
  await repopulateHeaps()

  // Start market maker bot — seeds liquidity so user orders fill immediately
  await startMarketMaker()

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 TempoMatch Backend running on http://localhost:${PORT}`)
    console.log(`   WebSocket: ws://localhost:${PORT}`)
    console.log(`   Health:    http://localhost:${PORT}/health\n`)
  })
}

main().catch((err) => {
  console.error('[Fatal] Server failed to start:', err)
  process.exit(1)
})

