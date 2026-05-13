// Order routes — POST + DELETE + GET /api/v1/orders

import { Router } from 'express'
import { createOrder, deleteOrder, listOrders, getHistory, getTrades } from '../controllers/orderController.js'
import { validateOrder, validateCancelOrder } from '../middleware/validate.js'

const router = Router()

router.post('/', validateOrder, createOrder)
router.delete('/:id', validateCancelOrder, deleteOrder)
router.get('/', listOrders)
router.get('/history', getHistory)
router.get('/trades', getTrades)

export default router
