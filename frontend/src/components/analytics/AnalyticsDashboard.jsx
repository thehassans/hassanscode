import React, { useState, useEffect } from 'react'
import analytics from '../../utils/analytics'
import BusinessReports from './BusinessReports'

const AnalyticsDashboard = () => {
  const [events, setEvents] = useState([])
  const [sessionSummary, setSessionSummary] = useState(null)
  const [stats, setStats] = useState({
    totalEvents: 0,
    pageViews: 0,
    productViews: 0,
    addToCartEvents: 0,
    searches: 0,
    checkouts: 0
  })
  const [activeView, setActiveView] = useState('dashboard') // 'dashboard' or 'reports'

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = () => {
    const allEvents = analytics.getAllEvents()
    const summary = analytics.getSessionSummary()
    
    setEvents(allEvents.slice(-50)) // Show last 50 events
    setSessionSummary(summary)
    
    // Calculate stats
    const stats = {
      totalEvents: allEvents.length,
      pageViews: allEvents.filter(e => e.event_name === 'page_view').length,
      productViews: allEvents.filter(e => e.event_name === 'product_view').length,
      addToCartEvents: allEvents.filter(e => e.event_name === 'add_to_cart').length,
      searches: allEvents.filter(e => e.event_name === 'search').length,
      checkouts: allEvents.filter(e => e.event_name === 'checkout_complete').length
    }
    
    setStats(stats)
  }

  const clearAnalytics = () => {
    analytics.clearEvents()
    loadAnalyticsData()
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  // If business reports view is active, render the BusinessReports component
  if (activeView === 'reports') {
    return <BusinessReports />
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeView === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 Analytics
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeView === 'reports'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📈 Business Reports
          </button>
          <button
            onClick={clearAnalytics}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            Clear Analytics
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Total Events</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Page Views</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.pageViews}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Product Views</h3>
          <p className="text-2xl font-bold text-green-600">{stats.productViews}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Add to Cart</h3>
          <p className="text-2xl font-bold text-orange-600">{stats.addToCartEvents}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Searches</h3>
          <p className="text-2xl font-bold text-purple-600">{stats.searches}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <h3 className="text-sm font-medium text-gray-500">Checkouts</h3>
          <p className="text-2xl font-bold text-red-600">{stats.checkouts}</p>
        </div>
      </div>

      {/* Session Summary */}
      {sessionSummary && (
        <div className="bg-white p-6 rounded-lg shadow border mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Current Session</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Session ID</h3>
              <p className="text-sm text-gray-900 font-mono">{sessionSummary.session_id}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Duration</h3>
              <p className="text-sm text-gray-900">{formatDuration(sessionSummary.duration)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Events</h3>
              <p className="text-sm text-gray-900">{sessionSummary.event_count}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Page Views</h3>
              <p className="text-sm text-gray-900">{sessionSummary.page_views}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Recent Events (Last 50)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      event.event_name === 'page_view' ? 'bg-blue-100 text-blue-800' :
                      event.event_name === 'product_view' ? 'bg-green-100 text-green-800' :
                      event.event_name === 'add_to_cart' ? 'bg-orange-100 text-orange-800' :
                      event.event_name === 'search' ? 'bg-purple-100 text-purple-800' :
                      event.event_name === 'checkout_complete' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.event_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {event.event_name === 'page_view' && (
                      <span>{event.properties.page} - {event.properties.title}</span>
                    )}
                    {event.event_name === 'product_view' && (
                      <span>{event.properties.product_name} (${event.properties.price})</span>
                    )}
                    {event.event_name === 'add_to_cart' && (
                      <span>{event.properties.product_name} x{event.properties.quantity}</span>
                    )}
                    {event.event_name === 'search' && (
                      <span>"{event.properties.query}" ({event.properties.results_count} results)</span>
                    )}
                    {event.event_name === 'checkout_complete' && (
                      <span>Order {event.properties.order_id} - ${event.properties.cart_value}</span>
                    )}
                    {event.event_name === 'filter_usage' && (
                      <span>{event.properties.filter_type}: {event.properties.filter_value}</span>
                    )}
                    {event.event_name === 'sort_usage' && (
                      <span>Sort by: {event.properties.sort_by}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {event.user_id.substring(0, 12)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No analytics events recorded yet. Start browsing the e-commerce site to see data here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard