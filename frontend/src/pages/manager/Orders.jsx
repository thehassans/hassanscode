import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, API_BASE } from '../../api'
import { io } from 'socket.io-client'

export default function ManagerOrders(){
  const [me, setMe] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} } })
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState('')
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  const perms = me?.managerPermissions || {}

  async function fetchMe(){ try{ const { user } = await apiGet('/api/users/me'); setMe(user||{}) }catch{} }
  async function load(){
    setLoading(true)
    try{ const res = await apiGet('/api/orders'); setOrders(Array.isArray(res?.orders)? res.orders:[]) }catch{ setOrders([]) }
    try{ const res = await apiGet('/api/users/drivers'); setDrivers(Array.isArray(res?.users)? res.users:[]) }catch{ setDrivers([]) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ fetchMe(); load() },[])

  // live updates
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, auth:{ token }, withCredentials:true })
      socket.on('orders.changed', ()=> load())
    }catch{}
    return ()=>{ try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  },[])

  const filtered = useMemo(()=>{
    let rows = Array.isArray(orders)? orders:[]
    if (country) rows = rows.filter(o => String(o.orderCountry||'') === country)
    if (city) rows = rows.filter(o => String(o.city||'').toLowerCase() === city.toLowerCase())
    const t = q.trim().toLowerCase()
    if (t){
      rows = rows.filter(o => {
        return (
          String(o.customerName||'').toLowerCase().includes(t) ||
          String(o.customerPhone||'').toLowerCase().includes(t) ||
          String(o.details||'').toLowerCase().includes(t) ||
          String(o.invoiceNumber||'').toLowerCase().includes(t)
        )
      })
    }
    return rows
  }, [orders, country, city, q])

  const cities = useMemo(()=>{
    const set = new Set()
    for (const o of orders){ if (o?.city) set.add(o.city) }
    return Array.from(set)
  }, [orders])

  const countries = ['UAE','Oman','KSA','Bahrain']

  async function assignDriver(orderId, driverId){
    setAssigning(orderId)
    try{ await apiPost(`/api/orders/${orderId}/assign-driver`, { driverId }); await load() }catch(err){ alert(err?.message||'Failed to assign') }finally{ setAssigning('') }
  }

  function statusBadge(st){
    const s = String(st||'').toLowerCase()
    const map = { pending:'#f59e0b', assigned:'#6366f1', in_transit:'#3b82f6', delivered:'#10b981', cancelled:'#ef4444', returned:'#e11d48' }
    const color = map[s] || 'var(--muted)'
    return <span className="chip" style={{border:`1px solid ${color}`, color, background:'transparent'}}>{s.replace('_',' ')||'-'}</span>
  }

  function Card({ o }){
    const id = String(o?._id||'')
    const driverId = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
    const myDrivers = drivers.filter(d => !o.city || !d.city || String(d.city).toLowerCase() === String(o.city).toLowerCase())
    const fullAddress = [o.customerAddress, o.customerArea, o.city, o.orderCountry, o.customerLocation].filter(Boolean).filter((v,i,a)=> a.indexOf(v)===i).join(', ')
    const driverName = o?.deliveryBoy ? `${o.deliveryBoy.firstName||''} ${o.deliveryBoy.lastName||''}`.trim() : ''
    return (
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{alignItems:'center'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div className="badge">{o.orderCountry || '-'}</div>
            <div className="chip" style={{background:'transparent'}}>{o.city || '-'}</div>
            <div>{statusBadge(o.shipmentStatus || o.status)}</div>
            {driverName && (
              <div className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}} title={driverName}>Driver: <strong style={{marginLeft:6}}>{driverName}</strong></div>
            )}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {o.invoiceNumber ? <div style={{fontWeight:800}}>#{o.invoiceNumber}</div> : null}
            <button className="btn secondary" onClick={()=> window.open(`/label/${id}`, '_blank', 'noopener,noreferrer')}>Print Label</button>
          </div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
          <div>
            <div className="label">Customer</div>
            <div style={{fontWeight:700}}>{o.customerName || '-'}</div>
            <div className="helper" style={{whiteSpace:'nowrap'}}>{`${o.phoneCountryCode||''} ${o.customerPhone||''}`.trim()}</div>
            <div className="helper" title={fullAddress} style={{overflow:'hidden', textOverflow:'ellipsis'}}>{fullAddress || '-'}</div>
          </div>
          <div>
            <div className="label">Product</div>
            <div style={{fontWeight:700}}>{o.productId?.name || '-'}</div>
            <div className="helper">Qty: {o.quantity || 1}</div>
            <div className="helper">Total: {o.total != null ? Number(o.total).toFixed(2) : '-'}</div>
          </div>
          <div>
            <div className="label">Assigned Driver</div>
            <div style={{display:'grid', gap:8, alignItems:'start'}}>
              <select className="input" value={driverId} onChange={e=> assignDriver(id, e.target.value)} disabled={assigning===id} title={driverId ? 'Change assigned driver' : 'Select a driver'}>
                <option value="">-- Select Driver --</option>
                {(myDrivers.length? myDrivers: drivers).map(d => (
                  <option key={String(d._id)} value={String(d._id)}>{`${d.firstName||''} ${d.lastName||''}${d.city? ' • '+d.city:''}`}</option>
                ))}
              </select>
              <button className="btn" onClick={()=> assignDriver(id, driverId)} disabled={!driverId || assigning===id} style={{width:'100%'}}>
                {assigning===id? 'Assigning…':'Assign'}
              </button>
            </div>
          </div>
        </div>
        <div className="section" style={{display:'flex', gap:12, alignItems:'center', justifyContent:'space-between'}}>
          <div className="helper">Created by: {(o.createdBy?.firstName||'') + ' ' + (o.createdBy?.lastName||'')}</div>
          <div className="helper">Created: {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}</div>
        </div>
      </div>
    )
  }

  if (!perms.canCreateOrders){
    return (
      <div className="section">
        <div className="page-header"><div><div className="page-title gradient heading-purple">Orders</div><div className="page-subtitle">You do not have access to Orders.</div></div></div>
        <div className="card"><div>You don't have permission to view this page. Please contact the workspace owner.</div></div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Orders</div>
          <div className="page-subtitle">Assign drivers and print labels</div>
        </div>
      </div>
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header">
          <div className="card-title">Filters</div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
          <input className="input" placeholder="Search by name, phone, invoice, details" value={q} onChange={e=> setQ(e.target.value)} />
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value=''>All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={city} onChange={e=> setCity(e.target.value)}>
            <option value=''>All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:'grid', gap:12, marginTop:12}}>
        {loading ? (
          <div className="card"><div className="section">Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="card"><div className="section">No orders found</div></div>
        ) : (
          filtered.map(o => <Card key={String(o._id)} o={o} />)
        )}
      </div>
    </div>
  )
}
