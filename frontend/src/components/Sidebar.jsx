import {
  LayoutDashboard, TrendingUp, BarChart2,
  GitBranch, Layers, Lightbulb
} from 'lucide-react'

const ITEMS = [
  { id: 'overview',     label: 'Overview',      icon: LayoutDashboard },
  { id: 'price',        label: 'Price History',  icon: TrendingUp },
  { id: 'models',       label: 'Model Results',  icon: BarChart2 },
  { id: 'predictions',  label: 'Predictions',    icon: GitBranch },
  { id: 'features',     label: 'Feature Analysis', icon: Layers },
  { id: 'advisor',      label: 'Investment Advisor', icon: Lightbulb },
]

export default function Sidebar({ page, setPage, apiOnline }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>BTC/USD ML</h1>
        <span>Prediction Dashboard</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group-label">Navigation</div>
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className={`nav-item${page === id ? ' active' : ''}`}
            onClick={() => setPage(id)}
          >
            <Icon size={15} />
            {label}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className={`api-dot${apiOnline ? ' online' : ''}`} />
        API {apiOnline ? 'Connected' : 'Offline'}
      </div>
    </aside>
  )
}
