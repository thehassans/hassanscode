import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../../api.js'

export default function DriverMe() {
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem('me') || '{}') } catch { return {} }
  })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try { const r = await apiGet('/api/users/me'); if (alive) setMe(r?.user || {}) } catch {}
      try { const r2 = await apiGet('/api/orders/driver/assigned'); if (alive) setOrders(r2?.orders || []) } catch {}
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  // Currency helpers
  const PHONE_CODE_TO_CCY = { '+966':'SAR', '+971':'AED', '+968':'OMR', '+973':'BHD' }
  const COUNTRY_TO_CCY = { 'SA':'SAR', 'AE':'AED', 'OM':'OMR', 'BH':'BHD', 'KSA':'SAR', 'UAE':'AED' }
  function currencyFromPhoneCode(code){ try{ return PHONE_CODE_TO_CCY[String(code||'').trim()] || 'SAR' }catch{ return 'SAR' } }
  function preferredCurrency(me){
    const c = String(me?.country||'').toUpperCase().trim()
    if (COUNTRY_TO_CCY[c]) return COUNTRY_TO_CCY[c]
    return 'SAR'
  }

  const stats = useMemo(() => {
    const list = orders || []
    const delivered = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'delivered')
    const inTransit = list.filter(o => ['in_transit','assigned','attempted','contacted','picked_up'].includes(String(o?.shipmentStatus||'').toLowerCase()))
    const cancelled = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'cancelled')
    const returned = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'returned')

    const byCcy = {}
    for (const o of delivered){
      const ccy = currencyFromPhoneCode(o?.phoneCountryCode || '')
      if (!byCcy[ccy]) byCcy[ccy] = { collected:0, cod:0, balance:0 }
      byCcy[ccy].collected += Math.max(0, Number(o?.collectedAmount||0))
      byCcy[ccy].cod += Math.max(0, Number(o?.codAmount||0))
      byCcy[ccy].balance += Math.max(0, Number(o?.balanceDue||0))
    }

    return {
      totalAssigned: list.length,
      deliveredCount: delivered.length,
      inTransitCount: inTransit.length,
      cancelledCount: cancelled.length,
      returnedCount: returned.length,
      byCcy,
      primaryCcy: preferredCurrency(me),
    }
  }, [orders, me])

  return (
    <div className="content" style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Driver Profile</div>
        <div className="helper">Your profile and delivery stats</div>
      </div>

      {/* Profile */}
      <div className="panel" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--panel-2)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 20 }}>
            {(((me.firstName||'')[0]) || 'D').toUpperCase()}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{(me.firstName||'') + ' ' + (me.lastName||'')}</div>
            <div className="helper" style={{ fontSize: 14 }}>{me.email || ''}</div>
            {me.phone && (
              <div className="helper" style={{ fontSize: 14 }}>{me.phone}</div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card" style={{ display:'grid', gap:12, padding: 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight: 700 }}>My Delivery Stats</div>
          <div className="chip" title="Preferred currency" style={{background:'var(--panel-2)'}}>Preferred: {stats.primaryCcy}</div>
        </div>
        {loading ? (
          <div className="helper">Loading…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <Stat title="Total Assigned" value={stats.totalAssigned} />
              <Stat title="Delivered" value={stats.deliveredCount} highlight="success" />
              <Stat title="In Transit" value={stats.inTransitCount} />
              <Stat title="Cancelled" value={stats.cancelledCount} />
              <Stat title="Returned" value={stats.returnedCount} />
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Delivered Amounts by Currency</div>
              <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
                {Object.keys(stats.byCcy).length === 0 ? (
                  <span className="helper">No delivered orders yet</span>
                ) : (
                  Object.entries(stats.byCcy).map(([ccy, v]) => (
                    <div key={ccy} className="panel" style={{ padding: 10, borderRadius: 10, display:'grid', gap:6, minWidth: 200 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontWeight: 700 }}>{ccy}</div>
                        <span className="chip" style={{ background: 'var(--panel-2)' }}>Delivered</span>
                      </div>
                      <Row label="Collected" value={`${ccy} ${v.collected.toFixed(2)}`} />
                      <Row label="COD" value={`${ccy} ${v.cod.toFixed(2)}`} />
                      <Row label="Balance" value={`${ccy} ${v.balance.toFixed(2)}`} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ title, value, highlight }){
  const color = highlight === 'success' ? 'var(--success)' : 'var(--fg)'
  return (
    <div className="panel" style={{ padding: 12 }}>
      <div className="helper" style={{ marginBottom: 6 }}>{title}</div>
      <div style={{ fontWeight: 800, fontSize: 20, color }}>{String(value)}</div>
    </div>
  )
}

function Row({ label, value }){
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize: 14 }}>
      <span className="helper">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}
