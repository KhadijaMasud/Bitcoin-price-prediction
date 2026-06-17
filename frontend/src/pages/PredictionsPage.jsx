import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ScatterChart, Scatter
} from 'recharts'

function PredTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map(p => (
        <div className="chart-tooltip-row" key={p.dataKey}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{typeof p.value === 'number' ? '$' + p.value?.toLocaleString(undefined, { maximumFractionDigits: 0 }) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-row"><span>Predicted</span><span>{(d?.x*100).toFixed(3)}%</span></div>
      <div className="chart-tooltip-row"><span>Actual</span><span>{(d?.y*100).toFixed(3)}%</span></div>
      <div className="chart-tooltip-row">
        <span>Direction</span>
        <span style={{ color: (d?.x>0)===(d?.y>0) ? '#16a34a' : '#c8192a' }}>
          {(d?.x>0)===(d?.y>0) ? 'Correct' : 'Wrong'}
        </span>
      </div>
    </div>
  )
}

export default function PredictionsPage({ preds, price }) {
  const [tab, setTab] = useState('price')
  const raw      = preds.data || []
  const priceData = price.data || []

  const chartData = useMemo(() => {
    if (!raw.length || !priceData.length) return []
    const pm = Object.fromEntries(priceData.map(d => [d.date, d.close]))
    return raw.map((d, i) => {
      const prev = raw[i-1]?.date
      const p0   = prev ? pm[prev] : null
      return {
        date:        d.date,
        actual:      d.actual,
        gb_pred:     d.gb_reg_pred,
        actualPrice: p0 ? p0 * Math.exp(d.actual ?? 0) : null,
        gbPrice:     p0 && d.gb_reg_pred != null ? p0 * Math.exp(d.gb_reg_pred) : null,
      }
    })
  }, [raw, priceData])

  const scatterData = useMemo(() =>
    chartData.filter(d => d.gb_pred != null && d.actual != null)
      .map(d => ({ x: d.gb_pred, y: d.actual, correct: (d.gb_pred>0)===(d.actual>0) }))
  , [chartData])

  const dirAccuracy = useMemo(() => {
    const v = raw.filter(d => d.gb_reg_pred != null && d.actual != null)
    if (!v.length) return null
    return (v.filter(d => (d.gb_reg_pred>0)===(d.actual>0)).length / v.length * 100).toFixed(1)
  }, [raw])

  const priceChartData = chartData.filter(d => d.actualPrice && d.gbPrice)

  if (preds.loading) return <div className="loading-state">Loading predictions...</div>

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Predictions</h1>
        <p>XGBoost vs actual on test set · {dirAccuracy && `Direction accuracy: ${dirAccuracy}%`}</p>
      </div>

      <div className="tabs">
        <div className={`tab${tab==='price'   ?' active':''}`} onClick={()=>setTab('price')}>Implied Price</div>
        <div className={`tab${tab==='returns' ?' active':''}`} onClick={()=>setTab('returns')}>Log Returns</div>
        <div className={`tab${tab==='scatter' ?' active':''}`} onClick={()=>setTab('scatter')}>Accuracy Scatter</div>
      </div>

      {tab === 'price' && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Actual vs Predicted Price</span>
            <span className="panel-meta">Implied from log return predictions · test set only</span>
          </div>
          <div className="panel-body" style={{ padding: '14px 4px 4px' }}>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={priceChartData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#dde3ef" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false}
                       interval={Math.floor(priceChartData.length/6)} />
                <YAxis tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false} width={64}
                       tickFormatter={v => '$'+(v>=1000?(v/1000).toFixed(0)+'k':v)} />
                <Tooltip content={<PredTip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="actualPrice" stroke="#0d1526" strokeWidth={1.5} dot={false} name="Actual" />
                <Line type="monotone" dataKey="gbPrice" stroke="#1d4ed8" strokeWidth={1.5} dot={false} name="XGBoost" strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'returns' && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Daily Log Returns — Predicted vs Actual</span>
          </div>
          <div className="panel-body" style={{ padding: '14px 4px 4px' }}>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#dde3ef" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false}
                       interval={Math.floor(chartData.length/6)} />
                <YAxis tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false} width={56}
                       tickFormatter={v => (v*100).toFixed(1)+'%'} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-label">{label}</div>
                      {payload.map(p => (
                        <div className="chart-tooltip-row" key={p.dataKey}>
                          <span style={{ color: p.color }}>{p.name}</span>
                          <span>{(p.value*100).toFixed(3)}%</span>
                        </div>
                      ))}
                    </div>
                  )
                }} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                <ReferenceLine y={0} stroke="#dde3ef" strokeDasharray="3 3" />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="actual"  stroke="#8a9ab8" strokeWidth={1} dot={false} name="Actual" opacity={0.7} />
                <Line type="monotone" dataKey="gb_pred" stroke="#1d4ed8" strokeWidth={1.5} dot={false} name="XGBoost" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'scatter' && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Predicted vs Actual Return</span>
            <span className="panel-meta">Green = correct direction · Red = wrong direction</span>
          </div>
          <div className="panel-body" style={{ padding: '14px 4px 4px' }}>
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 8, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#dde3ef" />
                <XAxis type="number" dataKey="x" tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false}
                       tickFormatter={v => (v*100).toFixed(1)+'%'}
                       label={{ value: 'Predicted Return', position: 'insideBottom', offset: -8, fill: '#8a9ab8', fontSize: 11 }} />
                <YAxis type="number" dataKey="y" tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false}
                       tickFormatter={v => (v*100).toFixed(1)+'%'}
                       label={{ value: 'Actual Return', angle: -90, position: 'insideLeft', fill: '#8a9ab8', fontSize: 11 }} />
                <Tooltip content={<ScatterTip />} />
                <Scatter data={scatterData}
                  shape={({ cx, cy, payload }) => (
                    <circle cx={cx} cy={cy} r={2.5}
                      fill={payload.correct ? '#15803d' : '#c8192a'} opacity={0.55} />
                  )}
                />
              </ScatterChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:4, fontSize:12, color:'var(--text-sub)' }}>
              <span><span style={{color:'var(--green)'}}>●</span> Correct direction ({dirAccuracy}%)</span>
              <span><span style={{color:'var(--red)'}}>●</span> Wrong direction ({dirAccuracy ? (100-parseFloat(dirAccuracy)).toFixed(1) : '—'}%)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
