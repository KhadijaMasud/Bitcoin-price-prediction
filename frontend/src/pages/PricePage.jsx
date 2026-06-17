import { useState, useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const RANGES = [
  { label: '1W',  days: 7 },
  { label: '1M',  days: 30 },
  { label: '3M',  days: 90 },
  { label: '1Y',  days: 365 },
  { label: 'All', days: null },
]

function PriceTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {[['Open','open'],['High','high'],['Low','low'],['Close','close']].map(([k,v]) =>
        d?.[v] != null && (
          <div className="chart-tooltip-row" key={k}>
            <span>{k}</span><span>${d[v].toLocaleString()}</span>
          </div>
        )
      )}
    </div>
  )
}

function SignalButton({ label, color, bg, probability }) {
  return (
    <div style={{
      flex: 1, padding: '16px 12px', borderRadius: 12,
      background: bg, color: '#fff', textAlign: 'center', cursor: 'default',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
        {probability != null ? `${probability}% confidence` : '—'}
      </div>
    </div>
  )
}

function IndicatorRow({ name, value, signal, note }) {
  const color = signal === 'Buy' ? '#16a34a' : signal === 'Sell' ? '#dc2626' : '#b45309'
  const bg    = signal === 'Buy' ? '#f0fdf4' : signal === 'Sell' ? '#fef2f2' : '#fffbeb'
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'9px 0', borderBottom:'1px solid var(--border)', gap:10 }}>
      <div style={{ flex:1, fontSize:12.5, color:'var(--text)', fontWeight:500 }}>{name}</div>
      <div style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--text-muted)', minWidth:80, textAlign:'right' }}>{value}</div>
      <div style={{
        fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:20,
        color, background:bg, minWidth:52, textAlign:'center',
      }}>{signal}</div>
    </div>
  )
}

