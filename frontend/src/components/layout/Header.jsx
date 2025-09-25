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

  return (
    <header className="ecommerce-header">
      <div className="header-container">
        <div className="header-left">
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
            <button className="search-btn">
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

      <style jsx>{`
        .ecommerce-header {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 100;
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
        }

        .nav-link:hover {
          color: #007bff;
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
          padding: 8px;
          cursor: pointer;
          border-radius: 6px;
          color: #6b7280;
          transition: all 0.2s;
          position: relative;
        }

        .search-btn:hover,
        .cart-btn:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .cart-count {
          position: absolute;
          top: -2px;
          right: -2px;
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
        }

        .auth-buttons {
          display: flex;
          gap: 12px;
          margin-left: 8px;
        }

        .login-btn,
        .register-btn {
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
        }

        .login-btn {
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .login-btn:hover {
          background: #f9fafb;
        }

        .register-btn {
          background: #007bff;
          color: white;
          border: 1px solid #007bff;
        }

        .register-btn:hover {
          background: #0056b3;
          border-color: #0056b3;
        }

        @media (max-width: 768px) {
          .header-container {
            padding: 0 16px;
            height: 60px;
          }

          .header-center {
            display: none;
          }

          .auth-buttons {
            display: none;
          }

          .header-actions {
            gap: 12px;
          }
        }
      `}</style>
    </header>
  )
}