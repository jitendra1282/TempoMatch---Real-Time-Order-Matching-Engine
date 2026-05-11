import useStore from '../../store/useStore'

export default function RecentTrades() {
  const { recentTrades } = useStore()

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border shrink-0">
        <span className="text-text-primary text-sm font-medium border-b-2 border-accent pb-0.5">
          Market Trades
        </span>
        <span className="text-text-secondary text-sm cursor-pointer hover:text-text-primary transition-colors pb-0.5">
          My Trades
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-text-muted text-[10px] shrink-0">
        <span>Price (USDT)</span>
        <span className="text-right">Amount (BTC)</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trade list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {recentTrades.map((trade, i) => (
          <div
            key={`trade-${i}`}
            className="grid grid-cols-3 px-3 py-[2px] text-xs tabular-nums hover:bg-bg-hover transition-colors"
          >
            <span className={trade.makerSide === 'BUY' ? 'text-ask' : 'text-bid'}>
              {trade.price.toFixed(2)}
            </span>
            <span className="text-right text-text-primary">{trade.qty.toFixed(5)}</span>
            <span className="text-right text-text-secondary">{trade.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
