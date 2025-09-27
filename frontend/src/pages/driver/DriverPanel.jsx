import React, { useEffect, useState, useRef } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'

export default function DriverPanel() {
  const [assigned, setAssigned] = useState([])
  const [loading, setLoading] = useState(false)
  const [city, setCity] = useState(() => {
    try { return localStorage.getItem('driver.city') || '' } catch { return '' }
  })
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('driver.sortBy') || 'nearest' } catch { return 'nearest' }
  }) // nearest, farthest, newest, oldest
  const [driverLocation, setDriverLocation] = useState(null)

  // Get driver's current location
  function refreshLocation(){
    if (!('geolocation' in navigator)) return
    try{
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        },
        (error) => { console.log('Location access denied:', error) }
      )
    }catch{}
  }

  useEffect(() => { refreshLocation() }, [])

  async function loadAssigned() {
    setLoading(true)
    try {
      const data = await apiGet('/api/orders/driver/assigned')
      setAssigned(data.orders || [])
    } catch {
      setAssigned([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssigned()
  }, [])
  // city no longer affects list; kept for future filtering

  // Persist filters and sort
  useEffect(() => { try { localStorage.setItem('driver.city', city) } catch {} }, [city])
  useEffect(() => { try { localStorage.setItem('driver.sortBy', sortBy) } catch {} }, [sortBy])
  // includeAssigned preference removed

  // Real-time updates
  useEffect(() => {
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token },
      })
      const refresh = () => { try { loadAssigned() } catch {} }
      socket.on('order.assigned', refresh)
      socket.on('order.updated', refresh)
    } catch {}
    return () => {
      try { socket && socket.off('order.assigned') } catch {}
      try { socket && socket.off('order.updated') } catch {}
      try { socket && socket.disconnect() } catch {}
    }
  }, [])

  // Calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371 // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Get distance for an order
  function getOrderDistance(order) {
    if (!driverLocation || !order.locationLat || !order.locationLng) return null
    return calculateDistance(
      driverLocation.lat,
      driverLocation.lng,
      order.locationLat,
      order.locationLng
    )
  }

  // Sort orders based on selected criteria
  function sortOrders(orders) {
    const ordersWithDistance = orders.map((order) => ({
      ...order,
      distance: getOrderDistance(order),
    }))

    return ordersWithDistance.sort((a, b) => {
      switch (sortBy) {
        case 'nearest':
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return a.distance - b.distance
        case 'farthest':
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return b.distance - a.distance
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt)
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt)
        default:
          return 0
      }
    })
  }

  function fmtDate(s) {
    try {
      return new Date(s).toLocaleString()
    } catch {
      return ''
    }
  }

  // Currency helpers
  const PHONE_CODE_TO_CCY = { '+966':'SAR', '+971':'AED', '+968':'OMR', '+973':'BHD' }
  function currencyFromPhoneCode(code){
    try{ return PHONE_CODE_TO_CCY[String(code||'').trim()] || (code ? code.replace(/\D/g,'') : 'SAR') }catch{ return 'SAR' }
  }

  function fmtPrice(o) {
    try {
      // Prefer explicit order.total when present
      if (o && o.total != null && !Number.isNaN(Number(o.total))){
        const ccy = currencyFromPhoneCode(o.phoneCountryCode || '')
        return `${ccy} ${Number(o.total).toFixed(2)}`
      }
      const qty = Math.max(1, Number(o?.quantity || 1))
      const price = Number(o?.productId?.price || 0)
      const cur = o?.productId?.baseCurrency || 'SAR'
      const total = price * qty
      return `${cur} ${total.toFixed(2)}`
    } catch {
      return 'SAR 0.00'
    }
  }

  function formatDistance(distance) {
    if (distance === null) return 'Distance unknown'
    if (distance < 1) return `${(distance * 1000).toFixed(0)}m`
    return `${distance.toFixed(1)}km`
  }

  function openMaps(order) {
    const lat = order?.locationLat
    const lng = order?.locationLng
    if (typeof lat === 'number' && typeof lng === 'number') {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank', 'noopener,noreferrer')
      return
    }
    const addr = order?.customerAddress || order?.customerLocation || ''
    if (addr) {
      window.open(
        `https://www.google.com/maps?q=${encodeURIComponent(addr)}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  function openWhatsApp(phone) {
    if (phone) {
      const cleanPhone = phone.replace(/[^\d+]/g, '')
      window.open(`https://wa.me/${cleanPhone}`, '_blank', 'noopener,noreferrer')
    }
  }

  function callPhone(phone) {
    if (phone) {
      window.location.href = `tel:${phone}`
    }
  }

  function openSMS(phone) {
    if (phone) {
      try {
        window.location.href = `sms:${phone}`
      } catch (_) {}
    }
  }

  async function deliverOrder(order) {
    try {
      const note = window.prompt('Add delivery note (optional):', '')
      const amtStr = window.prompt('Collected amount (optional):', '')
      const payload = {}
      if (note && note.trim()) payload.note = note.trim()
      const amt = Number(amtStr)
      if (!Number.isNaN(amt) && amtStr !== null && amtStr !== '') {
        payload.collectedAmount = Math.max(0, amt)
      }
      await apiPost(`/api/orders/${order._id || order.id}/deliver`, payload)
      await loadAssigned()
    } catch (e) {
      alert(e?.message || 'Failed to mark delivered')
    }
  }

  async function cancelOrder(order) {
    try {
      const reason = window.prompt('Reason for cancellation:', '')
      if (reason === null) return
      await apiPost(`/api/orders/${order._id || order.id}/cancel`, { reason })
      await loadAssigned()
    } catch (e) {
      alert(e?.message || 'Failed to cancel order')
    }
  }

  const OrderCard = ({ order, showActions = false, onClaim }) => {
    const distance = getOrderDistance(order)
    const [status, setStatus] = useState('') // '', delivered, cancelled, no_response
    const [note, setNote] = useState('')
    const [amount, setAmount] = useState('')
    const [saving, setSaving] = useState(false)
    const [claiming] = useState(false)
    const [expanded, setExpanded] = useState(false) // top customer reveal
    const touchStartYRef = useRef(null)
    const [detailsExpanded, setDetailsExpanded] = useState(false) // bottom details sheet (initially closed)
    const detailsTouchStartYRef = useRef(null)

    function onTouchStart(e){
      try{ touchStartYRef.current = e.touches && e.touches.length ? e.touches[0].clientY : null }catch{ touchStartYRef.current = null }
    }
    function onTouchEnd(e){
      try{
        const startY = touchStartYRef.current
        const endY = (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0].clientY : null
        if (startY!=null && endY!=null){
          const dy = endY - startY
          if (dy > 24) setExpanded(true) // swipe down to expand
          if (dy < -24) setExpanded(false) // swipe up to collapse
        }
      }catch{}
      touchStartYRef.current = null
    }

    function detailsOnTouchStart(e){
      try{ detailsTouchStartYRef.current = e.touches && e.touches.length ? e.touches[0].clientY : null }catch{ detailsTouchStartYRef.current = null }
    }
    function detailsOnTouchEnd(e){
      try{
        const startY = detailsTouchStartYRef.current
        const endY = (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0].clientY : null
        if (startY!=null && endY!=null){
          const dy = endY - startY
          if (dy < -24) setDetailsExpanded(true) // swipe up to expand
          if (dy > 24) setDetailsExpanded(false) // swipe down to collapse
        }
      }catch{}
      detailsTouchStartYRef.current = null
    }

    const areaText = order.customerAddress || order.customerLocation || [order.city, order.orderCountry].filter(Boolean).join(', ') || '—'
    const customerName = order.customerName || order.customerName || '—'

    async function saveStatus() {
      if (!status) return alert('Please select a status')
      setSaving(true)
      try {
        const id = order._id || order.id
        if (status === 'delivered') {
          const payload = {}
          if (note.trim()) payload.note = note.trim()
          if (amount !== '' && !Number.isNaN(Number(amount))) payload.collectedAmount = Math.max(0, Number(amount))
          await apiPost(`/api/orders/${id}/deliver`, payload)
        } else if (status === 'cancelled') {
          await apiPost(`/api/orders/${id}/cancel`, { reason: note || '' })
        } else if (status === 'no_response' || status === 'attempted' || status === 'contacted' || status === 'picked_up') {
          await apiPost(`/api/orders/${id}/shipment/update`, { shipmentStatus: status, deliveryNotes: note || '' })
        }
        await loadAssigned()
        setStatus('')
        setNote('')
        setAmount('')
      } catch (e) {
        alert(e?.message || 'Failed to update status')
      } finally {
        setSaving(false)
      }
    }

    const isPickedUp = String(order.shipmentStatus || order.status || '').toLowerCase() === 'picked_up'

    return (
      <div className="driver-order-card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{position:'relative'}}>
        {/* Top invoice chip */}
        <div style={{display:'flex', alignItems:'center', marginBottom:8}}>
          <div className="chip" style={{background:'#635bff14', color:'#635bff', fontWeight:700}}>
            {order.invoiceNumber ? `#${order.invoiceNumber}` : `Order #${order._id?.slice(-6) || 'N/A'}`}
          </div>
        </div>
        {/* Corner small banner for Picked Up */}
        {isPickedUp && (
          <div className="chip" style={{position:'absolute', top:8, right:8, background:'#f59e0b22', color:'#b45309', fontWeight:800}}>PICKED UP</div>
        )}

        <div className="order-content">
          {/* Top Summary */}
          <div className="summary" style={{display:'grid', gap:6}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
              <div>
                <div style={{fontWeight:700, fontSize:16}}>{customerName}</div>
                <div style={{display:'flex', alignItems:'center', gap:6, marginTop:2}}>
                  <span title="Open in Maps" style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', color:'var(--link)'}} onClick={()=> openMaps(order)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    <span>{areaText}</span>
                  </span>
                </div>
                {order.customerAddress && (
                  <div style={{opacity:0.8, marginTop:2, fontSize:13}}>Street: {order.customerAddress}</div>
                )}
                <div style={{display:'flex', alignItems:'center', gap:6, marginTop:6}}>
                  <span style={{opacity:0.9, display:'inline-flex', alignItems:'center', gap:6}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    </svg>
                    <strong>Total:</strong> <span className="value price">{fmtPrice(order)}</span>
                  </span>
                  {/* distance chip removed for minimal UI */}
                </div>
              </div>
              <div style={{textAlign:'right', minWidth:110}}>
                <div className="chip" style={{background:'var(--panel-2)'}} title="Created at">{fmtDate(order.createdAt)}</div>
              </div>
            </div>
          </div>

          <div className={`details-sheet ${detailsExpanded ? 'open' : 'closed'}`}>
            <button
              type="button"
              className="details-header"
              onClick={() => setDetailsExpanded(v => !v)}
              onTouchStart={detailsOnTouchStart}
              onTouchEnd={detailsOnTouchEnd}
              aria-expanded={detailsExpanded}
              aria-controls={`details-${order._id}`}
            >
              <span className="section-title" style={{margin:0}}>{detailsExpanded ? 'Hide Details' : 'View Order Detail'}</span>
              <span className={`chevron ${detailsExpanded ? 'up' : 'down'}`} aria-hidden />
            </button>
            <div className="details-body">
              <div className="order-details">
                <div className="info-row">
                  <span className="label">Product:</span>
                  <span className="value">{order.details || 'No details provided'}</span>
                </div>
                {order.invoiceNumber && (
                  <div className="info-row">
                    <span className="label">Invoice #:</span>
                    <span className="value">{order.invoiceNumber}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="label">Quantity:</span>
                  <span className="value">{order.quantity || 1}</span>
                </div>
                <div className="info-row">
                  <span className="label">Price:</span>
                  <span className="value price">{fmtPrice(order)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Customer:</span>
                  <span className="value">{customerName} • {order.customerPhone || '—'}</span>
                </div>
                {order.preferredTiming && (
                  <div className="info-row">
                    <span className="label">Preferred Timing:</span>
                    <span className="value">{order.preferredTiming}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="label">City:</span>
                  <span className="value">{order.city || 'Not specified'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Country:</span>
                  <span className="value">{order.orderCountry || 'Not specified'}</span>
                </div>
                {(order.customerAddress || order.customerLocation) && (
                  <div className="info-row">
                    <span className="label">Address:</span>
                    <span className="value">{order.customerAddress || order.customerLocation}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="label">Created:</span>
                  <span className="value">{fmtDate(order.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="action-bar" style={{display:'flex', gap:12, justifyContent:'space-between', marginTop:10}}>
            <button className="inline-icon-btn map" onClick={()=> openMaps(order)} title="Open Map" aria-label="Open Map" style={{width:44, height:44, borderRadius:12, display:'grid', placeItems:'center', background:'var(--panel)', border:'1px solid var(--border)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </button>
            <button className="inline-icon-btn call" onClick={()=> callPhone(order.customerPhone)} title="Call" aria-label="Call" style={{width:44, height:44, borderRadius:12, display:'grid', placeItems:'center', background:'var(--panel)', border:'1px solid var(--border)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            </button>
            <button className="inline-icon-btn sms" onClick={()=> openSMS(order.customerPhone)} title="SMS" aria-label="SMS" style={{width:44, height:44, borderRadius:12, display:'grid', placeItems:'center', background:'var(--panel)', border:'1px solid var(--border)'}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
                <text x="12" y="13" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">SMS</text>
              </svg>
            </button>
            <button className="inline-icon-btn wa" onClick={()=> openWhatsApp(order.customerPhone)} title="WhatsApp" aria-label="WhatsApp" style={{width:44, height:44, borderRadius:12, display:'grid', placeItems:'center', background:'var(--panel)', border:'1px solid var(--border)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.63z"/></svg>
            </button>
          </div>

          {showActions && (
            <div className="order-actions" style={{flexDirection:'column', alignItems:'stretch'}}>
              <div className="status-row" style={{marginBottom:8}}>
                <select
                  className="input"
                  value={status}
                  onChange={(e)=> setStatus(e.target.value)}
                  style={{borderRadius:12}}
                >
                  <option value="">Select status…</option>
                  <option value="picked_up">Picked Up</option>
                  <option value="delivered">Delivered</option>
                  <option value="attempted">Attempted</option>
                  <option value="no_response">No Response</option>
                  <option value="contacted">Contacted</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="status-form" style={{display:'grid', gap:10}}>
                <label className="input-label">{status === 'cancelled' ? 'Reason' : 'Note'}</label>
                <textarea className="input" placeholder={status === 'cancelled' ? 'Reason for cancellation...' : 'Add a short note...'} value={note} onChange={e=> setNote(e.target.value)} rows={2} />
                {status === 'delivered' && (
                  <>
                    <label className="input-label">Collected Amount</label>
                    <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={e=> setAmount(e.target.value)} />
                  </>
                )}
                <button className="action-btn deliver-btn" disabled={saving || !status} onClick={saveStatus}>{saving ? 'Saving...' : 'Save Status'}</button>
              </div>
            </div>
          )}

          {/* Claim feature removed: drivers only see assigned orders */}
        </div>
      </div>
    )
  }

  const sortedAssigned = sortOrders(assigned)

  return (
    <div className="driver-panel">
      <div className="panel-header">
        <h1 className="panel-title">Driver Panel</h1>
        <p className="panel-subtitle">Manage your delivery orders efficiently</p>
      </div>


      <div className="orders-section">
        <div className="section-header">
          <h2 className="section-title">My Assigned Orders</h2>
          <span className="order-count">{assigned.length}</span>
        </div>

        <div className="orders-list">
          {loading ? (
            <div className="loading-state">Loading assigned orders...</div>
          ) : sortedAssigned.length === 0 ? (
            <div className="empty-state">No assigned orders</div>
          ) : (
            sortedAssigned.map((order) => (
              <OrderCard key={order._id || order.id} order={order} showActions={true} />
            ))
          )}
        </div>
      </div>

      {/* Available orders section removed: drivers see only their assigned orders */}
    </div>
  )
}
