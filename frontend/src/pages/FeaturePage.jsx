import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-row">
        <span>Importance</span><span>{(payload[0].value*100).toFixed(2)}%</span>
      </div>
    </div>
  )
}

const PALETTE = ['#b45309','#1d4ed8','#15803d','#6d28d9','#c2410c',
                 '#0891b2','#be185d','#0369a1','#4f46e5','#7c3aed',
                 '#8a9ab8','#8a9ab8','#8a9ab8','#8a9ab8','#8a9ab8']

export default function FeaturePage({ data }) {
  const raw = data.data || []

  const features = useMemo(() => {
    if (!raw.length) return []
    let cum = 0
    return [...raw].sort((a,b)=>b.importance-a.importance).map(f => {
      cum += f.importance
      return { ...f, cumulative: cum }
    })
  }, [raw])

  if (data.loading) return <div className="loading-state">Loading...</div>

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Feature Analysis</h1>
        <p>XGBoost feature importances — Mean Decrease Impurity across all trees.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Importance by Feature</span>
          <span className="panel-meta">17 features total · sorted descending</span>
        </div>
        <div className="panel-body" style={{ padding: '14px 4px' }}>
          <ResponsiveContainer width="100%" height={Math.max(280, features.length * 26)}>
            <BarChart data={features} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#dde3ef" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false}
                     tickFormatter={v => (v*100).toFixed(1)+'%'} />
              <YAxis type="category" dataKey="feature" tick={{ fill: '#4a5d7e', fontSize: 11.5 }}
                     tickLine={false} axisLine={false} width={100} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}
                   label={{ position: 'right', formatter: v => (v*100).toFixed(1)+'%', fill: '#8a9ab8', fontSize: 10.5 }}>
                {features.map((_,i) => <Cell key={i} fill={PALETTE[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Ranked Table</span>
          <span className="panel-meta">Cumulative coverage</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead><tr>
              <th>#</th><th>Feature</th>
              <th style={{ textAlign:'right' }}>Importance</th>
              <th style={{ textAlign:'right' }}>Cumulative</th>
              <th style={{ minWidth: 120 }}>Weight</th>
            </tr></thead>
            <tbody>
              {features.map((f, i) => {
                const pct = f.importance * 100
                const max = features[0]?.importance * 100 || 1
                return (
                  <tr key={f.feature} className={i===0 ? 'rank-1' : ''}>
                    <td style={{ color:'var(--text-sub)' }}>#{i+1}</td>
                    <td>{f.feature}</td>
                    <td style={{ textAlign:'right' }}>{pct.toFixed(2)}%</td>
                    <td style={{ textAlign:'right', color:'var(--text-sub)' }}>{(f.cumulative*100).toFixed(1)}%</td>
                    <td>
                      <div className="mini-bar-wrap">
                        <div className="mini-bar-track">
                          <div className="mini-bar-fill"
                               style={{ width: `${(pct/max)*100}%`, background: PALETTE[i] }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
