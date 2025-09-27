import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'

function StatusBadge({ status, kind='status' }){
  const s = String(status||'').toLowerCase()
  let color = { borderColor:'#e5e7eb', color:'#374151' }
  if (kind==='shipment'){
    if (s==='delivered') color = { borderColor:'#10b981', color:'#065f46' }
    else if (['in_transit','assigned','shipped','picked_up'].includes(s)) color = { borderColor:'#3b82f6', color:'#1d4ed8' }
    else if (['returned','cancelled'].includes(s)) color = { borderColor:'#ef4444', color:'#991b1b' }
    else if (s==='pending') color = { borderColor:'#f59e0b', color:'#b45309' }
  } else {
    if (s==='shipped') color = { borderColor:'#3b82f6', color:'#1d4ed8' }
    else if (s==='pending') color = { borderColor:'#f59e0b', color:'#b45309' }
  }
  return <span className="chip" style={{ background:'transparent', ...color }}>{status||'-'}</span>
}

function useOrders(){
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(()=>{ (async()=>{
    setLoading(true)
    try{ const r = await apiGet('/api/orders'); setOrders(Array.isArray(r?.orders)? r.orders:[]) }
    catch(e){ setError(e?.message||'Failed to load orders') }
    finally{ setLoading(false) }
  })() },[])
  return { orders, loading, error, setOrders }
}

function DetailRow({ label, value }){
  return (
    <div style={{display:'grid', gridTemplateColumns:'160px 1fr', gap:8}}>
      <div className="label" style={{fontWeight:700}}>{label}</div>
      <div className="helper">{value ?? '-'}</div>
    </div>
  )
}

