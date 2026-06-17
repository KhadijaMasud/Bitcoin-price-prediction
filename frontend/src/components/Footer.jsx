import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">₿</span>
          <span>BTC/USD ML Dashboard</span>
        </div>
        <div className="footer-info">
          <span>Models: Linear · Ridge · Lasso · Logistic · Random Forest · Gradient Boosting</span>
          <span className="footer-divider">·</span>
          <span>Data: Bitstamp 1-min OHLCV → Daily aggregated</span>
          <span className="footer-divider">·</span>
          <span>Built with React + Recharts + Flask</span>
        </div>
      </div>
    </footer>
  )
}
