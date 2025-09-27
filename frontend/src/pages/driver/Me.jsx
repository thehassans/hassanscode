import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'

export default function DriverMe() {
  const toast = useToast()
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem('me') || '{}') } catch { return {} }
  })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  // Remittance state
  const [managers, setManagers] = useState([])
  const [remForm, setRemForm] = useState({ managerId:'', amount:'', fromDate:'', toDate:'', note:'' })
  const [remLoading, setRemLoading] = useState(false)
  const [remittances, setRemittances] = useState([])
  const [remSummary, setRemSummary] = useState({ totalDeliveredOrders: 0, totalCollectedAmount: 0, currency: '' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try { const r = await apiGet('/api/users/me'); if (alive) setMe(r?.user || {}) } catch {}
      try { const r2 = await apiGet('/api/orders/driver/assigned'); if (alive) setOrders(r2?.orders || []) } catch {}
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  // Socket: live updates for remittance acceptance
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      socket.on('remittance.accepted', ()=> { try{ loadRemittances() }catch{} })
    }catch{}
    return ()=>{
      try{ socket && socket.off('remittance.accepted') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  // Remittance helpers
  async function loadManagers(){
    try{ const res = await apiGet('/api/users/my-managers'); setManagers(Array.isArray(res?.users)? res.users:[]) }catch{ setManagers([]) }
  }
  async function loadRemittances(){
    try{ const res = await apiGet('/api/finance/remittances'); setRemittances(Array.isArray(res?.remittances)? res.remittances:[]) }catch{ setRemittances([]) }
  }
  async function loadRemittanceSummary(range){
    try{
      const params = new URLSearchParams()
      if (range?.fromDate) params.set('fromDate', range.fromDate)
      if (range?.toDate) params.set('toDate', range.toDate)
      const res = await apiGet(`/api/finance/remittances/summary?${params.toString()}`)
      setRemSummary({
        totalDeliveredOrders: Number(res?.totalDeliveredOrders||0),
        totalCollectedAmount: Number(res?.totalCollectedAmount||0),
        currency: res?.currency || ''
      })
    }catch{ setRemSummary({ totalDeliveredOrders:0, totalCollectedAmount:0, currency:'' }) }
  }
  async function submitRemittance(){
    setRemLoading(true)
    try{
      const payload = { managerId: remForm.managerId, amount: Number(remForm.amount||0) }
      if (remForm.fromDate) payload.fromDate = remForm.fromDate
      if (remForm.toDate) payload.toDate = remForm.toDate
      if ((remForm.note||'').trim()) payload.note = remForm.note.trim()
      await apiPost('/api/finance/remittances', payload)
      toast.success('Remittance submitted and pending acceptance')
      setRemForm({ managerId:'', amount:'', fromDate:'', toDate:'', note:'' })
      await loadRemittances()
    }catch(e){
      alert(e?.message || 'Failed to submit remittance')
    }finally{ setRemLoading(false) }
  }

  // Initial load for remittance UI
  useEffect(()=>{ try{ loadManagers(); loadRemittances(); loadRemittanceSummary({}) }catch{} },[])

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

      {/* Remittance to Manager */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header">
          <div className="card-title">Send Amount to Manager</div>
          <div className="card-subtitle">Choose manager, enter amount, and optionally a date range.</div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
          <select className="input" value={remForm.managerId} onChange={e=> setRemForm(f=>({ ...f, managerId: e.target.value }))} title="Choose your manager">
            <option value="">-- Select Manager (same country) --</option>
            {managers.map(m => (
              <option key={String(m._id||m.id)} value={String(m._id||m.id)}>{`${m.firstName||''} ${m.lastName||''}`}</option>
            ))}
          </select>
          <div className="input" style={{display:'flex', alignItems:'center', gap:8, paddingRight:10}}>
            <input style={{flex:1, minWidth:0}} type="number" min="0" step="0.01" placeholder="Amount" value={remForm.amount} onChange={e=> setRemForm(f=>({ ...f, amount: e.target.value }))} />
            <span style={{opacity:0.9, whiteSpace:'nowrap'}}>{remSummary.currency || ''}</span>
          </div>
          <input className="input" type="date" value={remForm.fromDate} onChange={e=> { const v=e.target.value; setRemForm(f=>({ ...f, fromDate: v })); loadRemittanceSummary({ ...remForm, fromDate: v }) }} />
          <input className="input" type="date" value={remForm.toDate} onChange={e=> { const v=e.target.value; setRemForm(f=>({ ...f, toDate: v })); loadRemittanceSummary({ ...remForm, toDate: v }) }} />
        </div>
        <div className="section" style={{display:'grid', gap:8}}>
          <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
            <span className="badge">Total Deliveries: {remSummary.totalDeliveredOrders}</span>
            <span className="badge">Total Collected: {remSummary.currency} {remSummary.totalCollectedAmount.toFixed(2)}</span>
          </div>
          <textarea className="input" placeholder="Note (optional)" value={remForm.note} onChange={e=> setRemForm(f=>({ ...f, note: e.target.value }))} rows={2} />
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn" disabled={remLoading || !remForm.managerId || remForm.amount==='' } onClick={submitRemittance}>{remLoading? 'Submitting…':'Submit Remittance'}</button>
          </div>
        </div>
      </div>

      {/* My Remittances */}
      <div className="card" style={{display:'grid', gap:8}}>
        <div className="card-header">
          <div className="card-title">My Remittances</div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {remittances.length === 0 ? (
            <div className="empty-state">No remittances yet</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Date</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Manager</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Period</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Delivered</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map(r => (
                  <tr key={String(r._id||r.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={{padding:'8px 10px'}}>{`${r.manager?.firstName||''} ${r.manager?.lastName||''}`}</td>
                    <td style={{padding:'8px 10px'}}>{`${r.currency||''} ${Number(r.amount||0).toFixed(2)}`}</td>
                    <td style={{padding:'8px 10px'}}>{r.fromDate? new Date(r.fromDate).toLocaleDateString() : '-'} — {r.toDate? new Date(r.toDate).toLocaleDateString() : '-'}</td>
                    <td style={{padding:'8px 10px'}}>{r.totalDeliveredOrders||0}</td>
                    <td style={{padding:'8px 10px'}}>{r.status==='accepted' ? <span className="badge" style={{borderColor:'#10b981', color:'#10b981'}}>Delivered</span> : <span className="badge" style={{borderColor:'#f59e0b', color:'#f59e0b'}}>Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