function OrderTimeline({ order }){
  const fmt = (d)=> d ? new Date(d).toLocaleString() : '-'
  const ship = String(order?.shipmentStatus||'').toLowerCase()
  const isReturned = ['returned','cancelled'].includes(ship)
  const isDelivered = ship==='delivered'
  const finalLabel = isReturned ? (ship.charAt(0).toUpperCase()+ship.slice(1)) : 'Delivered'
  const finalColor = isReturned ? '#ef4444' : (isDelivered ? '#10b981' : '#9ca3af')
  const finalAt = isDelivered ? order?.deliveredAt : (isReturned ? (order?.updatedAt || null) : null)

  const steps = [
    { label:'Created', at: order?.createdAt, color:'#9ca3af', done: true },
    { label:'Shipped', at: order?.shippedAt, color:'#3b82f6', done: !!order?.shippedAt },
    { label: finalLabel, at: finalAt, color: finalColor, done: isDelivered || isReturned },
  ]

  return (
    <div style={{display:'grid', gap:10}}>
      {steps.map((s, idx)=> (
        <div key={idx} style={{display:'grid', gridTemplateColumns:'18px 1fr', gap:10}}>
          <div style={{display:'grid', justifyItems:'center'}}>
            <div style={{width:12, height:12, borderRadius:999, background:s.color}} aria-hidden />
            {idx < steps.length-1 && (
              <div style={{width:2, height:28, background:'#e5e7eb', marginTop:4}} aria-hidden />
            )}
          </div>
          <div>
            <div style={{fontWeight:800, color: s.done ? 'var(--fg)' : 'var(--muted)'}}>{s.label}</div>
            <div className="helper">{fmt(s.at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function UserOrders(){
  const { orders, loading, error, setOrders } = useOrders()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [shipFilter, setShipFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const colTemplate = '140px 1.2fr 1fr 110px 130px 130px 1fr 1fr 120px 140px 110px 110px 180px 120px'

  const filtered = useMemo(()=>{
    let list = orders.slice()
    const q = query.trim().toLowerCase()
    if (q){
      list = list.filter(o=>
        String(o.invoiceNumber||'').toLowerCase().includes(q) ||
        String(o.customerPhone||'').toLowerCase().includes(q) ||
        String(o.customerName||'').toLowerCase().includes(q) ||
        String(o.details||'').toLowerCase().includes(q)
      )
    }
    if (statusFilter) list = list.filter(o=> String(o.status||'').toLowerCase() === statusFilter)
    if (shipFilter) list = list.filter(o=> String(o.shipmentStatus||'').toLowerCase() === shipFilter)
    return list
  }, [orders, query, statusFilter, shipFilter])

  const totals = useMemo(()=>{
    const COMM = 0.12
    let cod = 0, bal = 0, priceSum = 0, upc = 0, tot = 0
    for (const o of filtered){
      const qty = Math.max(1, Number(o?.quantity||1))
      const price = (o?.total!=null ? Number(o.total) : Number(o?.productId?.price||0) * qty)
      const delivered = String(o?.shipmentStatus||'').toLowerCase()==='delivered'
      cod += Number(o?.codAmount||0)
      bal += Number(o?.balanceDue||0)
      priceSum += price
      const comm = price * COMM
      upc += delivered ? 0 : comm
      tot += delivered ? comm : 0
    }
    return { cod, bal, priceSum, upc, tot }
  }, [filtered])

  function shortId(id){ return String(id||'').slice(-6).toUpperCase() }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }

  // Live updates: refresh on order changes in workspace
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const reload = async ()=>{ try{ const r = await apiGet('/api/orders'); setOrders(Array.isArray(r?.orders)? r.orders:[]) }catch{} }
      socket.on('orders.changed', reload)
    }catch{}
    return ()=>{ try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  }, [setOrders])

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header" style={{alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Orders</div>
          <div className="page-subtitle">View all workspace orders, assigned agents and drivers, statuses, and details.</div>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Search by invoice, phone, customer, details" value={query} onChange={e=> setQuery(e.target.value)} style={{minWidth:320}}/>
          <select className="input" value={statusFilter} onChange={e=> setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
          </select>
          <select className="input" value={shipFilter} onChange={e=> setShipFilter(e.target.value)}>
            <option value="">All Shipment</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Legend removed as per request */}

      <div className="card" style={{display:'grid'}}>
        <div className="section" style={{paddingBottom:0}}>
          {loading ? (
            <div className="helper">Loading…</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">No orders found</div>
          ) : (
            <div className="table responsive" style={{border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
              <div className="thead" style={{background:'rgba(59,130,246,0.08)', borderBottom:'1px solid var(--border)'}}>
                <div className="tr" style={{display:'grid', gridTemplateColumns: colTemplate}}>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Order</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Customer</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Product</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)', textAlign:'right'}}>Price</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)', textAlign:'right'}}>Upcoming 12%</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)', textAlign:'right'}}>Total 12%</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Agent</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Driver</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Status</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Shipment</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)', textAlign:'right'}}>COD</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)', textAlign:'right'}}>Balance</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, borderRight:'1px solid var(--border)'}}>Created</div>
                  <div className="th" style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>Actions</div>
                </div>
              </div>
              <div className="tbody">
                {filtered.map((o, idx) => {
                  const id = String(o._id||o.id)
                  const ordNo = o.invoiceNumber ? `#${o.invoiceNumber}` : shortId(id)
                  const agentName = (o.createdBy && o.createdBy.role !== 'user') ? userName(o.createdBy) : (o.createdBy?.role==='user' ? 'Owner' : '-')
                  const driverName = o.deliveryBoy ? userName(o.deliveryBoy) : '-'
                  const productName = o.productId?.name || '-'
                  const qty = Math.max(1, Number(o?.quantity||1))
                  const price = (o?.total!=null ? Number(o.total) : Number(o?.productId?.price||0) * qty)
                  const delivered = String(o?.shipmentStatus||'').toLowerCase()==='delivered'
                  const comm = price * 0.12
                  return (
                    <div className="tr" key={id} style={{display:'grid', gridTemplateColumns: colTemplate, borderBottom:'1px solid var(--border)', background: idx%2? 'transparent':'var(--panel)'}}>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{ordNo}</div>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.customerName||'-'}<div className="helper">{o.customerPhone||''}</div></div>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{productName}<div className="helper">Qty: {Math.max(1, Number(o.quantity||1))}</div></div>
                      <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{price.toFixed(2)}</div>
                      <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{(!delivered ? comm : 0).toFixed(2)}</div>
                      <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{(delivered ? comm : 0).toFixed(2)}</div>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{agentName}</div>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{driverName}</div>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}><StatusBadge status={o.status} /></div>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}><StatusBadge status={o.shipmentStatus} kind='shipment' /></div>
                      <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{Number(o.codAmount||0).toFixed(2)}</div>
                      <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{Number(o.balanceDue||0).toFixed(2)}</div>
                      <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.createdAt? new Date(o.createdAt).toLocaleString(): ''}</div>
                      <div className="td" style={{padding:'10px 12px', textAlign:'right'}}>
                        <button className="btn light small" onClick={()=> setSelected(o)}>View</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Footer Totals */}
              <div className="tfoot" style={{borderTop:'1px solid var(--border)'}}>
                <div className="tr" style={{display:'grid', gridTemplateColumns: colTemplate, background:'rgba(0,0,0,0.02)'}}>
                  <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}} colSpan={3}>Totals</div>
                  <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{totals.priceSum.toFixed(2)}</div>
                  <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{totals.upc.toFixed(2)}</div>
                  <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{totals.tot.toFixed(2)}</div>
                  <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}></div>
                  <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}></div>
                  <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}></div>
                  <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{totals.cod.toFixed(2)}</div>
                  <div className="td" style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{totals.bal.toFixed(2)}</div>
                  <div className="td" style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}></div>
                  <div className="td" style={{padding:'10px 12px', textAlign:'right'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Modal */}
      {selected && (
        <div className="modal" role="dialog" aria-modal="true" onClick={()=> setSelected(null)}>
          <div className="modal-card" style={{maxWidth:860}} onClick={e=> e.stopPropagation()}>
            <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
              <div className="card-title">Order {selected.invoiceNumber? ('#'+selected.invoiceNumber) : shortId(selected._id)}</div>
              <button className="btn light" onClick={()=> setSelected(null)}>Close</button>
            </div>
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12}}>
                <DetailRow label="Customer" value={`${selected.customerName||'-'} (${selected.customerPhone||''})`} />
                <DetailRow label="Location" value={`${selected.orderCountry||''} • ${selected.city||''} • ${selected.customerArea||''}`} />
                <DetailRow label="Address" value={selected.customerAddress||'-'} />
                <DetailRow label="Product" value={`${selected.productId?.name||'-'} • Qty ${Math.max(1, Number(selected.quantity||1))}`} />
                <DetailRow label="Agent" value={(selected.createdBy && selected.createdBy.role!=='user') ? `${selected.createdBy.firstName||''} ${selected.createdBy.lastName||''}`.trim() : 'Owner'} />
                <DetailRow label="Driver" value={selected.deliveryBoy ? `${selected.deliveryBoy.firstName||''} ${selected.deliveryBoy.lastName||''}`.trim() : '-'} />
                <DetailRow label="Status" value={selected.status||'-'} />
                <DetailRow label="Shipment" value={selected.shipmentStatus||'-'} />
                <DetailRow label="Courier" value={`${selected.courierName||'-'} • ${selected.trackingNumber||''}`} />
                <DetailRow label="COD" value={`${Number(selected.codAmount||0).toFixed(2)} • Collected ${Number(selected.collectedAmount||0).toFixed(2)}`} />
                <DetailRow label="Shipping Fee" value={Number(selected.shippingFee||0).toFixed(2)} />
                <DetailRow label="Balance Due" value={Number(selected.balanceDue||0).toFixed(2)} />
                <DetailRow label="Notes" value={selected.details||'-'} />
                <DetailRow label="Delivery Notes" value={selected.deliveryNotes||'-'} />
                <DetailRow label="Return Reason" value={selected.returnReason||'-'} />
                <DetailRow label="Created" value={selected.createdAt? new Date(selected.createdAt).toLocaleString(): ''} />
                <DetailRow label="Shipped" value={selected.shippedAt? new Date(selected.shippedAt).toLocaleString(): '-'} />
                <DetailRow label="Delivered" value={selected.deliveredAt? new Date(selected.deliveredAt).toLocaleString(): '-'} />
                <DetailRow label="Invoice" value={selected.invoiceNumber || '-'} />
              </div>
              <div style={{display:'grid', gap:8}}>
                <div style={{fontWeight:800}}>Timeline</div>
                <OrderTimeline order={selected} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