export default function PricePage({ data, advisor }) {
  const [range, setRange] = useState('1Y')
  const all = data.data || []
  const adv = advisor?.data

  const filtered = useMemo(() => {
    const r = RANGES.find(x => x.label === range)
    return r?.days ? all.slice(-r.days) : all
  }, [all, range])

  if (data.loading) return <div className="loading-state">Loading price data...</div>

  const latest   = filtered[filtered.length - 1]
  const prev     = filtered[filtered.length - 2]
  const chg      = prev ? ((latest?.close - prev.close) / prev.close * 100) : 0
  const isUp     = chg >= 0
  const minC     = Math.min(...filtered.map(d => d.close))
  const maxC     = Math.max(...filtered.map(d => d.close))
  const pad      = (maxC - minC) * 0.08
  const maxVol   = Math.max(...filtered.map(d => d.volume || 0))
  const lineColor = isUp ? '#16a34a' : '#dc2626'

  const sigClass = adv?.signal?.toLowerCase().includes('buy') ? 'buy'
                 : adv?.signal?.toLowerCase().includes('sell') ? 'sell' : 'hold'
  const sigColor = sigClass === 'buy' ? '#16a34a' : sigClass === 'sell' ? '#dc2626' : '#b45309'
  const sigBg    = sigClass === 'buy' ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                 : sigClass === 'sell' ? 'linear-gradient(135deg,#dc2626,#ef4444)'
                 : 'linear-gradient(135deg,#b45309,#d97706)'

  const bulls = (adv?.signals || []).filter(s => s.signal === 'Buy').length
  const bears = (adv?.signals || []).filter(s => s.signal === 'Sell').length

  return (
    <div style={{ display:'flex', gap:16, height:'calc(100vh - var(--nav-h) - 32px)', minHeight:600 }}>

      {/* ── Left: Chart ── */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:12 }}>

        {/* Price header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div className="btc-icon" style={{ width:36, height:36, fontSize:16 }}>₿</div>
            <div>
              <div style={{ fontSize:24, fontWeight:700, fontFamily:'var(--mono)', letterSpacing:'-1px', lineHeight:1 }}>
                ${latest?.close?.toLocaleString()}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:3 }}>
                <span style={{ fontSize:13, fontWeight:600, color:lineColor }}>
                  {isUp ? '+' : ''}{chg.toFixed(2)}%
                </span>
                <span style={{ fontSize:11.5, color:'var(--text-sub)' }}>{latest?.date}</span>
              </div>
            </div>
          </div>

          <div className="range-selector">
            {RANGES.map(r => (
              <button key={r.label} className={`range-btn${range === r.label ? ' active' : ''}`}
                      onClick={() => setRange(r.label)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="panel" style={{ flex:1, display:'flex', flexDirection:'column' }}>
          <div className="panel-body" style={{ flex:1, padding:'16px 16px 8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filtered} margin={{ top:0, right:0, bottom:0, left:0 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={lineColor} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#6366f1" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="#eef0f8" vertical={false} />
                <XAxis dataKey="date" tick={{ fill:'#94a3b8', fontSize:10.5 }} tickLine={false} axisLine={false}
                       interval={Math.floor(filtered.length / 6)} />
                <YAxis yAxisId="price" orientation="right"
                       domain={[minC - pad, maxC + pad]}
                       tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v.toFixed(0))}
                       tick={{ fill:'#94a3b8', fontSize:10.5 }} tickLine={false} axisLine={false} width={58} />
                <YAxis yAxisId="vol" orientation="left" domain={[0, maxVol * 6]}
                       tick={false} axisLine={false} tickLine={false} width={0} />
                <Tooltip content={<PriceTip />} cursor={{ stroke:'#e8ecf8', strokeWidth:1 }} />
                <Bar yAxisId="vol" dataKey="volume" fill="url(#volFill)" />
                <Area yAxisId="price" type="monotone" dataKey="close"
                      stroke={lineColor} strokeWidth={2}
                      fill="url(#areaFill)" dot={false}
                      activeDot={{ r:4, fill:lineColor, strokeWidth:0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display:'flex', gap:10 }}>
          {[
            ['High',   '$' + maxC?.toLocaleString()],
            ['Low',    '$' + minC?.toLocaleString()],
            ['Days',   filtered.length],
            ['From',   filtered[0]?.date ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="panel" style={{ flex:1, padding:'10px 14px' }}>
              <div style={{ fontSize:10.5, color:'var(--text-sub)', marginBottom:3 }}>{k}</div>
              <div style={{ fontSize:13, fontWeight:600, fontFamily:'var(--mono)', color:'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Prediction Panel ── */}
      <div style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', gap:12 }}>

        {/* Signal header */}
        <div className="panel" style={{ padding:'20px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--text-sub)', textTransform:'uppercase', letterSpacing:1 }}>
              ML Signal
            </span>
            <span style={{
              fontSize:10.5, fontWeight:600, padding:'2px 10px', borderRadius:20,
              background: adv ? '#f0fdf4' : '#f5f7ff',
              color: adv ? '#16a34a' : 'var(--text-sub)',
            }}>
              {adv ? 'Live' : 'Loading...'}
            </span>
          </div>

          {adv ? (
            <>
              {/* Score bar */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-sub)', marginBottom:5 }}>
                  <span>Bearish</span>
                  <span style={{ fontWeight:600, color:sigColor }}>Score: {adv.score > 0 ? '+' : ''}{adv.score} / 7</span>
                  <span>Bullish</span>
                </div>
                <div style={{ height:6, background:'var(--border)', borderRadius:6, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', borderRadius:6,
                    background: sigBg,
                    width: `${Math.min(Math.abs(adv.score)/7*100, 100)}%`,
                    marginLeft: adv.score >= 0 ? '50%' : `${50 - Math.abs(adv.score)/7*50}%`,
                    transition: 'width 0.4s',
                  }} />
                </div>
              </div>

              {/* UP / DOWN buttons */}
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <SignalButton
                  label="UP"
                  bg={sigClass === 'buy' ? 'linear-gradient(135deg,#16a34a,#22c55e)' : '#e8ecf8'}
                  color={sigClass === 'buy' ? '#fff' : '#94a3b8'}
                  probability={sigClass === 'buy' ? adv.confidence : null}
                />
                <SignalButton
                  label="DOWN"
                  bg={sigClass === 'sell' ? 'linear-gradient(135deg,#dc2626,#ef4444)' : '#e8ecf8'}
                  color={sigClass === 'sell' ? '#fff' : '#94a3b8'}
                  probability={sigClass === 'sell' ? adv.confidence : null}
                />
              </div>

              {/* Composite label */}
              <div style={{
                textAlign:'center', padding:'10px', borderRadius:10,
                background: sigClass==='buy'?'#f0fdf4':sigClass==='sell'?'#fef2f2':'#fffbeb',
                border: `1px solid ${sigClass==='buy'?'#bbf7d0':sigClass==='sell'?'#fecaca':'#fde68a'}`,
              }}>
                <span style={{ fontSize:16, fontWeight:800, color:sigColor }}>{adv.signal}</span>
              </div>

              {/* Key stats */}
              <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  ['P(Up) ML',   adv.model_prob + '%'],
                  ['RSI 14',     adv.rsi?.toFixed(1)],
                  ['MACD Diff',  adv.macd_diff?.toFixed(2)],
                  ['Risk',       adv.risk_level],
                ].map(([k, v]) => (
                  <div key={k} style={{ background:'var(--surface-2)', borderRadius:8, padding:'8px 10px' }}>
                    <div style={{ fontSize:10.5, color:'var(--text-sub)' }}>{k}</div>
                    <div style={{ fontSize:14, fontWeight:700, fontFamily:'var(--mono)', color:'var(--text)', marginTop:2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Bull/bear count */}
              <div style={{ marginTop:12, display:'flex', gap:8 }}>
                <div style={{ flex:1, textAlign:'center', padding:'7px', borderRadius:8, background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:'#16a34a' }}>{bulls}</div>
                  <div style={{ fontSize:10.5, color:'#16a34a' }}>Bullish</div>
                </div>
                <div style={{ flex:1, textAlign:'center', padding:'7px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:'#dc2626' }}>{bears}</div>
                  <div style={{ fontSize:10.5, color:'#dc2626' }}>Bearish</div>
                </div>
                <div style={{ flex:1, textAlign:'center', padding:'7px', borderRadius:8, background:'#f5f7ff', border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:18, fontWeight:800, color:'var(--text-muted)' }}>
                    {(adv.signals?.length || 0) - bulls - bears}
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--text-sub)' }}>Neutral</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color:'var(--text-sub)', fontSize:13, textAlign:'center', padding:'20px 0' }}>
              Loading signals...
            </div>
          )}
        </div>

        {/* Indicator breakdown */}
        <div className="panel" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div className="panel-header">
            <span className="panel-title">Indicators</span>
            <span className="panel-meta">{adv?.latest_date}</span>
          </div>
          <div className="panel-body" style={{ flex:1, overflowY:'auto', padding:'0 16px' }}>
            {adv ? (adv.signals || []).map(s => (
              <IndicatorRow key={s.name} {...s} />
            )) : (
              <div style={{ color:'var(--text-sub)', fontSize:12, padding:'16px 0' }}>No data</div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ fontSize:10.5, color:'var(--text-sub)', textAlign:'center', padding:'0 4px' }}>
          Educational only — ~53% directional accuracy. Not financial advice.
        </div>
      </div>

    </div>
  )
}
