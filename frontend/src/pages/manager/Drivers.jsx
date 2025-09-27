import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'

export default function ManagerDrivers(){
  const [drivers, setDrivers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [filters, setFilters] = useState({ country:'', city:'' })
  const [q, setQ] = useState('')
  const [remit, setRemit] = useState({ items: [], loading: false })

  function onFilterChange(e){
    const { name, value } = e.target
    setFilters(f => ({ ...f, [name]: value }))
  }

  async function loadRemittances(){
    setRemit(r=>({ ...r, loading: true }))
    try{ const res = await apiGet('/api/finance/remittances'); setRemit({ items: Array.isArray(res?.remittances)? res.remittances:[], loading: false }) }
    catch{ setRemit({ items: [], loading: false }) }
  }
  useEffect(()=>{ loadRemittances() },[])

  async function acceptRemittance(id){
    try{ await apiPost(`/api/finance/remittances/${id}/accept`, {}); await loadRemittances() }catch(e){ alert(e?.message || 'Failed to accept') }
  }

  async function loadDrivers(query=''){
    try{
      const data = await apiGet(`/api/users/drivers?q=${encodeURIComponent(query)}`)
      setDrivers(data.users||[])
    }catch{ setDrivers([]) }
  }

  async function loadOrders(){
    setLoadingOrders(true)
    try{
      const params = new URLSearchParams()
      if (filters.country) params.set('country', filters.country)
      if (filters.city) params.set('city', filters.city)
      const data = await apiGet(`/api/orders/unassigned?${params.toString()}`)
      setOrders(data.orders||[])
    }catch{ setOrders([]) }
    finally{ setLoadingOrders(false) }
  }

  useEffect(()=>{ loadDrivers('') },[])
  useEffect(()=>{ const id=setTimeout(()=> loadDrivers(q), 300); return ()=> clearTimeout(id) },[q])
  useEffect(()=>{ loadOrders() },[filters.country, filters.city])

  // Real-time updates: listen for workspace events to refresh orders, drivers, and remittances
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
      const refreshOrders = ()=>{ loadOrders() }
      const refreshDrivers = ()=>{ loadDrivers(q) }
      const refreshRemit = ()=>{ loadRemittances() }
      socket.on('orders.changed', refreshOrders)
      socket.on('driver.created', refreshDrivers)
      socket.on('driver.deleted', refreshDrivers)
      socket.on('remittance.created', refreshRemit)
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.off('driver.created') }catch{}
      try{ socket && socket.off('driver.deleted') }catch{}
      try{ socket && socket.off('remittance.created') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[q, filters.country, filters.city])

  const driversByCity = useMemo(()=>{
    const m = new Map()
    for (const d of drivers){
      const key = (d.city||'').toLowerCase()
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(d)
    }
    return m
  },[drivers])

  async function assign(orderId, driverId){
    if (!driverId) return alert('Please select a driver')
    setLoading(true)
    try{
      await apiPost(`/api/orders/${orderId}/assign-driver`, { driverId })
      await loadOrders()
      alert('Assigned')
    }catch(e){ alert(e?.message || 'Failed to assign') }
    finally{ setLoading(false) }
  }

  function fmtDate(s){ try{ return new Date(s).toLocaleString() }catch{ return '' } }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Drivers</div>
          <div className="page-subtitle">Assign unassigned orders to drivers by city. Filters are optional; choose country/city to narrow results.</div>
        </div>

      {/* Remittances from Drivers */}
      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-header">
          <div className="card-title">Remittance Requests</div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {remit.loading ? (
            <div>Loading…</div>
          ) : remit.items.length === 0 ? (
            <div className="empty-state">No remittance requests</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Driver</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Country</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Period</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Delivered</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                  <th style={{textAlign:'right', padding:'8px 10px'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {remit.items.map(r => (
                  <tr key={String(r._id||r.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{`${r.driver?.firstName||''} ${r.driver?.lastName||''}`}</td>
                    <td style={{padding:'8px 10px'}}>{r.country||'-'}</td>
                    <td style={{padding:'8px 10px'}}>{`${r.currency||''} ${Number(r.amount||0).toFixed(2)}`}</td>
                    <td style={{padding:'8px 10px'}}>{r.fromDate? new Date(r.fromDate).toLocaleDateString() : '-'} — {r.toDate? new Date(r.toDate).toLocaleDateString() : '-'}</td>
                    <td style={{padding:'8px 10px'}}>{r.totalDeliveredOrders||0}</td>
                    <td style={{padding:'8px 10px'}}>{r.status}</td>
                    <td style={{padding:'8px 10px', textAlign:'right'}}>
                      {r.status==='pending' ? (
                        <button className="btn" onClick={()=> acceptRemittance(String(r._id||r.id))}>Accept</button>
                      ) : (
                        <span className="badge" style={{borderColor:'#10b981', color:'#10b981'}}>Accepted {r.acceptedAt? new Date(r.acceptedAt).toLocaleString(): ''}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <input className="input" placeholder="Search drivers" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:240}}/>
          <input className="input" placeholder="Country (e.g., UAE, Oman, KSA, Bahrain)" name="country" value={filters.country} onChange={onFilterChange} style={{maxWidth:220}} />
          <input className="input" placeholder="City (e.g., Dubai, Muscat, Riyadh)" name="city" value={filters.city} onChange={onFilterChange} style={{maxWidth:220}} />
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-header">
          <div className="card-title">Unassigned Orders {filters.country || filters.city ? `(filtered)` : ''}</div>
        </div>
        <div style={{overflow:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Customer</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Country</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>City</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Details</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Created</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Assign to</th>
                <th style={{textAlign:'right', padding:'10px 12px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrders ? (
                <tr><td colSpan={7} style={{padding:12, opacity:0.7}}>Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} style={{padding:12, opacity:0.7}}>No unassigned orders</td></tr>
              ) : (
                orders.map(ord => {
                  const list = driversByCity.get((ord.city||'').toLowerCase()) || []
                  return (
                    <tr key={ord._id || ord.id} style={{borderTop:'1px solid var(--border)'}}>
                      <td style={{padding:'10px 12px'}}>{ord.customerPhone}</td>
                      <td style={{padding:'10px 12px'}}>{ord.orderCountry||'-'}</td>
                      <td style={{padding:'10px 12px'}}>{ord.city||'-'}</td>
                      <td style={{padding:'10px 12px', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis'}} title={ord.details}>{ord.details}</td>
                      <td style={{padding:'10px 12px'}}>{fmtDate(ord.createdAt)}</td>
                      <td style={{padding:'10px 12px'}}>
                        {list.length ? (
                          <select className="input" defaultValue="" onChange={e=>{ ord.__assignTo = e.target.value }} style={{minWidth:180}}>
                            <option value="">-- Select driver --</option>
                            {list.map(d => (
                              <option key={d._id||d.id} value={d._id||d.id}>{d.firstName} {d.lastName} ({d.city})</option>
                            ))}
                          </select>
                        ) : (
                          <span className="badge danger">No drivers in this city</span>
                        )}
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'right'}}>
                        <button className="btn" disabled={loading || list.length===0} onClick={()=> assign(ord._id||ord.id, ord.__assignTo)}>Assign</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-header">
          <div className="card-title">Drivers {filters.city? `(city: ${filters.city})` : ''}</div>
        </div>
        <div style={{display:'grid', gap:8}}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:8}}>
            {drivers
              .filter(d => !filters.city || String(d.city||'').toLowerCase() === String(filters.city||'').toLowerCase())
              .map(d => (
              <div key={d._id||d.id} className="card" style={{padding:10, display:'grid', gap:6}}>
                <div style={{fontWeight:700}}>{d.firstName} {d.lastName}</div>
                <div style={{opacity:0.9}}>{d.email}</div>
                <div style={{opacity:0.9}}>{d.phone||'-'}</div>
                <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                  <span className="badge">{d.country||'-'}</span>
                  <span className="badge">{d.city||'-'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
