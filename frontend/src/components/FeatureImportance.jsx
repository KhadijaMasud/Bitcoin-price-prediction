import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import './FeatureImportance.css'

const FEATURE_DESCRIPTIONS = {
  Close          : 'Current closing price',
  Volume         : 'Daily traded volume',
  EMA9           : 'Exponential MA (9-day)',
  EMA21          : 'Exponential MA (21-day)',
  MACD           : 'MACD line (EMA12 - EMA26)',
  Signal         : 'MACD signal line (EMA9 of MACD)',
  RSI            : 'Relative Strength Index (14-day)',
  MOM            : 'Momentum (10-day price diff)',
  PROC           : 'Price Rate of Change (10-day %)',
  StochK         : 'Stochastic Oscillator %K (14-day)',
  lag_return_1   : 'Yesterday\'s log return',
  lag_return_2   : '2-day lagged log return',
  lag_return_3   : '3-day lagged log return',
  lag_return_4   : '4-day lagged log return',
  lag_return_5   : '5-day lagged log return',
}

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ec4899', '#ef4444', '#84cc16',
  '#f97316', '#a78bfa', '#67e8f9', '#6ee7b7',
  '#fcd34d', '#f9a8d4', '#fca5a5',
]

function FITooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{d?.feature}</div>
      <div className="tooltip-row"><span>Importance</span><span>{(d?.importance * 100).toFixed(2)}%</span></div>
      <div style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: 180 }}>
        {FEATURE_DESCRIPTIONS[d?.feature] || ''}
      </div>
    </div>
  )
}

export default function FeatureImportance({ data, loading }) {
  const [view, setView] = useState('bar')

  if (loading) return <div className="card loader"><div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/></div>
  if (!data?.length) return <div className="card empty-state">No feature importance data — run model pipeline first.</div>

  const sorted = [...data].sort((a, b) => b.importance - a.importance)
  const total  = sorted.reduce((s, d) => s + d.importance, 0)

  return (
    <div className="card fi-card">
      <div className="fi-controls">
        <div className="view-toggle">
          <button className={`view-btn ${view==='bar' ? 'active':''}`} onClick={()=>setView('bar')}>Chart</button>
          <button className={`view-btn ${view==='table' ? 'active':''}`} onClick={()=>setView('table')}>Table</button>
        </div>
      </div>

      {view === 'bar' ? (
        <div className="fi-bar-wrap">
          <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 32)}>
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 0, right: 80, left: 110, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={v => `${(v*100).toFixed(1)}%`}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="feature"
                tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                width={105}
              />
              <Tooltip content={<FITooltip />} />
              <Bar dataKey="importance" radius={[0,4,4,0]} barSize={18}>
                {sorted.map((entry, i) => (
                  <Cell key={entry.feature} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <table className="fi-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Feature</th>
              <th>Description</th>
              <th>Importance</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const cum = sorted.slice(0,i+1).reduce((s,d)=>s+d.importance,0)
              return (
                <tr key={row.feature}>
                  <td className="fi-rank">{i+1}</td>
                  <td className="fi-name" style={{ color: PALETTE[i%PALETTE.length] }}>{row.feature}</td>
                  <td className="fi-desc">{FEATURE_DESCRIPTIONS[row.feature] || '—'}</td>
                  <td className="fi-val">{(row.importance*100).toFixed(2)}%</td>
                  <td>
                    <div className="fi-cum-bar-bg">
                      <div className="fi-cum-bar-fill" style={{ width:`${Math.min(cum/total*100,100)}%`, background: PALETTE[i%PALETTE.length] }}/>
                    </div>
                    <span className="fi-cum-pct">{(cum*100).toFixed(1)}%</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
