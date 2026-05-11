import useStore from '../../store/useStore'

export default function MarketStats() {
  const { marketStats } = useStore()

  const stats = [
    { label: 'Last Price', value: marketStats.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }), color: 'text-bid' },
    { label: '24h Change', value: `${marketStats.change24h >= 0 ? '+' : ''}${marketStats.change24h.toFixed(2)}%`, color: marketStats.change24h >= 0 ? 'text-bid' : 'text-ask' },
    { label: '24h High', value: marketStats.high24h.toLocaleString(undefined, { minimumFractionDigits: 2 }), color: 'text-text-primary' },
    { label: '24h Low', value: marketStats.low24h.toLocaleString(undefined, { minimumFractionDigits: 2 }), color: 'text-text-primary' },
    { label: '24h Volume', value: `${(marketStats.volume24h / 1000).toFixed(2)}K`, color: 'text-text-primary' },
  ]

  return (
    <div className="flex items-center gap-6 px-4 h-10 bg-bg-primary border-b border-border shrink-0 overflow-x-auto">
      {/* Big price */}
      <span className="text-xl font-semibold text-bid tabular-nums">
        {marketStats.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>

      {/* Stats row */}
      {stats.slice(1).map(stat => (
        <div key={stat.label} className="flex flex-col">
          <span className="text-text-muted text-[10px] leading-tight">{stat.label}</span>
          <span className={`${stat.color} text-xs font-medium tabular-nums`}>{stat.value}</span>
        </div>
      ))}
    </div>
  )
}
