import React, { useState, useEffect } from 'react'

const getCartItemCount = () => {
  try {
    const savedCart = localStorage.getItem('shopping_cart')
    if (!savedCart) return 0
    
    const cartItems = JSON.parse(savedCart)
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  } catch (error) {
    console.error('Error loading cart count:', error)
    return 0
  }
}

export default function Header({ onCartClick }) {
  const [cartCount, setCartCount] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    // Initial cart count load
    setCartCount(getCartItemCount())

    // Listen for cart updates
    const handleCartUpdate = () => {
      setCartCount(getCartItemCount())
    }

    window.addEventListener('cartUpdated', handleCartUpdate)
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate)
    }
  }, [])

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen)
  }

  return (
    <header className="ecommerce-header">
      <div className="header-container">
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <a href="/" className="logo">
            <img src="/BuySial2.png" alt="BuySial" className="logo-img" />
          </a>
        </div>

        <div className="header-center">
          <nav className="main-nav">
            <a href="/" className="nav-link">Home</a>
            <a href="/products" className="nav-link">Products</a>
            <a href="/categories" className="nav-link">Categories</a>
            <a href="/about" className="nav-link">About</a>
            <a href="/contact" className="nav-link">Contact</a>
          </nav>
        </div>

        <div className="header-right">
          <div className="header-actions">
            <button className="search-btn" onClick={toggleSearch}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </button>

            <button className="cart-btn" onClick={onCartClick}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 22C9.55228 22 10 21.5523 10 21C10 20.4477 9.55228 20 9 20C8.44772 20 8 20.4477 8 21C8 21.5523 8.44772 22 9 22Z"></path>
                <path d="M20 22C20.5523 22 21 21.5523 21 21C21 20.4477 20.5523 20 20 20C19.4477 20 19 20.4477 19 21C19 21.5523 19.4477 22 20 22Z"></path>
                <path d="M1 1H5L7.68 14.39C7.77144 14.8504 8.02191 15.264 8.38755 15.5583C8.75318 15.8526 9.2107 16.009 9.68 16H19.4C19.8693 16.009 20.3268 15.8526 20.6925 15.5583C21.0581 15.264 21.3086 14.8504 21.4 14.39L23 6H6"></path>
              </svg>
              {cartCount > 0 && (
                <span className="cart-count">{cartCount}</span>
              )}
            </button>

            <div className="auth-buttons">
              <a href="/login" className="login-btn">Login</a>
              <a href="/register" className="register-btn">Sign Up</a>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {isSearchOpen && (
        <div className="mobile-search">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search products..." 
              className="search-input"
              autoFocus
            />
            <button className="search-close-btn" onClick={toggleSearch}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-menu">
          <div className="mobile-menu-overlay" onClick={toggleMobileMenu}></div>
          <div className="mobile-menu-content">
            <div className="mobile-menu-header">
              <img src="/BuySial2.png" alt="BuySial" className="mobile-logo" />
              <button className="mobile-menu-close" onClick={toggleMobileMenu}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <nav className="mobile-nav">
              <a href="/" className="mobile-nav-link" onClick={toggleMobileMenu}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9,22 9,12 15,12 15,22"></polyline>
                </svg>
                Home
              </a>
              <a href="/products" className="mobile-nav-link" onClick={toggleMobileMenu}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                Products
              </a>
              <a href="/categories" className="mobile-nav-link" onClick={toggleMobileMenu}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                Categories
              </a>
              <a href="/about" className="mobile-nav-link" onClick={toggleMobileMenu}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                About
              </a>
              <a href="/contact" className="mobile-nav-link" onClick={toggleMobileMenu}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Contact
              </a>
            </nav>
            <div className="mobile-auth">
              <a href="/login" className="mobile-login-btn" onClick={toggleMobileMenu}>Login</a>
              <a href="/register" className="mobile-register-btn" onClick={toggleMobileMenu}>Sign Up</a>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ecommerce-header {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 70px;
        }

        .header-left {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          color: #6b7280;
          transition: all 0.2s;
        }

        .mobile-menu-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .logo {
          display: flex;
          align-items: center;
          text-decoration: none;
        }

        .logo-img {
          height: 40px;
          width: auto;
        }

        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .main-nav {
          display: flex;
          gap: 32px;
        }

        .nav-link {
          text-decoration: none;
          color: #374151;
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s;
          position: relative;
        }

        .nav-link:hover {
          color: #007bff;
        }

        .nav-link:hover::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 0;
          right: 0;
          height: 2px;
          background: #007bff;
          border-radius: 1px;
        }

        .header-right {
          flex-shrink: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .search-btn,
        .cart-btn {
          background: none;
          border: none;
          padding: 10px;
          cursor: pointer;
          border-radius: 8px;
          color: #6b7280;
          transition: all 0.2s;
          position: relative;
        }

        .search-btn:hover,
        .cart-btn:hover {
          background: #f3f4f6;
          color: #374151;
          transform: translateY(-1px);
        }

        .cart-count {
          position: absolute;
          top: 2px;
          right: 2px;
          background: #dc2626;
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: bounce 0.3s ease;
        }

        @keyframes bounce {
          0%, 20%, 60%, 100% { transform: translateY(0); }
          40% { transform: translateY(-3px); }
          80% { transform: translateY(-1px); }
        }

        .auth-buttons {
          display: flex;
          gap: 12px;
          margin-left: 8px;
        }

        .login-btn,
        .register-btn {
          text-decoration: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
        }

        .login-btn {
          color: #374151;
          border: 1px solid #d1d5db;
          background: white;
        }

        .login-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
          transform: translateY(-1px);
        }

        .register-btn {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
          color: white;
          border: 1px solid #007bff;
        }

        .register-btn:hover {
          background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
          border-color: #0056b3;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        }

        /* Mobile Search */
        .mobile-search {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 16px 20px;
        }

        .search-container {
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .search-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 16px;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .search-close-btn {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          color: #6b7280;
          transition: all 0.2s;
        }

        .search-close-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        /* Mobile Menu */
        .mobile-menu {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
        }

        .mobile-menu-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }

        .mobile-menu-content {
          position: absolute;
          top: 0;
          left: 0;
          width: 280px;
          height: 100%;
          background: white;
          box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }

        .mobile-menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .mobile-logo {
          height: 32px;
          width: auto;
        }

        .mobile-menu-close {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          color: #6b7280;
          transition: all 0.2s;
        }

        .mobile-menu-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .mobile-nav {
          flex: 1;
          padding: 20px 0;
        }

        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          text-decoration: none;
          color: #374151;
          font-weight: 500;
          transition: all 0.2s;
        }

        .mobile-nav-link:hover {
          background: #f8fafc;
          color: #007bff;
        }

        .mobile-auth {
          padding: 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mobile-login-btn,
        .mobile-register-btn {
          text-decoration: none;
          padding: 12px 16px;
          border-radius: 8px;
          font-weight: 500;
          text-align: center;
          transition: all 0.2s;
        }

        .mobile-login-btn {
          color: #374151;
          border: 1px solid #d1d5db;
          background: white;
        }

        .mobile-login-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .mobile-register-btn {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
          color: white;
          border: 1px solid #007bff;
        }

        .mobile-register-btn:hover {
          background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
          border-color: #0056b3;
        }

        @media (max-width: 768px) {
          .header-container {
            padding: 0 16px;
            height: 60px;
          }

          .mobile-menu-btn {
            display: block;
          }

          .header-center {
            display: none;
          }

          .auth-buttons {
            display: none;
          }

          .header-actions {
            gap: 8px;
          }

          .search-btn,
          .cart-btn {
            padding: 8px;
          }
        }

        @media (max-width: 480px) {
          .header-container {
            padding: 0 12px;
          }

          .mobile-menu-content {
            width: 100vw;
          }
        }
      `}</style>
    </header>
  )
}