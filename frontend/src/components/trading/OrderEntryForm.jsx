import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'
import { placeOrder } from '../../services/api'
import { getOpenOrders } from '../../services/api'

export default function OrderEntryForm() {
  const currentUser = useStore((s) => s.currentUser)
  const balances = useStore((s) => s.balances)
  const setBalances = useStore((s) => s.setBalances)
  const upsertOpenOrder = useStore((s) => s.upsertOpenOrder)

  const [side, setSide] = useState('BUY')
  const [orderType, setOrderType] = useState('LIMIT')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success'|'error', msg }

  const isBuy = side === 'BUY'
  const total = price && quantity ? (parseFloat(price) * parseFloat(quantity)).toFixed(2) : '0.00'

  // Quick percentage buttons
  const handlePct = (pct) => {
    if (side === 'BUY' && price && parseFloat(price) > 0) {
      const maxQty = (balances.fiat * pct / 100) / parseFloat(price)
      setQuantity(maxQty.toFixed(6))
    } else if (side === 'SELL') {
      setQuantity(((balances.asset * pct) / 100).toFixed(6))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) return

    setLoading(true)
    setStatus(null)

    try {
      const payload = {
        userId: currentUser.id,
        side,
        type: orderType,
        qty: parseFloat(quantity),
        ...(orderType === 'LIMIT' ? { price: parseFloat(price) } : { price: 0 }),
      }

      const res = await placeOrder(payload)
      const { order, trades } = res.data

      // Add order to open orders if not fully filled
      if (['OPEN', 'PARTIAL'].includes(order.status)) {
        upsertOpenOrder(order)
      }

      // Optimistically update balances from trade fills
      if (trades.length > 0) {
        const fillCost = trades.reduce((sum, t) => sum + Number(t.price) * Number(t.qty), 0)
        const fillQty = trades.reduce((sum, t) => sum + Number(t.qty), 0)
        if (side === 'BUY') {
          setBalances({ fiat: balances.fiat - fillCost, asset: balances.asset + fillQty })
        } else {
          setBalances({ fiat: balances.fiat + fillCost, asset: balances.asset - fillQty })
        }
      }

      const tradeMsg = trades.length > 0 ? ` ${trades.length} trade(s) filled!` : ''
      setStatus({ type: 'success', msg: `Order ${order.status.toLowerCase()}.${tradeMsg}` })
      setQuantity('')
      if (orderType !== 'LIMIT') setPrice('')
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Order failed'
      setStatus({ type: 'error', msg })
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(null), 4000)
    }
  }

  return (
    <div className="flex flex-col flex-1 p-3">
      {/* Spot label */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <span className="text-text-primary font-medium border-b-2 border-accent pb-1">Spot</span>
      </div>

      {/* Buy / Sell toggle */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        <button
          onClick={() => setSide('BUY')}
          className={`py-2 rounded text-sm font-semibold transition-colors cursor-pointer ${
            isBuy ? 'bg-bid text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`py-2 rounded text-sm font-semibold transition-colors cursor-pointer ${
            !isBuy ? 'bg-ask text-white' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Order type tabs */}
      <div className="flex gap-3 mb-3 text-xs">
        {['LIMIT', 'MARKET'].map(type => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`pb-1 transition-colors cursor-pointer ${
              orderType === type
                ? 'text-text-primary border-b border-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {type.charAt(0) + type.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {/* Price input */}
        {orderType === 'LIMIT' && (
          <div className="flex items-center bg-bg-secondary rounded border border-border focus-within:border-accent transition-colors">
            <span className="text-text-muted text-xs px-3">Price</span>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent py-2 px-1 text-right text-text-primary text-sm outline-none tabular-nums"
              required
            />
            <span className="text-text-muted text-xs px-3">USDT</span>
          </div>
        )}

        {/* Quantity input */}
        <div className="flex items-center bg-bg-secondary rounded border border-border focus-within:border-accent transition-colors">
          <span className="text-text-muted text-xs px-3">Amount</span>
          <input
            type="number"
            step="0.00001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent py-2 px-1 text-right text-text-primary text-sm outline-none tabular-nums"
            required
          />
          <span className="text-text-muted text-xs px-3">BTC</span>
        </div>

        {/* Percentage quick-select */}
        <div className="grid grid-cols-4 gap-1 my-1">
          {[25, 50, 75, 100].map(pct => (
            <button
              type="button"
              key={pct}
              onClick={() => handlePct(pct)}
              className="py-1 text-[10px] text-text-secondary bg-bg-secondary rounded hover:bg-bg-tertiary transition-colors cursor-pointer"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center bg-bg-secondary rounded border border-border">
          <span className="text-text-muted text-xs px-3">Total</span>
          <span className="flex-1 py-2 px-1 text-right text-text-secondary text-sm tabular-nums">{total}</span>
          <span className="text-text-muted text-xs px-3">USDT</span>
        </div>

        {/* Status message */}
        {status && (
          <div className={`text-xs px-3 py-2 rounded ${
            status.type === 'success'
              ? 'bg-bid/20 text-bid border border-bid/30'
              : 'bg-ask/20 text-ask border border-ask/30'
          }`}>
            {status.msg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !currentUser}
          className={`w-full py-2.5 mt-1 rounded font-semibold text-sm text-white transition-all cursor-pointer disabled:opacity-60 ${
            isBuy ? 'bg-bid hover:brightness-110' : 'bg-ask hover:brightness-110'
          }`}
        >
          {loading ? 'Placing...' : `${isBuy ? 'Buy' : 'Sell'} BTC`}
        </button>
      </form>
    </div>
  )
}
