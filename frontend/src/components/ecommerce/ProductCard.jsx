import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast'
import { trackProductView, trackAddToCart } from '../../utils/analytics'

export default function ProductCard({ product, onAddToCart }) {
  const navigate = useNavigate()

  const handleProductClick = () => {
    // Track product view
    trackProductView(product._id, product.name, product.category, product.price)
    navigate(`/product/${product._id}`)
  }

  const formatPrice = (price, currency = 'SAR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(price)
  }

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '/placeholder-product.jpg'
    return imagePath.startsWith('http') ? imagePath : `${import.meta.env.VITE_API_BASE || 'http://localhost:3000'}${imagePath}`
  }

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="text-yellow-400">★</span>)
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="text-yellow-400">☆</span>)
    }
    
    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="text-gray-300">☆</span>)
    }
    
    return stars
  }

  const handleAddToCart = (e) => {
    e.stopPropagation() // Prevent navigation when clicking add to cart
    
    try {
      const savedCart = localStorage.getItem('shopping_cart')
      let cartItems = []
      
      if (savedCart) {
        cartItems = JSON.parse(savedCart)
      }

      const existingItemIndex = cartItems.findIndex(item => item.id === product._id)
      
      if (existingItemIndex > -1) {
        // Item already exists, increase quantity
        cartItems[existingItemIndex].quantity += 1
      } else {
        // Add new item to cart
        cartItems.push({
          id: product._id,
          name: product.name,
          price: product.price,
          currency: product.baseCurrency || 'SAR',
          image: product.images?.[0] || '',
          quantity: 1,
          maxStock: product.stockQty
        })
      }
      
      // Save updated cart to localStorage
      localStorage.setItem('shopping_cart', JSON.stringify(cartItems))
      
      // Track add to cart event
      trackAddToCart(product._id, product.name, product.price, 1)
      
      // Dispatch custom event to update cart count in header
      window.dispatchEvent(new CustomEvent('cartUpdated'))
      
      // Show success message
      console.log('Added to cart:', product.name)
    } catch (error) {
      console.error('Error adding to cart:', error)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
         onClick={handleProductClick}>
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={getImageUrl(product.images?.[0])}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.src = '/placeholder-product.jpg'
          }}
        />
        {product.discount && product.discount > 0 && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-red-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg">
            -{product.discount}%
          </div>
        )}
        {(!product.inStock || product.stockQty === 0) && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-white text-gray-900 px-3 py-1 rounded-full text-sm font-semibold">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3 sm:p-4">
        {/* Product Name */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors text-sm sm:text-base leading-tight">
          {product.name}
        </h3>

        {/* Rating */}
        {product.rating && (
          <div className="flex items-center mb-2">
            <div className="flex items-center">
              {renderStars(product.rating)}
            </div>
            <span className="ml-1.5 text-xs sm:text-sm text-gray-600">
              ({product.reviewCount || 0})
            </span>
          </div>
        )}

        {/* Price */}
        <div className="mb-3">
          {product.discount && product.discount > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
              <span className="text-lg sm:text-xl font-bold text-red-600">
                {formatPrice(product.price * (1 - product.discount / 100), product.baseCurrency)}
              </span>
              <span className="text-xs sm:text-sm text-gray-500 line-through">
                {formatPrice(product.price, product.baseCurrency)}
              </span>
            </div>
          ) : (
            <span className="text-lg sm:text-xl font-bold text-gray-900">
              {formatPrice(product.price, product.baseCurrency)}
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div className="mb-3">
          {product.inStock && product.stockQty > 0 ? (
            <span className="text-xs sm:text-sm text-green-600 font-medium flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              In Stock ({product.stockQty} available)
            </span>
          ) : (
            <span className="text-xs sm:text-sm text-red-600 font-medium flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Out of Stock
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={!product.inStock || product.stockQty === 0}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 px-4 rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm sm:text-base shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {!product.inStock || product.stockQty === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  )
}