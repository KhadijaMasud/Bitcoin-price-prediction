import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Brush,
  BarChart, Bar, Legend,
} from 'recharts'
import './PriceChart.css'

const RANGES = [
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'All', days: Infinity },
]

function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const change = d.close - d.open
  const pct = (change / d.open * 100).toFixed(2)
  const up = change >= 0

  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{label}</div>
      <div className="tooltip-row"><span>Open</span>  <span>${d.open?.toLocaleString()}</span></div>
      <div className="tooltip-row"><span>High</span>  <span style={{color:'var(--accent-green)'}}>${d.high?.toLocaleString()}</span></div>
      <div className="tooltip-row"><span>Low</span>   <span style={{color:'var(--accent-red)'}}>${d.low?.toLocaleString()}</span></div>
      <div className="tooltip-row"><span>Close</span> <span>${d.close?.toLocaleString()}</span></div>
      <div className="tooltip-row">
        <span>Change</span>
        <span style={{color: up ? 'var(--accent-green)' : 'var(--accent-red)'}}>
          {up ? '+' : ''}{pct}%
        </span>
      </div>
      <div className="tooltip-row"><span>Volume</span><span>{(d.volume/1000).toFixed(0)}K</span></div>
    </div>
  )
}

function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{label}</div>
      <div className="tooltip-row"><span>Volume</span><span>{(payload[0]?.value/1000).toFixed(0)}K BTC</span></div>
    </div>
  )
}

function fmt(val) {
  if (val >= 1e6) return `$${(val/1e6).toFixed(1)}M`
  if (val >= 1e3) return `$${(val/1e3).toFixed(0)}K`
  return `$${val}`
}

export default function PriceChart({ data, loading }) {
  const [range, setRange] = useState('1Y')
  const [showVolume, setShowVolume] = useState(true)

  const filtered = useMemo(() => {
    if (!data) return []
    const r = RANGES.find(r => r.label === range)
    if (!r || r.days === Infinity) return data
    return data.slice(-r.days)
  }, [data, range])

  if (loading) return <div className="card loader"><div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/></div>
  if (!data?.length) return <div className="card empty-state">No price data — start the Flask API.</div>

  const minClose = Math.min(...filtered.map(d => d.low))  * 0.97
  const maxClose = Math.max(...filtered.map(d => d.high)) * 1.01

  // Color areas based on trend direction
  const coloredData = filtered.map((d, i) => ({
    ...d,
    fill: d.close >= d.open ? 'var(--accent-green)' : 'var(--accent-red)',
  }))

  return (
    <div className="card price-card">
      <div className="chart-controls">
        <div className="range-buttons">
          {RANGES.map(r => (
            <button
              key={r.label}
              className={`range-btn ${range === r.label ? 'active' : ''}`}
              onClick={() => setRange(r.label)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="toggle-label">
          <input type="checkbox" checked={showVolume} onChange={e => setShowVolume(e.target.checked)} />
          <span>Volume</span>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={coloredData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v.slice(0,7)}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minClose, maxClose]}
            tickFormatter={fmt}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip content={<PriceTooltip />} />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#priceGrad)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}
          />
          <Brush
            dataKey="date"
            height={24}
            stroke="var(--border)"
            fill="var(--bg-base)"
            travellerWidth={6}
            tickFormatter={v => v?.slice(0,7)}
          />
        </AreaChart>
      </ResponsiveContainer>

      {showVolume && (
        <div style={{ marginTop: 12 }}>
          <p className="chart-sublabel">Daily Volume (BTC)</p>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={coloredData} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis
                tickFormatter={v => `${(v/1000).toFixed(0)}K`}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={46}
              />
              <Tooltip content={<VolumeTooltip />} />
              <Bar dataKey="volume" fill="rgba(59,130,246,0.35)" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
