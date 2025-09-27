import React, { useEffect, useState, useRef } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'

export default function DriverPanel() {
  const toast = useToast()
  const [assigned, setAssigned] = useState([])
  const [loading, setLoading] = useState(false)
  const [city, setCity] = useState(() => {
    try { return localStorage.getItem('driver.city') || '' } catch { return '' }
  })
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('driver.sortBy') || 'nearest' } catch { return 'nearest' }
  }) // nearest, farthest, newest, oldest
  const [driverLocation, setDriverLocation] = useState(null)
  // Remittance state
  const [managers, setManagers] = useState([])
  const [remForm, setRemForm] = useState({ managerId:'', amount:'', fromDate:'', toDate:'', note:'' })
  const [remLoading, setRemLoading] = useState(false)
  const [remittances, setRemittances] = useState([])
  const [remSummary, setRemSummary] = useState({ totalDeliveredOrders: 0, totalCollectedAmount: 0, currency: '' })

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

  // --- Remittance helpers ---
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
    // Load managers and remittances initially
    try{ loadManagers(); loadRemittances(); loadRemittanceSummary({}) }catch{}
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
        transports: ['polling'],
        upgrade: false,
        withCredentials: true,
        auth: { token },
      })
      const refresh = () => { try { loadAssigned() } catch {} }
      socket.on('order.assigned', refresh)
      socket.on('order.updated', refresh)
      socket.on('remittance.accepted', ()=> { try{ loadRemittances() }catch{} })
    } catch {}
    return () => {
      try { socket && socket.off('order.assigned') } catch {}
      try { socket && socket.off('order.updated') } catch {}
      try { socket && socket.off('remittance.accepted') } catch {}
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
    const [status, setStatus] = useState(() => String(order?.shipmentStatus || '').toLowerCase()) // '', delivered, cancelled, no_response
    const [note, setNote] = useState('')
    const [amount, setAmount] = useState('')
    const [saving, setSaving] = useState(false)
    const [claiming] = useState(false)
    const [expanded, setExpanded] = useState(false) // top customer reveal
    const touchStartYRef = useRef(null)
    const [detailsExpanded, setDetailsExpanded] = useState(false) // bottom details sheet (initially closed)
    const detailsTouchStartYRef = useRef(null)

    // Keep local status in sync with live order updates
    useEffect(() => {
      try{ setStatus(String(order?.shipmentStatus || '').toLowerCase()) }catch{}
    }, [order?.shipmentStatus])

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
          toast.success(`Order delivered (#${String(id).slice(-6)})`)
        } else if (status === 'cancelled') {
          await apiPost(`/api/orders/${id}/cancel`, { reason: note || '' })
          toast.warn(`Order cancelled (#${String(id).slice(-6)})`)
        } else if (status === 'no_response' || status === 'attempted' || status === 'contacted' || status === 'picked_up') {
          await apiPost(`/api/orders/${id}/shipment/update`, { shipmentStatus: status, deliveryNotes: note || '' })
          const label = status === 'picked_up' ? 'picked up' : (status.replace('_',' '))
          toast.info(`Shipment ${label} (#${String(id).slice(-6)})`)
        }
        await loadAssigned()
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
                  <span title="Open in Maps" style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', color:'#2563eb'}} onClick={()=> openMaps(order)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20.84 10.61C20.84 16 12 22 12 22S3.16 16 3.16 10.61a8.84 8.84 0 1 1 17.68 0Z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
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
            <button className="inline-icon-btn map light" onClick={()=> openMaps(order)} title="Open Map" aria-label="Open Map" style={{width:44, height:44, borderRadius:12}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20.84 10.61C20.84 16 12 22 12 22S3.16 16 3.16 10.61a8.84 8.84 0 1 1 17.68 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </button>
            <button className="inline-icon-btn call light" onClick={()=> callPhone(order.customerPhone)} title="Call" aria-label="Call" style={{width:44, height:44, borderRadius:12}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
            </button>
            <button className="inline-icon-btn sms light" onClick={()=> openSMS(order.customerPhone)} title="SMS" aria-label="SMS" style={{width:44, height:44, borderRadius:12}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
                <text x="12" y="13" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">SMS</text>
              </svg>
            </button>
            <button className="inline-icon-btn wa light" onClick={()=> openWhatsApp(order.customerPhone)} title="WhatsApp" aria-label="WhatsApp" style={{width:44, height:44, borderRadius:12}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.52 3.48A11.82 11.82 0 0 0 .155 18.07L0 24l5.93-1.56A11.82 11.82 0 0 0 12.02 24c6.56 0 11.87-5.31 11.87-11.87 0-3.18-1.24-6.16-3.37-8.39zm-8.5 19.33c-1.95 0-3.85-.51-5.52-1.47l-.4-.24-3.51.93.94-3.43-.26-.42a9.7 9.7 0 0 1-1.47-5.17c0-5.38 4.37-9.75 9.75-9.75 2.61 0 5.06 1.02 6.91 2.87a9.65 9.65 0 0 1 2.84 6.88c0 5.38-4.37 9.75-9.75 9.75zm5.74-7.3c-.31-.16-1.82-.91-2.1-1.02-.28-.1-.48-.16-.68.16-.2.3-.78.96-.96 1.16-.18.2-.36.22-.66.08-.3-.14-1.29-.47-2.46-1.49-.91-.81-1.53-1.8-1.71-2.1-.18-.3-.02-.46.14-.62.14-.14.3-.36.46-.56.15-.2.2-.3.3-.5.1-.2.05-.38-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.64-.52-.55-.72-.56-.18-.01-.4-.02-.61-.02-.21 0-.56.08-.86.38-.3.3-1.13 1.1-1.13 2.68 0 1.58 1.12 3.1 1.28 3.31.16.2 2.22 3.4 5.35 4.76.75.33 1.34.53 1.8.68.76.24 1.45.21 2.01.13.61-.09 1.87-.77 2.13-1.52.26-.75.26-1.36.18-1.56-.08-.2-.29-.31-.6-.47z"/>
              </svg>
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
  const activeOrders = React.useMemo(()=>{
    const list = sortedAssigned || []
    return list.filter(o => !['delivered','cancelled','returned'].includes(String(o?.shipmentStatus||'').toLowerCase()))
  }, [sortedAssigned])
  const historyOrders = React.useMemo(()=>{
    const list = sortedAssigned || []
    return list.filter(o => ['delivered','cancelled'].includes(String(o?.shipmentStatus||'').toLowerCase()))
  }, [sortedAssigned])

  return (
    <div className="driver-panel">
      <div className="panel-header">
        <h1 className="panel-title">Driver Panel</h1>
        <p className="panel-subtitle">Manage your delivery orders efficiently</p>
      </div>

      {/* Remittance to Manager */}
      <div className="orders-section">
        <div className="section-header">
          <h2 className="section-title">Send Amount to Manager</h2>
        </div>
        <div className="card" style={{display:'grid', gap:10}}>
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
        <div className="card" style={{marginTop:10}}>
          <div className="card-header"><div className="card-title">My Remittances</div></div>
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
      </div>

      <div className="orders-section">
        <div className="section-header">
          <h2 className="section-title">My Assigned Orders</h2>
          <span className="order-count">{activeOrders.length}</span>
        </div>

        <div className="orders-list">
          {loading ? (
            <div className="loading-state">Loading assigned orders...</div>
          ) : activeOrders.length === 0 ? (
            <div className="empty-state">No assigned orders</div>
          ) : (
            activeOrders.map((order) => (
              <OrderCard key={order._id || order.id} order={order} showActions={true} />
            ))
          )}
        </div>
      </div>

      {/* Order History */}
      <div className="orders-section" style={{marginTop:16}}>
        <div className="section-header">
          <h2 className="section-title">Order History</h2>
          <span className="order-count">{historyOrders.length}</span>
        </div>
        <div className="orders-list">
          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : historyOrders.length === 0 ? (
            <div className="empty-state">No delivered or cancelled orders</div>
          ) : (
            historyOrders.slice(0, 20).map((order) => (
              <OrderCard key={order._id || order.id} order={order} showActions={false} />
            ))
          )}
        </div>
      </div>

      {/* Available orders section removed: drivers see only their assigned orders */}
    </div>
  )
}
