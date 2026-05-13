import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'
import { getTradeHistory } from '../../services/api'

export default function RecentTrades() {
  const { recentTrades, currentUser } = useStore()
  const [activeTab, setActiveTab] = useState('MARKET') // 'MARKET' | 'MY_TRADES'
  const [myTrades, setMyTrades] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (activeTab === 'MY_TRADES' && currentUser && currentUser.id !== 'offline') {
      setLoading(true)
      getTradeHistory(currentUser.id)
        .then(res => setMyTrades(res.data.trades))
        .catch(() => setMyTrades([]))
        .finally(() => setLoading(false))
    }
  }, [activeTab, currentUser])

  const renderTabHeader = (id, label) => {
    const isActive = activeTab === id
    return (
      <span
        onClick={() => setActiveTab(id)}
        className={`text-sm font-medium cursor-pointer transition-colors pb-0.5 ${
          isActive
            ? 'text-text-primary border-b-2 border-accent'
            : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'
        }`}
      >
        {label}
      </span>
    )
  }

  const currentData = activeTab === 'MARKET' ? recentTrades : myTrades

  const formatDate = (dateInput) => {
    if (!dateInput) return ''
    // Handle both time strings (HH:mm:ss) from mock and ISO strings from DB
    if (typeof dateInput === 'string' && dateInput.length === 8 && dateInput.includes(':')) {
      return dateInput
    }
    const d = new Date(dateInput)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header with tabs */}
      <div className="flex items-center gap-6 px-4 py-2 border-b border-border shrink-0 bg-bg-secondary/30 backdrop-blur-sm">
        {renderTabHeader('MARKET', 'Market Trades')}
        {renderTabHeader('MY_TRADES', 'My Trades')}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-4 py-1.5 text-[10px] uppercase tracking-wider text-text-muted shrink-0 bg-bg-secondary/20">
        <span>Price (USDT)</span>
        <span className="text-right">Amount (BTC)</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trade list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm animate-pulse">
            Loading...
          </div>
        ) : currentData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {activeTab === 'MY_TRADES' ? 'No trades yet' : ''}
          </div>
        ) : (
          currentData.map((trade, i) => {
            const timeStr = activeTab === 'MARKET' ? trade.time : formatDate(trade.executedAt)
            // For MY_TRADES, we don't have makerSide easily in the trade model, so we just use red/green based on generic makerSide if present.
            // If not present, we can just use text-text-primary
            const isBuy = trade.makerSide === 'BUY'
            const priceClass = trade.makerSide ? (isBuy ? 'text-ask' : 'text-bid') : 'text-text-primary'

            return (
              <div
                key={`trade-${i}`}
                className="grid grid-cols-3 px-4 py-1.5 text-xs tabular-nums hover:bg-bg-hover transition-colors border-b border-border/50 last:border-0"
              >
                <span className={`${priceClass} font-medium`}>
                  {Number(trade.price).toFixed(2)}
                </span>
                <span className="text-right text-text-primary">{Number(trade.qty).toFixed(5)}</span>
                <span className="text-right text-text-secondary">{timeStr}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
