import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'

export default function DriverPanel() {
  const [assigned, setAssigned] = useState([])
  const [available, setAvailable] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [city, setCity] = useState('')
  const [sortBy, setSortBy] = useState('nearest') // nearest, farthest, newest, oldest
  const [driverLocation, setDriverLocation] = useState(null)

  // Get driver's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.log('Location access denied:', error)
        }
      )
    }
  }, [])

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

  async function loadAvailable() {
    setLoadingAvail(true)
    try {
      const q = city ? `?city=${encodeURIComponent(city)}` : ''
      const data = await apiGet(`/api/orders/driver/available${q}`)
      setAvailable(data.orders || [])
    } catch {
      setAvailable([])
    } finally {
      setLoadingAvail(false)
    }
  }

  useEffect(() => { loadAssigned() }, [])
  useEffect(() => { loadAvailable() }, [city])

  // Real-time updates
  useEffect(() => {
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token }
      })
      const onAssigned = () => { try { loadAssigned(); loadAvailable() } catch {} }
      const onUpdated = () => { try { loadAssigned() } catch {} }
      socket.on('order.assigned', onAssigned)
      socket.on('order.updated', onUpdated)
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
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
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
    const ordersWithDistance = orders.map(order => ({
      ...order,
      distance: getOrderDistance(order)
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

  function fmtPrice(o) {
    try {
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
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(addr)}`, '_blank', 'noopener,noreferrer')
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
      await loadAvailable()
    } catch (e) {
      alert(e?.message || 'Failed to cancel order')
    }
  }

  const OrderCard = ({ order, showActions = false }) => {
    const distance = getOrderDistance(order)
    
    return (
      <div className="driver-order-card">
        <div className="order-header">
          <div className="order-id">Order #{order._id?.slice(-6) || 'N/A'}</div>
          <div className="order-status">{order.shipmentStatus || order.status || 'Pending'}</div>
        </div>
        
        <div className="order-content">
          <div className="customer-section">
            <h3 className="section-title">Customer Information</h3>
            <div className="customer-info">
              <div className="info-row">
                <span className="label">Phone:</span>
                <div className="contact-actions">
                  <span className="phone-number">{order.customerPhone}</span>
                  <button 
                    className="contact-btn call-btn" 
                    onClick={() => callPhone(order.customerPhone)}
                    title="Call customer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                  </button>
                  <button 
                    className="contact-btn whatsapp-btn" 
                    onClick={() => openWhatsApp(order.customerPhone)}
                    title="WhatsApp customer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.63z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="info-row">
                <span className="label">Location:</span>
                <div className="location-info">
                  <span className="location-text">
                    {order.customerAddress || order.customerLocation || 'No address provided'}
                  </span>
                  <button 
                    className="contact-btn map-btn" 
                    onClick={() => openMaps(order)}
                    title="Open in maps"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              {distance !== null && (
                <div className="info-row">
                  <span className="label">Distance:</span>
                  <span className="distance-badge">{formatDistance(distance)}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="order-details-section">
            <h3 className="section-title">Order Details</h3>
            <div className="order-details">
              <div className="info-row">
                <span className="label">Product:</span>
                <span className="value">{order.details || 'No details provided'}</span>
              </div>
              <div className="info-row">
                <span className="label">Quantity:</span>
                <span className="value">{order.quantity || 1}</span>
              </div>
              <div className="info-row">
                <span className="label">Price:</span>
                <span className="value price">{fmtPrice(order)}</span>
              </div>
              <div className="info-row">
                <span className="label">City:</span>
                <span className="value">{order.city || 'Not specified'}</span>
              </div>
              <div className="info-row">
                <span className="label">Country:</span>
                <span className="value">{order.orderCountry || 'Not specified'}</span>
              </div>
              <div className="info-row">
                <span className="label">Created:</span>
                <span className="value">{fmtDate(order.createdAt)}</span>
              </div>
            </div>
          </div>
          
          {showActions && (
            <div className="order-actions">
              <button 
                className="action-btn deliver-btn" 
                onClick={() => deliverOrder(order)}
              >
                ✓ Mark Delivered
              </button>
              <button 
                className="action-btn cancel-btn" 
                onClick={() => cancelOrder(order)}
              >
                ✕ Cancel Order
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const sortedAvailable = sortOrders(available)
  const sortedAssigned = sortOrders(assigned)

  return (
    <div className="driver-panel">
      <div className="panel-header">
        <h1 className="panel-title">Driver Panel</h1>
        <p className="panel-subtitle">Manage your delivery orders efficiently</p>
      </div>
      
      <div className="panel-controls">
        <div className="filter-section">
          <input 
            className="city-filter" 
            placeholder="Filter by city..." 
            value={city} 
            onChange={e => setCity(e.target.value)}
          />
        </div>
        
        <div className="sort-section">
          <select 
            className="sort-select" 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="nearest">Nearest First</option>
            <option value="farthest">Farthest First</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
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
            sortedAssigned.map(order => (
              <OrderCard key={order._id || order.id} order={order} showActions={true} />
            ))
          )}
        </div>
      </div>
      
      <div className="orders-section">
        <div className="section-header">
          <h2 className="section-title">Available Orders</h2>
          <span className="order-count">{available.length}</span>
        </div>
        
        <div className="orders-list">
          {loadingAvail ? (
            <div className="loading-state">Loading available orders...</div>
          ) : sortedAvailable.length === 0 ? (
            <div className="empty-state">No available orders</div>
          ) : (
            sortedAvailable.map(order => (
              <OrderCard key={order._id || order.id} order={order} showActions={false} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}