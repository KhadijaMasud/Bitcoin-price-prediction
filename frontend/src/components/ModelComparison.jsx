import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import './ModelComparison.css'

const COLORS = {
  'Persistence Baseline' : '#4a5a78',
  'Linear Regression'    : '#f59e0b',
  'Ridge'                : '#8b5cf6',
  'Lasso'                : '#06b6d4',
  'Random Forest'        : '#ec4899',
  'Gradient Boosting'    : '#10b981',
  'Majority Baseline'    : '#4a5a78',
  'Logistic Regression'  : '#3b82f6',
}

function RMSETooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="custom-tooltip">
      <div className="tooltip-label">{d?.model}</div>
      <div className="tooltip-row"><span>RMSE</span><span>{d?.RMSE?.toFixed(6)}</span></div>
      {d?.MAE  != null && <div className="tooltip-row"><span>MAE</span><span>{d?.MAE?.toFixed(6)}</span></div>}
      {d?.R2   != null && <div className="tooltip-row"><span>R²</span><span>{d?.R2?.toFixed(4)}</span></div>}
    </div>
  )
}

function shortName(name) {
  return name?.replace('Regression', 'Reg.')
             .replace('Boosting', 'Boost.')
             .replace('Baseline', 'Base.')
             .replace('Random ', 'RF ')
}

export default function ModelComparison({ data, type, loading }) {
  if (loading) return <div className="card loader"><div className="loader-dot"/><div className="loader-dot"/><div className="loader-dot"/></div>
  if (!data?.length) return <div className="card empty-state">No model data available.</div>

  const metric = type === 'regression' ? 'RMSE' : 'Accuracy'
  const inverted = type === 'regression' // lower is better

  const sorted = [...data].sort((a, b) =>
    inverted ? a[metric] - b[metric] : b[metric] - a[metric]
  )

  const best = sorted[0]?.model

  return (
    <div className="card model-card">
      <div className="model-list">
        {sorted.map((row, i) => {
          const val = row[metric]
          const maxVal = Math.max(...data.map(d => d[metric]))
          const minVal = Math.min(...data.map(d => d[metric]))
          const pct = inverted
            ? (1 - (val - minVal) / (maxVal - minVal + 1e-10)) * 100
            : ((val - minVal) / (maxVal - minVal + 1e-10)) * 100

          const isBest = row.model === best
          const color = COLORS[row.model] || '#3b82f6'

          return (
            <div key={row.model} className={`model-row ${isBest ? 'best' : ''}`}>
              <div className="model-row-header">
                <div className="model-row-name">
                  {isBest && <span className="best-badge">BEST</span>}
                  <span>{row.model}</span>
                </div>
                <span className="model-row-val" style={{ color }}>
                  {(val * (type === 'regression' ? 1 : 100)).toFixed(type === 'regression' ? 6 : 2)}
                  {type !== 'regression' && '%'}
                </span>
              </div>
              <div className="model-bar-bg">
                <div
                  className="model-bar-fill"
                  style={{ width: `${Math.max(pct, 2)}%`, background: color }}
                />
              </div>
              {type !== 'regression' && (
                <div className="model-sub-metrics">
                  {row.Precision != null && <span>Prec {(row.Precision*100).toFixed(1)}%</span>}
                  {row.Recall    != null && <span>Rec {(row.Recall*100).toFixed(1)}%</span>}
                  {row.F1        != null && <span>F1 {(row.F1*100).toFixed(1)}%</span>}
                </div>
              )}
              {type === 'regression' && (
                <div className="model-sub-metrics">
                  {row.MAE != null && <span>MAE {row.MAE?.toFixed(6)}</span>}
                  {row.R2  != null && <span>R² {row.R2?.toFixed(4)}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
