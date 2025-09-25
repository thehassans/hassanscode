import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast'
import { trackRemoveFromCart, trackCheckoutStart } from '../../utils/analytics'

export default function ShoppingCart({ isOpen, onClose }) {
  const [cartItems, setCartItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  // Load cart from localStorage on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem('shopping_cart')
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
      } catch (error) {
        console.error('Error loading cart from localStorage:', error)
      }
    }
  }, [])

  // Save cart to localStorage whenever cartItems changes
  useEffect(() => {
    localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
  }, [cartItems])

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    )
  }

  const removeFromCart = (productId) => {
    // Find the removed item for tracking
    const removedItem = cartItems.find(item => item.id === productId)
    if (removedItem) {
      trackRemoveFromCart(removedItem.id, removedItem.name, removedItem.quantity)
    }
    
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId))
    
    // Dispatch custom event to update cart count in header
    window.dispatchEvent(new CustomEvent('cartUpdated'))
    
    toast.success('Item removed from cart')
  }

  const clearCart = () => {
    setCartItems([])
    toast.success('Cart cleared')
  }

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty')
      return
    }

    // Track checkout start
    const cartValue = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
    const itemCount = cartItems.reduce((total, item) => total + item.quantity, 0)
    trackCheckoutStart(cartValue, itemCount)

    navigate('/checkout')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="cart-header">
          <h2>Shopping Cart ({getTotalItems()} items)</h2>
          <button className="cart-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cart-content">
          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-cart-icon">🛒</div>
              <h3>Your cart is empty</h3>
              <p>Add some products to get started!</p>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-image">
                      <img 
                        src={item.imagePath || '/placeholder-product.jpg'} 
                        alt={item.name}
                        onError={(e) => {
                          e.target.src = '/placeholder-product.jpg'
                        }}
                      />
                    </div>
                    
                    <div className="cart-item-details">
                      <h4>{item.name}</h4>
                      <p className="cart-item-price">${item.price.toFixed(2)}</p>
                      
                      <div className="quantity-controls">
                        <button 
                          className="quantity-btn"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="quantity">{item.quantity}</span>
                        <button 
                          className="quantity-btn"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    
                    <div className="cart-item-actions">
                      <div className="item-total">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                      <button 
                        className="remove-btn"
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-footer">
                <div className="cart-total">
                  <div className="total-row">
                    <span>Subtotal:</span>
                    <span>${getTotalPrice().toFixed(2)}</span>
                  </div>
                  <div className="total-row total-final">
                    <span>Total:</span>
                    <span>${getTotalPrice().toFixed(2)}</span>
                  </div>
                </div>

                <div className="cart-actions">
                  <button 
                    className="clear-cart-btn"
                    onClick={clearCart}
                  >
                    Clear Cart
                  </button>
                  <button 
                    className="checkout-btn"
                    onClick={handleCheckout}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Checkout'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .cart-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
        }

        .cart-sidebar {
          background: white;
          width: 400px;
          max-width: 90vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
        }

        .cart-header {
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .cart-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .cart-close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cart-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .empty-cart {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-cart-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-cart h3 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .empty-cart p {
          margin: 0;
          color: #666;
        }

        .cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 0 20px;
        }

        .cart-item {
          display: flex;
          gap: 12px;
          padding: 16px 0;
          border-bottom: 1px solid #eee;
        }

        .cart-item-image {
          width: 60px;
          height: 60px;
          flex-shrink: 0;
        }

        .cart-item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 4px;
        }

        .cart-item-details {
          flex: 1;
          min-width: 0;
        }

        .cart-item-details h4 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.3;
        }

        .cart-item-price {
          margin: 0 0 8px 0;
          color: #666;
          font-size: 13px;
        }

        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .quantity-btn {
          width: 24px;
          height: 24px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border-radius: 2px;
        }

        .quantity-btn:hover {
          background: #f5f5f5;
        }

        .quantity {
          min-width: 20px;
          text-align: center;
          font-size: 14px;
        }

        .cart-item-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .item-total {
          font-weight: 600;
          font-size: 14px;
        }

        .remove-btn {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          font-size: 12px;
          text-decoration: underline;
        }

        .remove-btn:hover {
          color: #c82333;
        }

        .cart-footer {
          border-top: 1px solid #eee;
          padding: 20px;
        }

        .cart-total {
          margin-bottom: 16px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .total-final {
          font-weight: 600;
          font-size: 16px;
          padding-top: 8px;
          border-top: 1px solid #eee;
        }

        .cart-actions {
          display: flex;
          gap: 12px;
        }

        .clear-cart-btn {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
        }

        .clear-cart-btn:hover {
          background: #f5f5f5;
        }

        .checkout-btn {
          flex: 2;
          padding: 12px;
          background: #007bff;
          color: white;
          border: none;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }

        .checkout-btn:hover {
          background: #0056b3;
        }

        .checkout-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .cart-sidebar {
            width: 100vw;
          }
        }
      `}</style>
    </div>
  )
}