import React, { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api.js'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, unread, read
  const [typeFilter, setTypeFilter] = useState('all') // all, order_created, product_created, user_created
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [stats, setStats] = useState({})

  async function loadNotifications(pageNum = 1, reset = false) {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pageNum,
        limit: 20,
        ...(filter !== 'all' && { unread: filter === 'unread' ? 'true' : 'false' }),
        ...(typeFilter !== 'all' && { type: typeFilter })
      })
      
      const response = await apiGet(`/api/notifications?${params}`)
      const newNotifications = response.notifications || []
      
      if (reset || pageNum === 1) {
        setNotifications(newNotifications)
      } else {
        setNotifications(prev => [...prev, ...newNotifications])
      }
      
      setHasMore(newNotifications.length === 20)
      setPage(pageNum)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const response = await apiGet('/api/notifications/stats')
      setStats(response.stats || {})
    } catch (error) {
      console.error('Failed to load notification stats:', error)
    }
  }

  async function markAsRead(notificationId) {
    try {
      await apiPatch(`/api/notifications/${notificationId}/read`)
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, read: true, readAt: new Date() } : n)
      )
      loadStats()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      await apiPatch('/api/notifications/read-all')
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true, readAt: new Date() }))
      )
      loadStats()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  async function deleteNotification(notificationId) {
    try {
      await apiDelete(`/api/notifications/${notificationId}`)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
      loadStats()
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  useEffect(() => {
    loadNotifications(1, true)
    loadStats()
  }, [filter, typeFilter])

  function formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'order_created': return '🧾'
      case 'product_created': return '🏷️'
      case 'user_created': return '👥'
      default: return '🔔'
    }
  }

  function getTypeLabel(type) {
    switch (type) {
      case 'order_created': return 'Order'
      case 'product_created': return 'Product'
      case 'user_created': return 'User'
      default: return 'Notification'
    }
  }

  const unreadCount = stats.find?.(s => s._id === false)?.count || 0

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Notifications</div>
          <div className="page-subtitle">
            Stay updated with all activities and logs
            {unreadCount > 0 && (
              <span className="badge" style={{ marginLeft: 8, background: '#ef4444', color: 'white' }}>
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="btn secondary" onClick={markAllAsRead}>
            Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Status:</span>
            <select 
              className="input" 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              style={{ minWidth: 120 }}
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Type:</span>
            <select 
              className="input" 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <option value="all">All Types</option>
              <option value="order_created">Orders</option>
              <option value="product_created">Products</option>
              <option value="user_created">Users</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card">
        {loading && notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>No notifications found</div>
            <div>You're all caught up! New activities will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 1 }}>
            {notifications.map((notification, index) => (
              <div
                key={notification._id}
                className={`notification-item ${!notification.read ? 'unread' : ''}`}
                style={{
                  padding: 16,
                  borderBottom: index < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                  background: !notification.read ? 'var(--panel-2)' : 'transparent',
                  borderLeft: !notification.read ? '3px solid var(--primary)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => !notification.read && markAsRead(notification._id)}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className="badge" style={{ fontSize: 11 }}>
                        {getTypeLabel(notification.type)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {formatDate(notification.createdAt)}
                      </span>
                      {!notification.read && (
                        <div 
                          style={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            background: 'var(--primary)' 
                          }} 
                        />
                      )}
                    </div>
                    
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {notification.title}
                    </div>
                    
                    <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.4 }}>
                      {notification.message}
                    </div>
                    
                    {notification.triggeredByRole && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                        Triggered by {notification.triggeredByRole}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!notification.read && (
                      <button
                        className="btn secondary"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notification._id)
                        }}
                      >
                        Mark Read
                      </button>
                    )}
                    <button
                      className="btn danger"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this notification?')) {
                          deleteNotification(notification._id)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Load More Button */}
        {hasMore && notifications.length > 0 && (
          <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button 
              className="btn secondary" 
              onClick={() => loadNotifications(page + 1)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}