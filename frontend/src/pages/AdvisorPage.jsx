function SignalClass(signal) {
  if (!signal) return 'hold'
  const s = signal.toLowerCase()
  if (s.includes('buy'))  return 'buy'
  if (s.includes('sell')) return 'sell'
  return 'hold'
}

function Gauge({ value, max=100, color, label }) {
  const pct = Math.min(Math.max(value/max, 0), 1)
  const r=40, cx=50, cy=50
  const x1 = cx + r*Math.cos(Math.PI), y1 = cy + r*Math.sin(Math.PI)
  const angle = Math.PI + pct*Math.PI
  const x2 = cx + r*Math.cos(angle),   y2 = cy + r*Math.sin(angle)
  const large = pct > 0.5 ? 1 : 0
  return (
    <div style={{ textAlign:'center' }}>
      <svg width="100" height="58" viewBox="0 0 100 58">
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
              fill="none" stroke="#e8ecf8" strokeWidth="7" strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
                fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
        )}
        <text x="50" y="42" textAnchor="middle" fill="var(--text)"
              style={{ fontSize:13, fontWeight:700, fontFamily:'var(--mono)' }}>
          {value.toFixed(0)}{max===100?'%':''}
        </text>
      </svg>
      <div style={{ fontSize:10.5, color:'var(--text-sub)', marginTop:-4 }}>{label}</div>
    </div>
  )
}

function ScoreDots({ score }) {
  return (
    <div className="score-dots">
      {Array.from({length:15},(_,i)=>i-7).map(v => {
        const active = score>=0 ? (v>=0&&v<=score) : (v<=0&&v>=score)
        return (
          <div key={v} style={{
            width: v===0?2:10, height:18, borderRadius:2,
            background: v===0?'#cbd5e1' : active?(v>0?'var(--green)':'var(--red)'):'#e8ecf8',
            opacity: (active||v===0)?1:0.5,
          }} />
        )
      })}
      <span style={{ fontSize:11, color:'var(--text-sub)', marginLeft:6 }}>
        {score>0?'+':''}{score} / 7
      </span>
    </div>
  )
}

export default function AdvisorPage({ data }) {
  const d = data.data
  if (data.loading) return <div className="loading-state">Computing signals...</div>
  if (!d || data.error) return (
    <div className="stack">
      <div className="page-header"><h1>Investment Advisor</h1></div>
      <div className="api-error">API unavailable — start Flask server and train models first.</div>
    </div>
  )

  const sigClass = SignalClass(d.signal)
  const sigColor = sigClass==='buy'?'var(--green)':sigClass==='sell'?'var(--red)':'var(--amber)'
  const bulls = (d.signals||[]).filter(s=>s.signal==='Buy').length
  const bears = (d.signals||[]).filter(s=>s.signal==='Sell').length

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Investment Advisor</h1>
        <p>Composite signal · {d.latest_date} · Educational only — not financial advice.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Composite Signal</span>
          <span className="panel-meta">${d.latest_price?.toLocaleString()} BTC/USD</span>
        </div>
        <div className="panel-body">
          <div className="advisor-block">
            <div className="advisor-main">
              <div className="advisor-signal-label">Recommendation</div>
              <div className={`advisor-signal-value ${sigClass}`}>{d.signal}</div>
              <ScoreDots score={d.score} />

              {/* Gauge row */}
              <div style={{ display:'flex', gap:20, marginTop:8 }}>
                <Gauge value={d.confidence}    color={sigColor}                                                          label="Confidence" />
                <Gauge value={d.model_prob}    color={d.model_prob>50?'var(--green)':'var(--red)'}                       label="P(Up) ML" />
                <Gauge value={d.rsi}           color={d.rsi>70?'var(--red)':d.rsi<30?'var(--green)':'var(--indigo)'}    label="RSI 14" />
                <Gauge value={d.annualized_vol} max={150}   color="var(--indigo)"                                        label="Ann. Vol %" />
              </div>
            </div>

            <div className="advisor-side">
              {[
                ['Price',      '$'+d.latest_price?.toLocaleString()],
                ['MACD Diff',  d.macd_diff?.toFixed(2)],
                ['Bullish',    `${bulls} / ${d.signals?.length}`],
                ['Bearish',    `${bears} / ${d.signals?.length}`],
              ].map(([k,v])=>(
                <div className="advisor-kv" key={k}>
                  <span className="advisor-kv-label">{k}</span>
                  <span className="advisor-kv-value">{v}</span>
                </div>
              ))}
              <div className="advisor-kv">
                <span className="advisor-kv-label">Risk Level</span>
                <span className={`badge badge-${d.risk_level==='High'?'red':d.risk_level==='Medium'?'amber':'green'}`}>
                  {d.risk_level}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signal table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Indicator Breakdown</span>
          <span className="panel-meta">{bulls} bullish · {bears} bearish · {(d.signals?.length||0)-bulls-bears} neutral</span>
        </div>
        <div className="panel-body" style={{ padding:0 }}>
          <table className="data-table">
            <thead><tr><th>Indicator</th><th>Value</th><th>Signal</th><th>Basis</th></tr></thead>
            <tbody>
              {(d.signals||[]).map(s => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td style={{ fontFamily:'var(--mono)' }}>{s.value}</td>
                  <td><span className={`signal-badge signal-${SignalClass(s.signal)}`}>{s.signal}</span></td>
                  <td style={{ fontFamily:'var(--sans)', color:'var(--text-sub)', fontSize:11.5 }}>{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding:'10px 16px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'var(--r-sm)', fontSize:12, color:'#92400e' }}>
        <strong>Disclaimer</strong> — Student ML project. ~52–58% directional accuracy (higher when model is confident). Not financial advice.
      </div>
    </div>
  )
}
