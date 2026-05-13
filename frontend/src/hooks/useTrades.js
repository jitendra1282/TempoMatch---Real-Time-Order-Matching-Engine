// trade_executed subscriber hook

import { useEffect } from 'react'
import useSocket from './useSocket'
import useStore from '../store/useStore'

export default function useTrades() {
  const { socket } = useSocket()
  const setRecentTrades = useStore((s) => s.setRecentTrades)
  const setMarketStats = useStore((s) => s.setMarketStats)
  const setCandleData = useStore((s) => s.setCandleData)
  
  const recentTrades = useStore((s) => s.recentTrades)
  const marketStats = useStore((s) => s.marketStats)
  const candleData = useStore((s) => s.candleData)

  useEffect(() => {
    if (!socket) return

    const handler = (trade) => {
      // trade = { price, qty, makerOrderId, takerOrderId, executedAt, makerSide }
      const now = new Date(trade.executedAt || Date.now())
      const pad = (n) => String(n).padStart(2, '0')
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

      const lastPrice = Number(trade.price)
      const tradeQty = Number(trade.qty)

      const newTrade = {
        price: lastPrice,
        qty: tradeQty,
        time: timeStr,
        makerSide: trade.makerSide,
      }

      // Prepend and keep the last 50 trades
      setRecentTrades([newTrade, ...recentTrades].slice(0, 50))

      // Update last price and 24h stats
      setMarketStats({
        ...marketStats,
        lastPrice,
        high24h: Math.max(marketStats.high24h, lastPrice),
        low24h: Math.min(marketStats.low24h, lastPrice),
        volume24h: +(marketStats.volume24h + tradeQty).toFixed(5),
      })

      // Update live candlestick data
      const tradeTimeSec = Math.floor(now.getTime() / 1000)
      const interval = 3600 // 1 hour candles
      const currentPeriod = Math.floor(tradeTimeSec / interval) * interval
      
      const newCandles = [...candleData.candles]
      const lastCandle = newCandles[newCandles.length - 1]
      
      if (lastCandle && lastCandle.time === currentPeriod) {
        lastCandle.close = lastPrice
        lastCandle.high = Math.max(lastCandle.high, lastPrice)
        lastCandle.low = Math.min(lastCandle.low, lastPrice)
        lastCandle.volume = (lastCandle.volume || 0) + tradeQty
      } else {
        newCandles.push({
          time: currentPeriod,
          open: lastCandle ? lastCandle.close : lastPrice,
          high: lastPrice,
          low: lastPrice,
          close: lastPrice,
          volume: tradeQty,
        })
      }
      setCandleData({ candles: newCandles })
    }

    socket.on('trade_executed', handler)
    return () => socket.off('trade_executed', handler)
  }, [socket, recentTrades, marketStats, candleData]) // eslint-disable-line react-hooks/exhaustive-deps
}
