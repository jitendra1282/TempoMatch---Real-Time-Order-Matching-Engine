// Order routes — POST + DELETE + GET /api/v1/orders

import { Router } from 'express'
import { createOrder, deleteOrder, listOrders } from '../controllers/orderController.js'
import { validateOrder, validateCancelOrder } from '../middleware/validate.js'

const router = Router()

router.post('/', validateOrder, createOrder)
router.delete('/:id', validateCancelOrder, deleteOrder)
router.get('/', listOrders)

export default router
