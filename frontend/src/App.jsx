import { useState, useEffect, useCallback } from 'react'
import OverviewPage    from './pages/OverviewPage'
import PricePage       from './pages/PricePage'
import ModelsPage      from './pages/ModelsPage'
import PredictionsPage from './pages/PredictionsPage'
import FeaturePage     from './pages/FeaturePage'

const API = '/api'

export function useFetch(endpoint) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${API}${endpoint}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [endpoint])

  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

const PAGES = [
  { id: 'overview',     label: 'Overview' },
  { id: 'price',        label: 'Price & Signal' },
  { id: 'models',       label: 'Model Results' },
  { id: 'predictions',  label: 'Predictions' },
  { id: 'features',     label: 'Features' },
]

function TopNav({ page, setPage, apiOnline }) {
  return (
    <nav className="topnav">
      <div className="topnav-brand">
        <div className="btc-icon">₿</div>
        <div>
          <h1>BTC/USD ML</h1>
        </div>
      </div>

      <div className="topnav-links">
        {PAGES.map(p => (
          <div
            key={p.id}
            className={`nav-link${page === p.id ? ' active' : ''}`}
            onClick={() => setPage(p.id)}
          >
            {p.label}
          </div>
        ))}
      </div>

      <div className="topnav-right">
        <div className="api-pill">
          <span className={`api-dot${apiOnline ? ' online' : ''}`} />
          {apiOnline ? 'API Live' : 'API Offline'}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const [page, setPage] = useState('overview')

  const summary    = useFetch('/summary')
  const price      = useFetch('/price-history')
  const preds      = useFetch('/predictions')
  const regMetrics = useFetch('/regression-metrics')
  const clsMetrics = useFetch('/classification-metrics')
  const features   = useFetch('/feature-importance')
  const clsPreds   = useFetch('/classification-preds')
  const advisor    = useFetch('/advisor')

  const apiOnline = !summary.error

  const renderPage = () => {
    switch (page) {
      case 'overview':    return <OverviewPage summary={summary} regMetrics={regMetrics} clsMetrics={clsMetrics} />
      case 'price':       return <PricePage data={price} advisor={advisor} />
      case 'models':      return <ModelsPage regMetrics={regMetrics} clsMetrics={clsMetrics} />
      case 'predictions': return <PredictionsPage preds={preds} price={price} clsPreds={clsPreds} />
      case 'features':    return <FeaturePage data={features} />
      default:            return null
    }
  }

  return (
    <div className="layout">
      <TopNav page={page} setPage={setPage} apiOnline={apiOnline} />
      <main className="main">
        {!apiOnline && (
          <div className="api-error">
            API offline — run: <code style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'rgba(220,38,38,0.1)', padding: '1px 6px', borderRadius: 4 }}>cd backend &amp;&amp; python api.py</code>
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  )
}
