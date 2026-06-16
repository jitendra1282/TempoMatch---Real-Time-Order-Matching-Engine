// Admin routes — for testing and debugging only
// These endpoints should be disabled in production

import { Router } from 'express'
import { stopMarketMaker, startMarketMaker, cancelAllBotOrdersForAdmin } from '../services/marketMaker.js'

const router = Router()

/**
 * POST /api/v1/admin/bot/stop
 * Stop the market maker bot and cancel all its resting orders.
 */
router.post('/bot/stop', async (req, res) => {
  stopMarketMaker()
  await cancelAllBotOrdersForAdmin()
  res.json({ status: 'stopped' })
})

/**
 * POST /api/v1/admin/bot/start
 * Restart the market maker bot.
 */
router.post('/bot/start', async (req, res) => {
  await startMarketMaker()
  res.json({ status: 'started' })
})

export default router
