import React from 'react'

const categories = [
  { id: 'all', name: 'All Categories', icon: '🏪' },
  { id: 'Skincare', name: 'Skincare', icon: '🧴' },
  { id: 'Haircare', name: 'Haircare', icon: '💇' },
  { id: 'Bodycare', name: 'Bodycare', icon: '🧼' },
  { id: 'Household', name: 'Household', icon: '🏠' },
  { id: 'Kitchen', name: 'Kitchen', icon: '🍳' },
  { id: 'Cleaning', name: 'Cleaning', icon: '🧽' },
  { id: 'Home Decor', name: 'Home Decor', icon: '🏺' },
  { id: 'Electronics', name: 'Electronics', icon: '📱' },
  { id: 'Clothing', name: 'Clothing', icon: '👕' },
  { id: 'Books', name: 'Books', icon: '📚' },
  { id: 'Sports', name: 'Sports', icon: '⚽' },
  { id: 'Health', name: 'Health', icon: '💊' },
  { id: 'Beauty', name: 'Beauty', icon: '💄' },
  { id: 'Toys', name: 'Toys', icon: '🧸' },
  { id: 'Automotive', name: 'Automotive', icon: '🚗' },
  { id: 'Garden', name: 'Garden', icon: '🌱' },
  { id: 'Pet Supplies', name: 'Pet Supplies', icon: '🐕' },
  { id: 'Office', name: 'Office', icon: '📎' },
  { id: 'Other', name: 'Other', icon: '📦' }
]

export default function CategoryFilter({ selectedCategory, onCategoryChange, productCounts = {} }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
      
      <div className="space-y-2">
        {categories.map((category) => {
          const count = category.id === 'all' 
            ? Object.values(productCounts).reduce((sum, count) => sum + count, 0)
            : productCounts[category.id] || 0
            
          return (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors ${
                selectedCategory === category.id
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{category.icon}</span>
                <span className="font-medium">{category.name}</span>
              </div>
              {count > 0 && (
                <span className={`text-sm px-2 py-1 rounded-full ${
                  selectedCategory === category.id
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}