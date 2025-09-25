import React from 'react'

const ReportCharts = ({ data, type, title }) => {
  // Simple bar chart component
  const BarChart = ({ data, title, valueKey, labelKey, color = '#3B82F6' }) => {
    if (!data || data.length === 0) return <div className="text-gray-500 text-center py-8">No data available</div>
    
    const maxValue = Math.max(...data.map(item => item[valueKey] || 0))
    const formatValue = (value) => {
      if (valueKey.includes('Revenue') || valueKey.includes('Earnings') || valueKey.includes('Amount')) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'SAR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value)
      }
      if (valueKey.includes('Rate') || valueKey.includes('Percentage')) {
        return `${value.toFixed(1)}%`
      }
      return value.toLocaleString()
    }

    return (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="space-y-3">
          {data.slice(0, 10).map((item, index) => (
            <div key={index} className="flex items-center">
              <div className="w-24 text-sm text-gray-600 truncate mr-3">
                {item[labelKey] || `Item ${index + 1}`}
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-4 mr-3">
                  <div
                    className="h-4 rounded-full transition-all duration-500"
                    style={{
                      width: `${maxValue > 0 ? (item[valueKey] / maxValue) * 100 : 0}%`,
                      backgroundColor: color
                    }}
                  ></div>
                </div>
                <div className="w-20 text-sm font-medium text-gray-900 text-right">
                  {formatValue(item[valueKey] || 0)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Simple line chart component (using CSS for visualization)
  const LineChart = ({ data, title, valueKey, labelKey, color = '#10B981' }) => {
    if (!data || data.length === 0) return <div className="text-gray-500 text-center py-8">No data available</div>
    
    const maxValue = Math.max(...data.map(item => item[valueKey] || 0))
    const minValue = Math.min(...data.map(item => item[valueKey] || 0))
    const range = maxValue - minValue || 1

    return (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="relative h-64">
          <div className="absolute inset-0 flex items-end justify-between">
            {data.slice(0, 12).map((item, index) => {
              const height = ((item[valueKey] - minValue) / range) * 100
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div className="relative flex-1 flex items-end">
                    <div
                      className="w-2 transition-all duration-500 rounded-t"
                      style={{
                        height: `${height}%`,
                        backgroundColor: color,
                        minHeight: '4px'
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 truncate max-w-16">
                    {item[labelKey] || `${index + 1}`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Pie chart component (using CSS for visualization)
  const PieChart = ({ data, title, valueKey, labelKey }) => {
    if (!data || data.length === 0) return <div className="text-gray-500 text-center py-8">No data available</div>
    
    const total = data.reduce((sum, item) => sum + (item[valueKey] || 0), 0)
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']

    return (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-48 h-48">
            {/* Simple pie chart using border radius */}
            <div className="w-full h-full rounded-full overflow-hidden relative">
              {data.slice(0, 6).map((item, index) => {
                const percentage = total > 0 ? (item[valueKey] / total) * 100 : 0
                const color = colors[index % colors.length]
                return (
                  <div
                    key={index}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(${color} 0deg ${percentage * 3.6}deg, transparent ${percentage * 3.6}deg 360deg)`,
                      transform: `rotate(${data.slice(0, index).reduce((sum, prev) => sum + (total > 0 ? (prev[valueKey] / total) * 360 : 0), 0)}deg)`
                    }}
                  ></div>
                )
              })}
            </div>
          </div>
          <div className="ml-6 space-y-2">
            {data.slice(0, 6).map((item, index) => {
              const percentage = total > 0 ? (item[valueKey] / total) * 100 : 0
              const color = colors[index % colors.length]
              return (
                <div key={index} className="flex items-center text-sm">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-gray-600 mr-2">{item[labelKey]}:</span>
                  <span className="font-medium">{percentage.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Performance gauge component
  const PerformanceGauge = ({ value, title, max = 100, color = '#10B981' }) => {
    const percentage = Math.min((value / max) * 100, 100)
    const strokeDasharray = 2 * Math.PI * 45 // circumference
    const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage) / 100

    return (
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{title}</h3>
        <div className="flex flex-col items-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="#E5E7EB"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke={color}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{value.toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">Performance Score</div>
        </div>
      </div>
    )
  }

  // Render appropriate chart based on type
  switch (type) {
    case 'agent-revenue':
      return (
        <BarChart
          data={data}
          title={title || 'Agent Revenue Performance'}
          valueKey="totalRevenue"
          labelKey="firstName"
          color="#3B82F6"
        />
      )
    
    case 'driver-earnings':
      return (
        <BarChart
          data={data}
          title={title || 'Driver Earnings Performance'}
          valueKey="totalEarnings"
          labelKey="firstName"
          color="#10B981"
        />
      )
    
    case 'investor-roi':
      return (
        <LineChart
          data={data}
          title={title || 'Investor ROI Trends'}
          valueKey="roi"
          labelKey="firstName"
          color="#8B5CF6"
        />
      )
    
    case 'country-revenue':
      return (
        <PieChart
          data={data}
          title={title || 'Revenue by Country'}
          valueKey="totalRevenue"
          labelKey="country"
        />
      )
    
    case 'performance-gauge':
      const avgPerformance = data.reduce((sum, item) => {
        const perf = item.completionRate || item.deliveryRate || item.roi || 0
        return sum + perf
      }, 0) / data.length || 0
      
      return (
        <PerformanceGauge
          value={avgPerformance}
          title={title || 'Average Performance'}
          color="#F59E0B"
        />
      )
    
    case 'orders-trend':
      return (
        <LineChart
          data={data}
          title={title || 'Orders Trend'}
          valueKey="totalOrders"
          labelKey="country"
          color="#EF4444"
        />
      )
    
    default:
      return (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title || 'Chart'}</h3>
          <div className="text-gray-500 text-center py-8">Chart type not supported</div>
        </div>
      )
  }
}

// Chart grid component for displaying multiple charts
export const ChartGrid = ({ charts }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {charts.map((chart, index) => (
        <ReportCharts
          key={index}
          data={chart.data}
          type={chart.type}
          title={chart.title}
        />
      ))}
    </div>
  )
}

// Summary cards component
export const SummaryCards = ({ cards }) => {
  const getCardColor = (type) => {
    switch (type) {
      case 'revenue': return 'text-green-600 bg-green-50 border-green-200'
      case 'orders': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'users': return 'text-purple-600 bg-purple-50 border-purple-200'
      case 'performance': return 'text-orange-600 bg-orange-50 border-orange-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatValue = (value, type) => {
    if (type === 'revenue') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value)
    }
    if (type === 'performance') {
      return `${value.toFixed(1)}%`
    }
    return value.toLocaleString()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {cards.map((card, index) => (
        <div key={index} className={`p-6 rounded-lg border-2 ${getCardColor(card.type)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-75">{card.title}</p>
              <p className="text-3xl font-bold mt-1">{formatValue(card.value, card.type)}</p>
              {card.subtitle && (
                <p className="text-sm opacity-60 mt-1">{card.subtitle}</p>
              )}
            </div>
            {card.icon && (
              <div className="text-3xl opacity-75">{card.icon}</div>
            )}
          </div>
          {card.trend && (
            <div className="mt-4 flex items-center text-sm">
              <span className={`inline-flex items-center ${
                card.trend > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {card.trend > 0 ? '↗️' : '↘️'} {Math.abs(card.trend).toFixed(1)}%
              </span>
              <span className="ml-2 opacity-60">vs last period</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default ReportCharts