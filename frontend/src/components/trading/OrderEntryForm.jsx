import { useState } from 'react'
import useStore from '../../store/useStore'

export default function OrderEntryForm() {
  const { currentUser } = useStore()
  const [side, setSide] = useState('BUY')
  const [orderType, setOrderType] = useState('LIMIT')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')

  const isBuy = side === 'BUY'

  const handleSubmit = (e) => {
    e.preventDefault()
    // Will connect to backend API later
    console.log('Order:', { userId: currentUser.id, side, type: orderType, price, qty: quantity })
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
            isBuy
              ? 'bg-bid text-white'
              : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`py-2 rounded text-sm font-semibold transition-colors cursor-pointer ${
            !isBuy
              ? 'bg-ask text-white'
              : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
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
          />
          <span className="text-text-muted text-xs px-3">BTC</span>
        </div>

        {/* Percentage quick-select */}
        <div className="grid grid-cols-4 gap-1 my-1">
          {[25, 50, 75, 100].map(pct => (
            <button
              type="button"
              key={pct}
              className="py-1 text-[10px] text-text-secondary bg-bg-secondary rounded hover:bg-bg-tertiary transition-colors cursor-pointer"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center bg-bg-secondary rounded border border-border">
          <span className="text-text-muted text-xs px-3">Total</span>
          <span className="flex-1 py-2 px-1 text-right text-text-secondary text-sm tabular-nums">
            {price && quantity ? (parseFloat(price) * parseFloat(quantity)).toFixed(2) : '0.00'}
          </span>
          <span className="text-text-muted text-xs px-3">USDT</span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`w-full py-2.5 mt-1 rounded font-semibold text-sm text-white transition-all cursor-pointer ${
            isBuy
              ? 'bg-bid hover:brightness-110'
              : 'bg-ask hover:brightness-110'
          }`}
        >
          {isBuy ? 'Buy' : 'Sell'} BTC
        </button>
      </form>
    </div>
  )
}
