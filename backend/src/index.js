// TempoMatch Backend — Entry Point

import 'dotenv/config'
import { httpServer } from './server.js'
import { repopulateHeaps } from './warmBoot/repopulateHeaps.js'

const PORT = process.env.PORT || 3001

async function main() {
  // Crash recovery: reload open orders into memory before accepting connections
  await repopulateHeaps()

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
