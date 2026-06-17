import { useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts'

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map(p => (
        <div className="chart-tooltip-row" key={p.dataKey}>
          <span>{p.name}</span><span>{typeof p.value === 'number' ? p.value.toFixed(5) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

const REG_PALETTE = ['#b45309', '#1d4ed8', '#6d28d9', '#475569', '#94a3b8']
const CLS_PALETTE = ['#b45309', '#1d4ed8', '#6d28d9', '#94a3b8']

export default function ModelsPage({ regMetrics, clsMetrics }) {
  const [tab, setTab] = useState('regression')

  const reg = (regMetrics.data || []).filter(r => r.RMSE != null).sort((a, b) => a.RMSE - b.RMSE)
  const cls = (clsMetrics.data || []).sort((a, b) => b.Accuracy - a.Accuracy)

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Model Results</h1>
        <p>All models benchmarked against naive baselines on the held-out test set.</p>
      </div>

      <div className="tabs">
        <div className={`tab${tab === 'regression' ? ' active' : ''}`} onClick={() => setTab('regression')}>Regression</div>
        <div className={`tab${tab === 'classification' ? ' active' : ''}`} onClick={() => setTab('classification')}>Classification</div>
      </div>

      {tab === 'regression' && (
        <div className="stack">
          <div className="grid-2">
            {[
              { key: 'RMSE', label: 'RMSE', note: '↓ lower is better', data: [...reg].sort((a,b)=>a.RMSE-b.RMSE) },
              { key: 'MAE',  label: 'MAE',  note: '↓ lower is better', data: [...reg].sort((a,b)=>a.MAE-b.MAE) },
            ].map(({ key, label, note, data }) => (
              <div className="panel" key={key}>
                <div className="panel-header">
                  <span className="panel-title">{label}</span>
                  <span className="panel-meta">{note}</span>
                </div>
                <div className="panel-body" style={{ padding: '14px 4px' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 3" stroke="#dde3ef" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false}
                             tickFormatter={v => v.toFixed(4)} domain={['auto', 'auto']} />
                      <YAxis type="category" dataKey="model" tick={{ fill: '#4a5d7e', fontSize: 11 }}
                             tickLine={false} axisLine={false} width={120} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey={key} radius={[0, 4, 4, 0]}>
                        {data.map((_, i) => <Cell key={i} fill={REG_PALETTE[i] || '#dde3ef'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Full Table</span>
              <span className="panel-meta">Sorted by RMSE</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead><tr>
                  <th>#</th><th>Model</th>
                  <th style={{ textAlign: 'right' }}>RMSE</th>
                  <th style={{ textAlign: 'right' }}>MAE</th>
                  <th style={{ textAlign: 'right' }}>R²</th>
                </tr></thead>
                <tbody>
                  {reg.map((r, i) => (
                    <tr key={r.model} className={i === 0 ? 'rank-1' : ''}>
                      <td style={{ color: 'var(--text-sub)' }}>#{i+1}</td>
                      <td>{r.model}</td>
                      <td style={{ textAlign: 'right' }}>{r.RMSE?.toFixed(6)}</td>
                      <td style={{ textAlign: 'right' }}>{r.MAE?.toFixed(6)}</td>
                      <td style={{ textAlign: 'right', color: r.R2 > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {r.R2?.toFixed(6) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'classification' && (
        <div className="stack">
          <div className="grid-2">
            {[
              { key: 'Accuracy', label: 'Accuracy', note: '↑ higher is better', fmt: v => (v*100).toFixed(1)+'%', domain: [0.45, 0.6] },
              { key: 'F1',       label: 'F1 Score', note: 'P/R balance',         fmt: v => v.toFixed(3),            domain: [0, 0.8] },
            ].map(({ key, label, note, fmt, domain }) => (
              <div className="panel" key={key}>
                <div className="panel-header">
                  <span className="panel-title">{label}</span>
                  <span className="panel-meta">{note}</span>
                </div>
                <div className="panel-body" style={{ padding: '14px 4px' }}>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={[...cls].sort((a,b) => b[key]-a[key])} layout="vertical"
                              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 3" stroke="#dde3ef" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#8a9ab8', fontSize: 10.5 }} tickLine={false} axisLine={false}
                             tickFormatter={fmt} domain={domain} />
                      <YAxis type="category" dataKey="model" tick={{ fill: '#4a5d7e', fontSize: 11 }}
                             tickLine={false} axisLine={false} width={120} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey={key} radius={[0, 4, 4, 0]}>
                        {cls.map((_, i) => <Cell key={i} fill={CLS_PALETTE[i] || '#dde3ef'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Full Table</span>
              <span className="panel-meta">Sorted by accuracy</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead><tr>
                  <th>Model</th>
                  <th style={{ textAlign: 'right' }}>Accuracy</th>
                  <th style={{ textAlign: 'right' }}>Precision</th>
                  <th style={{ textAlign: 'right' }}>Recall</th>
                  <th style={{ textAlign: 'right' }}>F1</th>
                </tr></thead>
                <tbody>
                  {cls.map((r, i) => (
                    <tr key={r.model} className={i === 0 && r.model !== 'Majority Baseline' ? 'rank-1' : ''}>
                      <td>{r.model}</td>
                      <td style={{ textAlign: 'right' }}>{(r.Accuracy*100).toFixed(2)}%</td>
                      <td style={{ textAlign: 'right' }}>{r.Precision?.toFixed(4)}</td>
                      <td style={{ textAlign: 'right' }}>{r.Recall?.toFixed(4)}</td>
                      <td style={{ textAlign: 'right' }}>{r.F1?.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
