import useStore from '../../store/useStore'

export default function OpenOrders() {
  const { openOrders } = useStore()

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border shrink-0">
        <span className="text-text-primary text-sm font-medium border-b-2 border-accent pb-0.5">
          Open Orders({openOrders.length})
        </span>
        <span className="text-text-secondary text-sm cursor-pointer hover:text-text-primary transition-colors pb-0.5">
          Order History
        </span>
        <span className="text-text-secondary text-sm cursor-pointer hover:text-text-primary transition-colors pb-0.5">
          Trade History
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-7 px-3 py-1 text-text-muted text-[10px] shrink-0">
        <span>Date</span>
        <span>Pair</span>
        <span>Side</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Filled</span>
        <span className="text-right">Action</span>
      </div>

      {/* Orders */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {openOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            No open orders
          </div>
        ) : (
          openOrders.map((order, i) => (
            <div
              key={`order-${i}`}
              className="grid grid-cols-7 px-3 py-1.5 text-xs tabular-nums hover:bg-bg-hover transition-colors"
            >
              <span className="text-text-secondary">{order.date}</span>
              <span className="text-text-primary">BTC/USDT</span>
              <span className={order.side === 'BUY' ? 'text-bid' : 'text-ask'}>{order.side}</span>
              <span className="text-right text-text-primary">{order.price.toFixed(2)}</span>
              <span className="text-right text-text-primary">{order.amount.toFixed(5)}</span>
              <span className="text-right text-text-secondary">
                {((1 - order.remaining / order.amount) * 100).toFixed(0)}%
              </span>
              <span className="text-right">
                <button className="text-text-secondary hover:text-ask transition-colors cursor-pointer">
                  Cancel
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
