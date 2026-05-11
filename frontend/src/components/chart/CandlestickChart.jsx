import { useEffect, useRef } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import useStore from '../../store/useStore'

export default function CandlestickChart() {
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const { candleData } = useStore()

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#848e9c',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1e2329' },
        horzLines: { color: '#1e2329' },
      },
      crosshair: {
        vertLine: { color: '#5e6673', width: 1, style: 3 },
        horzLine: { color: '#5e6673', width: 1, style: 3 },
      },
      timeScale: {
        borderColor: '#2b3139',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2b3139',
      },
      handleScroll: { vertTouchDrag: false },
    })

    // lightweight-charts v5 API: chart.addSeries(SeriesType, options)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81',
      downColor: '#f6465d',
      borderUpColor: '#0ecb81',
      borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81',
      wickDownColor: '#f6465d',
    })

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    candleSeries.setData(candleData.candles)

    const volumeData = candleData.candles.map(c => ({
      time: c.time,
      value: c.volume || Math.random() * 100,
      color: c.close >= c.open ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)',
    }))
    volumeSeries.setData(volumeData)

    chart.timeScale().fitContent()
    chartRef.current = { chart, candleSeries, volumeSeries }

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      chart.applyOptions({ width, height })
    })
    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [])

  // Update candle data reactively
  useEffect(() => {
    if (chartRef.current && candleData.candles.length > 0) {
      chartRef.current.candleSeries.setData(candleData.candles)
    }
  }, [candleData])

  return (
    <div className="flex flex-col h-full">
      {/* Chart toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-text-primary text-sm font-medium">Chart</span>
        <div className="flex gap-1 ml-2">
          {['1m', '5m', '15m', '1H', '4H', '1D', '1W'].map(tf => (
            <button
              key={tf}
              className="px-2 py-0.5 text-[11px] rounded text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
    </div>
  )
}
