import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import './PredictionsChart.css'

const MODELS = [
  { key: 'linear_pred',  label: 'Linear',           color: '#f59e0b' },
  { key: 'ridge_pred',   label: 'Ridge',             color: '#8b5cf6' },
  { key: 'lasso_pred',   label: 'Lasso',             color: '#06b6d4' },
  { key: 'rf_reg_pred',  label: 'Random Forest',     color: '#ec4899' },
  { key: 'gb_reg_pred',  label: 'Gradient Boosting', color: '#10b981' },
]

function PredTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="tooltip-row">
          <span style={{ color: p.stroke }}>{p.name}</span>
          <span>{(p.value * 100)?.toFixed(3)}%</span>
        </div>
      ))}
    </div>
  )
}

export default function PredictionsChart({ data, loading }) {
  const [activeModels, setActiveModels] = useState(
    new Set(['actual', 'lasso_pred', 'gb_reg_pred'])
  )
  const [zoom, setZoom] = useState(200)

  const visible = useMemo(() => {
    if (!data) return []
    return data.slice(-zoom)
  }, [data, zoom])

  const toggleModel = (key) => {
    setActiveModels(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) return <div className="card loader"><div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/></div>
  if (!data?.length) return <div className="card empty-state">No prediction data — run the model pipeline first.</div>

  const availableModels = MODELS.filter(m => data[0] && m.key in data[0])

  return (
    <div className="card pred-card">
      <div className="pred-controls">
        <div className="model-toggles">
          <button
            className={`model-toggle ${activeModels.has('actual') ? 'active' : ''}`}
            style={{ '--c': '#f0f4ff' }}
            onClick={() => toggleModel('actual')}
          >
            Actual
          </button>
          {availableModels.map(m => (
            <button
              key={m.key}
              className={`model-toggle ${activeModels.has(m.key) ? 'active' : ''}`}
              style={{ '--c': m.color }}
              onClick={() => toggleModel(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="zoom-controls">
          <span className="zoom-label">Last</span>
          {[60, 120, 200, 500].map(n => (
            <button
              key={n}
              className={`range-btn ${zoom === n ? 'active' : ''}`}
              onClick={() => setZoom(n)}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={visible} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v?.slice(0,7)}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={v => `${(v*100).toFixed(1)}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip content={<PredTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />

          {activeModels.has('actual') && (
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="rgba(240,244,255,0.7)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          )}

          {availableModels.map(m =>
            activeModels.has(m.key) ? (
              <Line
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: m.color }}
                strokeOpacity={0.85}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="pred-note">
        Values are log returns × 100 (%). Positive = up day predicted, negative = down day predicted.
      </div>
    </div>
  )
}
