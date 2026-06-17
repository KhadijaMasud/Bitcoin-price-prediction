import { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

function MiniSparkline({ data, color }) {
  if (!data?.length) return null
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={['auto','auto']} />
        <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5}
              fill={`url(#spark-${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function OverviewPage({ summary, regMetrics, clsMetrics, priceData }) {
  const s   = summary.data
  const reg = (regMetrics.data || []).filter(r => r.RMSE != null).sort((a,b) => a.RMSE - b.RMSE)
  const cls = (clsMetrics.data || []).sort((a,b) => b.Accuracy - a.Accuracy)

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Dashboard Overview</h1>
        <p>BTC/USD next-day price direction prediction · XGBoost best model</p>
      </div>

      {/* Key numbers */}
      {s && (
        <div className="metric-row">
          <div className="metric-cell">
            <div className="metric-label">Best RMSE</div>
            <div className="metric-value">{s.best_regression?.rmse?.toFixed(5) ?? '—'}</div>
            <div className="metric-sub">{s.best_regression?.model}</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Direction Accuracy</div>
            <div className="metric-value">{s.best_classification ? (s.best_classification.accuracy*100).toFixed(1)+'%' : '—'}</div>
            <div className="metric-sub">{s.best_classification?.model}</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">High-Conf Accuracy</div>
            <div className="metric-value" style={{ color: 'var(--green)' }}>
              {s.high_conf_accuracy ? s.high_conf_accuracy+'%' : '—'}
            </div>
            <div className="metric-sub">When model &gt;{s.high_conf_threshold ?? 60}% confident</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Precision</div>
            <div className="metric-value">{s.best_classification?.precision?.toFixed(4) ?? '—'}</div>
            <div className="metric-sub">P(correct | predicted up)</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Models Evaluated</div>
            <div className="metric-value">{s.model_count ?? '—'}</div>
            <div className="metric-sub">incl. baselines</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Regression table */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Regression Leaderboard</span>
            <span className="panel-meta">↓ RMSE is better</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr>
                <th>Model</th>
                <th style={{ textAlign:'right' }}>RMSE</th>
                <th style={{ textAlign:'right' }}>MAE</th>
                <th style={{ textAlign:'right' }}>R²</th>
              </tr></thead>
              <tbody>
                {reg.map((r,i) => (
                  <tr key={r.model} className={i===0?'rank-1':''}>
                    <td>{r.model}</td>
                    <td style={{ textAlign:'right' }}>{r.RMSE?.toFixed(5)}</td>
                    <td style={{ textAlign:'right' }}>{r.MAE?.toFixed(5)}</td>
                    <td style={{ textAlign:'right', color: r.R2>0?'var(--green)':'var(--red)' }}>
                      {r.R2?.toFixed(4)??'—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Classification table */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Classification Leaderboard</span>
            <span className="panel-meta">↑ Accuracy is better</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr>
                <th>Model</th>
                <th style={{ textAlign:'right' }}>Accuracy</th>
                <th style={{ textAlign:'right' }}>Precision</th>
                <th style={{ textAlign:'right' }}>F1</th>
              </tr></thead>
              <tbody>
                {cls.map((r,i) => (
                  <tr key={r.model} className={i===0&&r.model!=='Majority Baseline'?'rank-1':''}>
                    <td>{r.model}</td>
                    <td style={{ textAlign:'right' }}>{(r.Accuracy*100).toFixed(2)}%</td>
                    <td style={{ textAlign:'right' }}>{r.Precision?.toFixed(4)}</td>
                    <td style={{ textAlign:'right' }}>{r.F1?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pipeline visual */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">ML Pipeline</span></div>
        <div className="panel-body">
          <div style={{ display:'flex', alignItems:'center', gap:0, overflowX:'auto' }}>
            {[
              { label:'Raw Data',       sub:'1-min OHLCV',        color:'#f5f7ff', border:'var(--border)' },
              { label:'Daily Bars',     sub:'OHLCV aggregated',   color:'#f5f7ff', border:'var(--border)' },
              { label:'Stationarity',   sub:'ADF test on returns', color:'#f5f7ff', border:'var(--border)' },
              { label:'19 Features',    sub:'TA + lags + vol',     color:'#f5f7ff', border:'var(--border)' },
              { label:'80/20 Split',    sub:'Time-ordered only',   color:'#f5f7ff', border:'var(--border)' },
              { label:'XGBoost',        sub:'Best model',          color:'var(--indigo)', border:'var(--indigo)', text:'#fff' },
            ].map((s, i, arr) => (
              <div key={s.label} style={{ display:'flex', alignItems:'center', flex: i<arr.length-1?1:'none' }}>
                <div style={{
                  padding:'10px 14px', borderRadius:8, border:`1px solid ${s.border}`,
                  background:s.color, textAlign:'center', minWidth:100,
                }}>
                  <div style={{ fontSize:12, fontWeight:600, color:s.text||'var(--text)' }}>{s.label}</div>
                  <div style={{ fontSize:10.5, color:s.text?'rgba(255,255,255,0.7)':'var(--text-sub)', marginTop:2 }}>{s.sub}</div>
                </div>
                {i < arr.length-1 && (
                  <div style={{ flex:1, height:1, background:'var(--border)', margin:'0 6px', position:'relative' }}>
                    <span style={{ position:'absolute', right:-5, top:-7, color:'var(--text-sub)', fontSize:13 }}>›</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
