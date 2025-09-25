// Analytics utility for tracking user behavior and product interactions
class Analytics {
  constructor() {
    this.events = []
    this.sessionId = this.generateSessionId()
    this.userId = this.getUserId()
    this.startTime = Date.now()
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  getUserId() {
    let userId = localStorage.getItem('analytics_user_id')
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      localStorage.setItem('analytics_user_id', userId)
    }
    return userId
  }

  // Track page views
  trackPageView(page, title = '') {
    this.trackEvent('page_view', {
      page,
      title,
      timestamp: Date.now(),
      url: window.location.href
    })
  }

  // Track product views
  trackProductView(productId, productName, category, price) {
    this.trackEvent('product_view', {
      product_id: productId,
      product_name: productName,
      category,
      price,
      timestamp: Date.now()
    })
  }

  // Track add to cart events
  trackAddToCart(productId, productName, price, quantity = 1) {
    this.trackEvent('add_to_cart', {
      product_id: productId,
      product_name: productName,
      price,
      quantity,
      timestamp: Date.now()
    })
  }

  // Track remove from cart events
  trackRemoveFromCart(productId, productName, quantity = 1) {
    this.trackEvent('remove_from_cart', {
      product_id: productId,
      product_name: productName,
      quantity,
      timestamp: Date.now()
    })
  }

  // Track search events
  trackSearch(query, resultsCount = 0) {
    this.trackEvent('search', {
      query,
      results_count: resultsCount,
      timestamp: Date.now()
    })
  }

  // Track checkout events
  trackCheckoutStart(cartValue, itemCount) {
    this.trackEvent('checkout_start', {
      cart_value: cartValue,
      item_count: itemCount,
      timestamp: Date.now()
    })
  }

  trackCheckoutComplete(orderId, cartValue, itemCount, paymentMethod) {
    this.trackEvent('checkout_complete', {
      order_id: orderId,
      cart_value: cartValue,
      item_count: itemCount,
      payment_method: paymentMethod,
      timestamp: Date.now()
    })
  }

  // Track filter usage
  trackFilterUsage(filterType, filterValue) {
    this.trackEvent('filter_usage', {
      filter_type: filterType,
      filter_value: filterValue,
      timestamp: Date.now()
    })
  }

  // Track sort usage
  trackSortUsage(sortBy) {
    this.trackEvent('sort_usage', {
      sort_by: sortBy,
      timestamp: Date.now()
    })
  }

  // Generic event tracking
  trackEvent(eventName, properties = {}) {
    const event = {
      event_name: eventName,
      session_id: this.sessionId,
      user_id: this.userId,
      timestamp: Date.now(),
      properties: {
        ...properties,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        referrer: document.referrer,
        language: navigator.language
      }
    }

    this.events.push(event)
    
    // Store events in localStorage for persistence
    this.saveEventsToStorage()
    
    // Send to analytics service (if configured)
    this.sendToAnalyticsService(event)
    
    console.log('Analytics Event:', event)
  }

  // Save events to localStorage
  saveEventsToStorage() {
    try {
      const existingEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]')
      const allEvents = [...existingEvents, ...this.events]
      
      // Keep only last 1000 events to prevent storage overflow
      const recentEvents = allEvents.slice(-1000)
      
      localStorage.setItem('analytics_events', JSON.stringify(recentEvents))
      this.events = [] // Clear current events after saving
    } catch (error) {
      console.error('Error saving analytics events:', error)
    }
  }

  // Send events to analytics service (placeholder for future integration)
  sendToAnalyticsService(event) {
    // This is where you would send events to your analytics service
    // Examples: Google Analytics, Mixpanel, Amplitude, etc.
    
    // For now, we'll just log to console
    // In production, you might want to batch events and send them periodically
    
    if (window.gtag) {
      // Google Analytics 4 example
      window.gtag('event', event.event_name, event.properties)
    }
    
    // You could also send to your own analytics endpoint
    // fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event)
    // }).catch(console.error)
  }

  // Get all stored events
  getAllEvents() {
    try {
      return JSON.parse(localStorage.getItem('analytics_events') || '[]')
    } catch (error) {
      console.error('Error retrieving analytics events:', error)
      return []
    }
  }

  // Clear all stored events
  clearEvents() {
    localStorage.removeItem('analytics_events')
    this.events = []
  }

  // Get session summary
  getSessionSummary() {
    const events = this.getAllEvents()
    const sessionEvents = events.filter(event => event.session_id === this.sessionId)
    
    return {
      session_id: this.sessionId,
      user_id: this.userId,
      start_time: this.startTime,
      duration: Date.now() - this.startTime,
      event_count: sessionEvents.length,
      page_views: sessionEvents.filter(e => e.event_name === 'page_view').length,
      product_views: sessionEvents.filter(e => e.event_name === 'product_view').length,
      add_to_cart_events: sessionEvents.filter(e => e.event_name === 'add_to_cart').length,
      searches: sessionEvents.filter(e => e.event_name === 'search').length
    }
  }
}

// Create and export a singleton instance
const analytics = new Analytics()

export default analytics

// Export individual tracking functions for convenience
export const trackPageView = (page, title) => analytics.trackPageView(page, title)
export const trackProductView = (productId, productName, category, price) => 
  analytics.trackProductView(productId, productName, category, price)
export const trackAddToCart = (productId, productName, price, quantity) => 
  analytics.trackAddToCart(productId, productName, price, quantity)
export const trackRemoveFromCart = (productId, productName, quantity) => 
  analytics.trackRemoveFromCart(productId, productName, quantity)
export const trackSearch = (query, resultsCount) => analytics.trackSearch(query, resultsCount)
export const trackCheckoutStart = (cartValue, itemCount) => analytics.trackCheckoutStart(cartValue, itemCount)
export const trackCheckoutComplete = (orderId, cartValue, itemCount, paymentMethod) => 
  analytics.trackCheckoutComplete(orderId, cartValue, itemCount, paymentMethod)
export const trackFilterUsage = (filterType, filterValue) => analytics.trackFilterUsage(filterType, filterValue)
export const trackSortUsage = (sortBy) => analytics.trackSortUsage(sortBy)