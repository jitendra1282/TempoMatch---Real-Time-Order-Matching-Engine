import useStore from '../../store/useStore'

export default function OrderBook() {
  const { orderBook } = useStore()

  // Calculate max total for the depth bar width
  const maxTotal = Math.max(
    ...orderBook.asks.map(a => a.total),
    ...orderBook.bids.map(b => b.total),
    1
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-text-primary text-sm font-medium">Order Book</span>
        <div className="flex gap-1">
          {/* View toggle icons (decorative) */}
          <button className="p-1 rounded bg-bg-tertiary" title="Both">
            <div className="flex flex-col gap-px">
              <div className="w-3 h-1 bg-ask rounded-sm"></div>
              <div className="w-3 h-1 bg-bid rounded-sm"></div>
            </div>
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-text-muted text-[10px] shrink-0">
        <span>Price (USDT)</span>
        <span className="text-right">Amount (BTC)</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (red) — reversed so lowest ask is at bottom */}
      <div className="flex-1 overflow-y-auto flex flex-col justify-end min-h-0">
        {[...orderBook.asks].reverse().map((ask, i) => (
          <div key={`ask-${i}`} className="relative grid grid-cols-3 px-3 py-[2px] text-xs tabular-nums hover:bg-bg-hover cursor-pointer">
            {/* Depth bar */}
            <div
              className="absolute right-0 top-0 bottom-0 bg-ask-bg"
              style={{ width: `${(ask.total / maxTotal) * 100}%` }}
            />
            <span className="text-ask relative z-10">{ask.price.toFixed(2)}</span>
            <span className="text-right text-text-primary relative z-10">{ask.amount.toFixed(5)}</span>
            <span className="text-right text-text-primary relative z-10">{ask.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Spread / Last Price */}
      <div className="px-3 py-2 border-y border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-bid text-lg font-semibold tabular-nums">
            {orderBook.lastPrice.toFixed(2)}
          </span>
          <span className="text-text-secondary text-xs">
            ≈ ${orderBook.lastPrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Bids (green) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {orderBook.bids.map((bid, i) => (
          <div key={`bid-${i}`} className="relative grid grid-cols-3 px-3 py-[2px] text-xs tabular-nums hover:bg-bg-hover cursor-pointer">
            <div
              className="absolute right-0 top-0 bottom-0 bg-bid-bg"
              style={{ width: `${(bid.total / maxTotal) * 100}%` }}
            />
            <span className="text-bid relative z-10">{bid.price.toFixed(2)}</span>
            <span className="text-right text-text-primary relative z-10">{bid.amount.toFixed(5)}</span>
            <span className="text-right text-text-primary relative z-10">{bid.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Bid/Ask ratio bar */}
      <div className="flex items-center gap-0 h-5 px-3 shrink-0 border-t border-border">
        <div className="h-1 bg-bid rounded-l" style={{ width: '60%' }} />
        <div className="h-1 bg-ask rounded-r" style={{ width: '40%' }} />
      </div>
    </div>
  )
}
