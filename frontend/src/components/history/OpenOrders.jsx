import { useEffect, useState } from 'react'
import useStore from '../../store/useStore'
import { getOpenOrders, getOrderHistory, getTradeHistory, cancelOrder } from '../../services/api'

export default function OpenOrders() {
  const currentUser = useStore((s) => s.currentUser)
  const openOrders = useStore((s) => s.openOrders)
  const setOpenOrders = useStore((s) => s.setOpenOrders)
  const removeOpenOrder = useStore((s) => s.removeOpenOrder)

  const [activeTab, setActiveTab] = useState('OPEN') // 'OPEN' | 'HISTORY' | 'TRADES'
  const [orderHistory, setOrderHistory] = useState([])
  const [tradeHistory, setTradeHistory] = useState([])
  const [canceling, setCanceling] = useState(null)
  const [loading, setLoading] = useState(false)

  // Fetch data based on active tab
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'offline') return
    setLoading(true)

    if (activeTab === 'OPEN') {
      getOpenOrders(currentUser.id)
        .then((res) => setOpenOrders(res.data.orders))
        .catch(() => setOpenOrders([]))
        .finally(() => setLoading(false))
    } else if (activeTab === 'HISTORY') {
      getOrderHistory(currentUser.id)
        .then((res) => setOrderHistory(res.data.orders))
        .catch(() => setOrderHistory([]))
        .finally(() => setLoading(false))
    } else if (activeTab === 'TRADES') {
      getTradeHistory(currentUser.id)
        .then((res) => setTradeHistory(res.data.trades))
        .catch(() => setTradeHistory([]))
        .finally(() => setLoading(false))
    }
  }, [currentUser?.id, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async (order) => {
    if (!currentUser?.id) return
    setCanceling(order.id)
    try {
      await cancelOrder(order.id, currentUser.id)
      removeOpenOrder(order.id)
      if (activeTab === 'HISTORY') {
        setOrderHistory((prev) => prev.map(o => o.id === order.id ? { ...o, status: 'CANCELED' } : o))
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Cancel failed')
    } finally {
      setCanceling(null)
    }
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const filledPct = (order) => {
    const initial = parseFloat(order.initialQty)
    const remaining = parseFloat(order.remainingQty)
    return initial > 0 ? (((initial - remaining) / initial) * 100).toFixed(0) : '0'
  }

  const renderTabHeader = (id, label, count) => {
    const isActive = activeTab === id
    return (
      <span
        onClick={() => setActiveTab(id)}
        className={`text-sm font-medium cursor-pointer transition-colors pb-1 ${
          isActive
            ? 'text-text-primary border-b-2 border-accent'
            : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent'
        }`}
      >
        {label} {count !== undefined && `(${count})`}
      </span>
    )
  }

  const currentData = activeTab === 'OPEN' ? openOrders : activeTab === 'HISTORY' ? orderHistory : tradeHistory

  return (
    <div className="flex flex-col h-full bg-bg-primary rounded-xl overflow-hidden shadow-sm">
      {/* Header with tabs */}
      <div className="flex items-center gap-6 px-4 pt-3 border-b border-border shrink-0 bg-bg-secondary/30 backdrop-blur-sm">
        {renderTabHeader('OPEN', 'Open Orders', openOrders.length)}
        {renderTabHeader('HISTORY', 'Order History')}
        {renderTabHeader('TRADES', 'Trade History')}
      </div>

      {/* Column headers */}
      <div className="grid px-4 py-2 text-text-muted text-[10px] uppercase tracking-wider shrink-0 bg-bg-secondary/20"
      style={{ gridTemplateColumns: activeTab === 'TRADES' ? '2fr 1fr 1fr 1fr 1.5fr' : '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr' }}
      >
        <span>Time</span>
        {activeTab !== 'TRADES' && <span>Pair</span>}
        {activeTab !== 'TRADES' && <span>Side</span>}
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        {activeTab !== 'TRADES' && <span className="text-right">Filled</span>}
        {activeTab === 'TRADES' && <span className="text-right">Role</span>}
        {activeTab === 'TRADES' && <span className="text-right">Counterparty</span>}
        {activeTab !== 'TRADES' && <span className="text-right">Action / Status</span>}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm animate-pulse">Loading...</div>
        ) : currentData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            No data found
          </div>
        ) : (
          currentData.map((item) => (
            <div
              key={item.id}
              className="grid px-4 py-2.5 text-xs tabular-nums hover:bg-bg-hover transition-colors border-b border-border/50 last:border-0"
              style={{ gridTemplateColumns: activeTab === 'TRADES' ? '2fr 1fr 1fr 1fr 1.5fr' : '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr' }}
            >
              <span className="text-text-secondary">{formatDate(item.createdAt || item.executedAt)}</span>
              {activeTab !== 'TRADES' && <span className="text-text-primary">BTC/USDT</span>}
              {activeTab !== 'TRADES' && <span className={item.side === 'BUY' ? 'text-bid font-medium' : 'text-ask font-medium'}>{item.side}</span>}
              <span className="text-right text-text-primary font-medium">{parseFloat(item.price).toFixed(2)}</span>
              <span className="text-right text-text-primary">{parseFloat(item.initialQty || item.qty).toFixed(5)}</span>
              
              {activeTab !== 'TRADES' && <span className="text-right text-text-secondary">{filledPct(item)}%</span>}
              
              {activeTab === 'TRADES' && (() => {
                // "Order Poster" = placed order first, it sat in the book waiting (formerly "Maker")
                // "Order Taker"  = placed an order that matched an existing one immediately (formerly "Taker")
                const isOrderPoster = item.makerOrder?.user?.id === currentUser?.id
                const role = isOrderPoster ? 'Order Poster' : 'Order Taker'
                const roleTitle = isOrderPoster
                  ? 'You posted this order to the book first — it waited until someone matched it'
                  : 'You placed this order and it immediately matched an existing order in the book'
                const counterparty = isOrderPoster
                  ? (item.takerOrder?.user?.username ?? '—')
                  : (item.makerOrder?.user?.username ?? '—')
                return (
                  <>
                    <span className="text-right text-text-muted cursor-help" title={roleTitle}>{role}</span>
                    <span className="text-right font-medium" style={{ color: 'var(--color-accent, #7c6aff)' }}>{counterparty}</span>
                  </>
                )
              })()}

              {activeTab !== 'TRADES' && (
                <span className="text-right">
                  {['OPEN', 'PARTIAL'].includes(item.status) ? (
                    <button
                      onClick={() => handleCancel(item)}
                      disabled={canceling === item.id}
                      className="text-text-secondary hover:text-ask font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {canceling === item.id ? '...' : 'Cancel'}
                    </button>
                  ) : (
                    <span className={`font-medium ${item.status === 'FILLED' ? 'text-bid' : 'text-text-muted'}`}>
                      {item.status}
                    </span>
                  )}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
