import './Header.css'

export default function Header({ apiOnline }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <div className="btc-logo">₿</div>
          <div>
            <h1 className="header-title">BTC/USD ML Dashboard</h1>
            <p className="header-sub">Machine Learning Price Direction &amp; Return Prediction</p>
          </div>
        </div>

        <nav className="header-nav">
          <a href="#price">Price</a>
          <a href="#predictions">Predictions</a>
          <a href="#models">Models</a>
          <a href="#features">Features</a>
        </nav>

        <div className="header-status">
          <span className={`status-dot ${apiOnline ? 'online' : 'offline'}`} />
          <span className="status-text">{apiOnline ? 'API Online' : 'API Offline'}</span>
        </div>
      </div>
    </header>
  )
}
