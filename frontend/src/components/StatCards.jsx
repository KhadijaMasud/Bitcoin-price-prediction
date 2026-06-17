import { useEffect, useRef, useState } from 'react'
import './StatCards.css'

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (target === null || target === undefined) return
    const start = performance.now()
    const startVal = 0

    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(startVal + (target - startVal) * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

function StatCard({ label, value, unit, sub, color, icon, decimals = 4, delay = 0 }) {
  const [visible, setVisible] = useState(false)
  const animated = useCountUp(visible ? (parseFloat(value) || 0) : 0, 1200)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  const display = value === null || value === undefined
    ? '—'
    : animated.toFixed(decimals)

  return (
    <div className="stat-card" style={{ '--accent': color }}>
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">
        {display}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className="stat-glow" />
    </div>
  )
}

export default function StatCards({ data, loading }) {
  if (loading) {
    return (
      <div className="stat-grid">
        {[0,1,2,3].map(i => (
          <div key={i} className="stat-card skeleton" />
        ))}
      </div>
    )
  }

  const br = data?.best_regression
  const bc = data?.best_classification

  return (
    <div className="stat-grid">
      <StatCard
        label="Best Regression RMSE"
        value={br ? br.rmse * 100 : null}
        unit="%"
        sub={br ? br.model : 'No data'}
        color="var(--accent-blue)"
        icon="📉"
        decimals={4}
        delay={0}
      />
      <StatCard
        label="Best Direction Accuracy"
        value={bc ? bc.accuracy * 100 : null}
        unit="%"
        sub={bc ? bc.model : 'No data'}
        color="var(--accent-green)"
        icon="🎯"
        decimals={2}
        delay={100}
      />
      <StatCard
        label="Best F1 Score"
        value={bc ? bc.f1 * 100 : null}
        unit="%"
        sub="Classification quality"
        color="var(--accent-purple)"
        icon="⚡"
        decimals={2}
        delay={200}
      />
      <StatCard
        label="Models Evaluated"
        value={data ? (data.model_count || 5) : null}
        unit=""
        sub="Linear · RF · GradBoost"
        color="var(--btc-orange)"
        icon="🤖"
        decimals={0}
        delay={300}
      />
    </div>
  )
}
