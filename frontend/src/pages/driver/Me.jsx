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

  const stats = useMemo(() => {
    const list = orders || []
    const delivered = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'delivered')
    const inTransit = list.filter(o => ['in_transit','assigned','attempted','contacted'].includes(String(o?.shipmentStatus||'').toLowerCase()))
    const cancelled = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'cancelled')
    const returned = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'returned')
    const collected = delivered.reduce((sum, o) => sum + Math.max(0, Number(o?.collectedAmount||0)), 0)
    const codDue = delivered.reduce((sum, o) => sum + Math.max(0, Number(o?.codAmount||0)), 0)
    const balance = delivered.reduce((sum, o) => sum + Math.max(0, Number(o?.balanceDue||0)), 0)
    return {
      totalAssigned: list.length,
      deliveredCount: delivered.length,
      inTransitCount: inTransit.length,
      cancelledCount: cancelled.length,
      returnedCount: returned.length,
      collectedTotal: collected,
      codTotal: codDue,
      balanceTotal: balance,
    }
  }, [orders])

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
        <div style={{ fontWeight: 700 }}>My Delivery Stats</div>
        {loading ? (
          <div className="helper">Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Stat title="Total Assigned" value={stats.totalAssigned} />
            <Stat title="Delivered" value={stats.deliveredCount} highlight="success" />
            <Stat title="In Transit" value={stats.inTransitCount} />
            <Stat title="Cancelled" value={stats.cancelledCount} />
            <Stat title="Returned" value={stats.returnedCount} />
            <Stat title="Collected (Sum)" value={stats.collectedTotal.toFixed(2)} />
            <Stat title="COD (Sum)" value={stats.codTotal.toFixed(2)} />
            <Stat title="Balance (Sum)" value={stats.balanceTotal.toFixed(2)} />
          </div>
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
