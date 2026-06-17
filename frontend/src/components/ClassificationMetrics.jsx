import { useState, useMemo } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import './ClassificationMetrics.css'

const MODEL_COLORS = {
  'Majority Baseline'  : '#4a5a78',
  'Logistic Regression': '#3b82f6',
  'Random Forest'      : '#ec4899',
  'Gradient Boosting'  : '#10b981',
}

const METRICS = ['Accuracy', 'Precision', 'Recall', 'F1']

function ConfusionMatrix({ preds }) {
  const counts = useMemo(() => {
    if (!preds?.length) return null
    // Use GB predictions if available, else LR
    const predKey = preds[0]?.gb_cls_pred != null ? 'gb_cls_pred' : 'lr_pred'
    let tn=0, fp=0, fn=0, tp=0
    for (const row of preds) {
      const a = row.actual, p = row[predKey]
      if (a==0 && p==0) tn++
      else if (a==0 && p==1) fp++
      else if (a==1 && p==0) fn++
      else tp++
    }
    const total = tn+fp+fn+tp
    return { tn, fp, fn, tp, total,
      modelName: predKey === 'gb_cls_pred' ? 'Gradient Boosting' : 'Logistic Regression' }
  }, [preds])

  if (!counts) return null

  const { tn, fp, fn, tp, total, modelName } = counts

  return (
    <div className="confusion-wrap">
      <p className="cm-title">Confusion Matrix — {modelName}</p>
      <div className="cm-grid">
        <div className="cm-header-row">
          <div className="cm-spacer"/>
          <div className="cm-col-label">Pred DOWN</div>
          <div className="cm-col-label">Pred UP</div>
        </div>
        <div className="cm-data-row">
          <div className="cm-row-label">Actual DOWN</div>
          <div className="cm-cell true" title={`TN: ${tn}`}>
            <span className="cm-val">{tn}</span>
            <span className="cm-pct">{(tn/total*100).toFixed(1)}%</span>
            <span className="cm-badge tn">TN</span>
          </div>
          <div className="cm-cell false" title={`FP: ${fp}`}>
            <span className="cm-val">{fp}</span>
            <span className="cm-pct">{(fp/total*100).toFixed(1)}%</span>
            <span className="cm-badge fp">FP</span>
          </div>
        </div>
        <div className="cm-data-row">
          <div className="cm-row-label">Actual UP</div>
          <div className="cm-cell false" title={`FN: ${fn}`}>
            <span className="cm-val">{fn}</span>
            <span className="cm-pct">{(fn/total*100).toFixed(1)}%</span>
            <span className="cm-badge fn">FN</span>
          </div>
          <div className="cm-cell true" title={`TP: ${tp}`}>
            <span className="cm-val">{tp}</span>
            <span className="cm-pct">{(tp/total*100).toFixed(1)}%</span>
            <span className="cm-badge tp">TP</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClassificationMetrics({ metrics, preds, loading }) {
  const [tab, setTab] = useState('radar')

  if (loading) return <div className="card loader"><div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/></div>
  if (!metrics?.length) return <div className="card empty-state">No classification data.</div>

  const radarData = METRICS.map(metric => {
    const obj = { metric }
    metrics.forEach(m => { obj[m.model] = +(m[metric] * 100).toFixed(2) })
    return obj
  })

  const activeModels = metrics.map(m => m.model)

  return (
    <div className="card cls-card">
      <div className="cls-tabs">
        <button className={`tab-btn ${tab==='radar'?'active':''}`} onClick={()=>setTab('radar')}>Radar</button>
        <button className={`tab-btn ${tab==='matrix'?'active':''}`} onClick={()=>setTab('matrix')}>Confusion Matrix</button>
      </div>

      {tab === 'radar' && (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickCount={4}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                formatter={(v, name) => [`${v.toFixed(1)}%`, name]}
                contentStyle={{
                  background: '#1e2d45',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                }}
              />
              {activeModels.map(model => (
                <Radar
                  key={model}
                  name={model}
                  dataKey={model}
                  stroke={MODEL_COLORS[model] || '#3b82f6'}
                  fill={MODEL_COLORS[model] || '#3b82f6'}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>

          <div className="cls-table-mini">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  {METRICS.map(m => <th key={m}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {metrics.map((row, i) => (
                  <tr key={row.model}>
                    <td style={{ color: MODEL_COLORS[row.model] || '#fff' }}>{row.model}</td>
                    {METRICS.map(m => (
                      <td key={m} style={{ fontFamily: 'var(--font-mono)' }}>
                        {(row[m]*100).toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'matrix' && <ConfusionMatrix preds={preds} />}
    </div>
  )
}
