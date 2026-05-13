import { useEffect, useState } from 'react'
import useStore from '../../store/useStore'
import { getOpenOrders, cancelOrder } from '../../services/api'

export default function OpenOrders() {
  const currentUser = useStore((s) => s.currentUser)
  const openOrders = useStore((s) => s.openOrders)
  const setOpenOrders = useStore((s) => s.setOpenOrders)
  const removeOpenOrder = useStore((s) => s.removeOpenOrder)
  const [canceling, setCanceling] = useState(null)

  // Fetch open orders from backend on mount / user change
  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'offline') return

    getOpenOrders(currentUser.id)
      .then((res) => setOpenOrders(res.data.orders))
      .catch(() => setOpenOrders([]))
  }, [currentUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async (order) => {
    if (!currentUser?.id) return
    setCanceling(order.id)
    try {
      await cancelOrder(order.id, currentUser.id)
      removeOpenOrder(order.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Cancel failed')
    } finally {
      setCanceling(null)
    }
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const filledPct = (order) => {
    const initial = parseFloat(order.initialQty)
    const remaining = parseFloat(order.remainingQty)
    return initial > 0 ? (((initial - remaining) / initial) * 100).toFixed(0) : '0'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border shrink-0">
        <span className="text-text-primary text-sm font-medium border-b-2 border-accent pb-0.5">
          Open Orders ({openOrders.length})
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
        <span>Time</span>
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
          openOrders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-7 px-3 py-1.5 text-xs tabular-nums hover:bg-bg-secondary transition-colors"
            >
              <span className="text-text-secondary">{formatDate(order.createdAt)}</span>
              <span className="text-text-primary">BTC/USDT</span>
              <span className={order.side === 'BUY' ? 'text-bid' : 'text-ask'}>{order.side}</span>
              <span className="text-right text-text-primary">{parseFloat(order.price).toFixed(2)}</span>
              <span className="text-right text-text-primary">{parseFloat(order.initialQty).toFixed(5)}</span>
              <span className="text-right text-text-secondary">{filledPct(order)}%</span>
              <span className="text-right">
                <button
                  onClick={() => handleCancel(order)}
                  disabled={canceling === order.id}
                  className="text-text-secondary hover:text-ask transition-colors cursor-pointer disabled:opacity-50"
                >
                  {canceling === order.id ? '...' : 'Cancel'}
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
