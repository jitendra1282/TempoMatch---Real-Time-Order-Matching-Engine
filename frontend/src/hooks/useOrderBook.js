// orderbook_state subscriber hook

import { useEffect } from 'react'
import useSocket from './useSocket'
import useStore from '../store/useStore'

export default function useOrderBook() {
  const { socket } = useSocket()
  const setOrderBook = useStore((s) => s.setOrderBook)
  const setMarketStats = useStore((s) => s.setMarketStats)
  const marketStats = useStore((s) => s.marketStats)

  useEffect(() => {
    if (!socket) return

    const handler = (data) => {
      // data = { bids: [], asks: [], lastPrice }
      setOrderBook({
        bids: data.bids ?? [],
        asks: data.asks ?? [],
        lastPrice: data.lastPrice ?? marketStats.lastPrice,
      })

      if (data.lastPrice != null) {
        setMarketStats({ ...marketStats, lastPrice: data.lastPrice })
      }
    }

    socket.on('orderbook_state', handler)
    return () => socket.off('orderbook_state', handler)
  }, [socket]) // eslint-disable-line react-hooks/exhaustive-deps
}
