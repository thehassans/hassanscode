import express from 'express'
const router = express.Router()
import User from '../models/User.js'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { auth, allowRoles } from '../middleware/auth.js'
import mongoose from 'mongoose'

// Helper function to calculate performance rating
const calculatePerformance = (metrics) => {
  const { completionRate, avgRating, totalOrders, revenue } = metrics
  
  let score = 0
  
  // Completion rate (40% weight)
  if (completionRate >= 95) score += 40
  else if (completionRate >= 90) score += 35
  else if (completionRate >= 80) score += 30
  else if (completionRate >= 70) score += 20
  else score += 10
  
  // Average rating (30% weight)
  if (avgRating >= 4.5) score += 30
  else if (avgRating >= 4.0) score += 25
  else if (avgRating >= 3.5) score += 20
  else if (avgRating >= 3.0) score += 15
  else score += 5
  
  // Volume (20% weight)
  if (totalOrders >= 100) score += 20
  else if (totalOrders >= 50) score += 15
  else if (totalOrders >= 20) score += 10
  else if (totalOrders >= 10) score += 5
  
  // Revenue (10% weight)
  if (revenue >= 10000) score += 10
  else if (revenue >= 5000) score += 8
  else if (revenue >= 2000) score += 6
  else if (revenue >= 1000) score += 4
  else if (revenue >= 500) score += 2
  
  if (score >= 85) return 'excellent'
  else if (score >= 70) return 'good'
  else if (score >= 50) return 'average'
  else return 'poor'
}

// Helper function to get date range
const getDateRange = (period = '30d') => {
  const end = new Date()
  const start = new Date()
  
  switch (period) {
    case '7d':
      start.setDate(end.getDate() - 7)
      break
    case '30d':
      start.setDate(end.getDate() - 30)
      break
    case '90d':
      start.setDate(end.getDate() - 90)
      break
    case '1y':
      start.setFullYear(end.getFullYear() - 1)
      break
    default:
      start.setDate(end.getDate() - 30)
  }
  
  return { start, end }
}

// Overview Report
router.get('/overview', auth, async (req, res) => {
  try {
    const { period = '30d' } = req.query
    const { start, end } = getDateRange(period)
    
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Get total counts
    const [totalUsers, totalAgents, totalDrivers, totalInvestors] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      User.countDocuments({ role: 'agent', createdAt: { $gte: start, $lte: end } }),
      User.countDocuments({ role: 'driver', createdAt: { $gte: start, $lte: end } }),
      User.countDocuments({ role: 'investor', createdAt: { $gte: start, $lte: end } })
    ])

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      }
    ])

    const stats = orderStats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 }

    res.json({
      totalUsers,
      totalAgents,
      totalDrivers,
      totalInvestors,
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      avgOrderValue: stats.avgOrderValue,
      period,
      dateRange: { start, end }
    })
  } catch (error) {
    console.error('Overview report error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Agent Performance Report
router.get('/agents', auth, async (req, res) => {
  try {
    const { period = '30d', limit = 50 } = req.query
    const { start, end } = getDateRange(period)
    
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const agents = await User.aggregate([
      {
        $match: {
          role: 'agent',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { agentId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$createdBy', '$$agentId'] },
                createdAt: { $gte: start, $lte: end }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $addFields: {
          totalOrders: { $size: '$orders' },
          completedOrders: {
            $size: {
              $filter: {
                input: '$orders',
                cond: { $eq: ['$$this.status', 'delivered'] }
              }
            }
          },
          pendingOrders: {
            $size: {
              $filter: {
                input: '$orders',
                cond: { $in: ['$$this.status', ['pending', 'processing', 'shipped']] }
              }
            }
          },
          totalRevenue: { $sum: '$orders.totalAmount' },
          avgOrderValue: { $avg: '$orders.totalAmount' },
          completionRate: {
            $cond: {
              if: { $gt: [{ $size: '$orders' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$orders',
                            cond: { $eq: ['$$this.status', 'delivered'] }
                          }
                        }
                      },
                      { $size: '$orders' }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      {
        $addFields: {
          performance: {
            $switch: {
              branches: [
                { case: { $gte: ['$completionRate', 95] }, then: 'excellent' },
                { case: { $gte: ['$completionRate', 85] }, then: 'good' },
                { case: { $gte: ['$completionRate', 70] }, then: 'average' }
              ],
              default: 'poor'
            }
          }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          country: 1,
          city: 1,
          availability: 1,
          totalOrders: 1,
          completedOrders: 1,
          pendingOrders: 1,
          totalRevenue: 1,
          avgOrderValue: 1,
          completionRate: 1,
          performance: 1,
          createdAt: 1
        }
      }
    ])

    res.json(agents)
  } catch (error) {
    console.error('Agent report error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Driver Performance Report
router.get('/drivers', auth, async (req, res) => {
  try {
    const { period = '30d', limit = 50 } = req.query
    const { start, end } = getDateRange(period)
    
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const drivers = await User.aggregate([
      {
        $match: {
          role: 'driver',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { driverId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$assignedDriver', '$$driverId'] },
                createdAt: { $gte: start, $lte: end }
              }
            }
          ],
          as: 'deliveries'
        }
      },
      {
        $addFields: {
          totalDeliveries: { $size: '$deliveries' },
          completedDeliveries: {
            $size: {
              $filter: {
                input: '$deliveries',
                cond: { $eq: ['$$this.status', 'delivered'] }
              }
            }
          },
          pendingDeliveries: {
            $size: {
              $filter: {
                input: '$deliveries',
                cond: { $in: ['$$this.status', ['assigned', 'picked_up', 'in_transit']] }
              }
            }
          },
          totalEarnings: {
            $sum: {
              $map: {
                input: '$deliveries',
                as: 'delivery',
                in: { $multiply: ['$$delivery.totalAmount', 0.1] } // 10% commission
              }
            }
          },
          avgDeliveryValue: { $avg: '$deliveries.totalAmount' },
          successRate: {
            $cond: {
              if: { $gt: [{ $size: '$deliveries' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$deliveries',
                            cond: { $eq: ['$$this.status', 'delivered'] }
                          }
                        }
                      },
                      { $size: '$deliveries' }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      {
        $addFields: {
          performance: {
            $switch: {
              branches: [
                { case: { $gte: ['$successRate', 95] }, then: 'excellent' },
                { case: { $gte: ['$successRate', 85] }, then: 'good' },
                { case: { $gte: ['$successRate', 70] }, then: 'average' }
              ],
              default: 'poor'
            }
          }
        }
      },
      {
        $sort: { totalEarnings: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          country: 1,
          city: 1,
          availability: 1,
          totalDeliveries: 1,
          completedDeliveries: 1,
          pendingDeliveries: 1,
          totalEarnings: 1,
          avgDeliveryValue: 1,
          successRate: 1,
          performance: 1,
          createdAt: 1
        }
      }
    ])

    res.json(drivers)
  } catch (error) {
    console.error('Driver report error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Investor Performance Report
router.get('/investors', auth, async (req, res) => {
  try {
    const { period = '30d', limit = 50 } = req.query
    const { start, end } = getDateRange(period)
    
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const investors = await User.aggregate([
      {
        $match: {
          role: 'investor',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { investorId: '$_id' },
          pipeline: [
            {
              $match: {
                createdAt: { $gte: start, $lte: end }
              }
            },
            {
              $lookup: {
                from: 'products',
                localField: 'items.productId',
                foreignField: '_id',
                as: 'productDetails'
              }
            }
          ],
          as: 'relatedOrders'
        }
      },
      {
        $addFields: {
          investmentAmount: { $ifNull: ['$investorProfile.investmentAmount', 0] },
          unitsSold: { $ifNull: ['$investorProfile.unitsSold', 0] },
          totalProfit: { $ifNull: ['$investorProfile.totalProfit', 0] },
          totalSaleValue: { $ifNull: ['$investorProfile.totalSaleValue', 0] },
          roi: {
            $cond: {
              if: { $gt: ['$investorProfile.investmentAmount', 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $ifNull: ['$investorProfile.totalProfit', 0] },
                      { $ifNull: ['$investorProfile.investmentAmount', 1] }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          },
          profitMargin: {
            $cond: {
              if: { $gt: ['$investorProfile.totalSaleValue', 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $ifNull: ['$investorProfile.totalProfit', 0] },
                      { $ifNull: ['$investorProfile.totalSaleValue', 1] }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          }
        }
      },
      {
        $addFields: {
          performance: {
            $switch: {
              branches: [
                { case: { $gte: ['$roi', 20] }, then: 'excellent' },
                { case: { $gte: ['$roi', 15] }, then: 'good' },
                { case: { $gte: ['$roi', 10] }, then: 'average' }
              ],
              default: 'poor'
            }
          }
        }
      },
      {
        $sort: { roi: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          phone: 1,
          country: 1,
          city: 1,
          investmentAmount: 1,
          unitsSold: 1,
          totalProfit: 1,
          totalSaleValue: 1,
          roi: 1,
          profitMargin: 1,
          performance: 1,
          investorProfile: 1,
          createdAt: 1
        }
      }
    ])

    res.json(investors)
  } catch (error) {
    console.error('Investor report error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Country-wise Performance Report
router.get('/countries', auth, async (req, res) => {
  try {
    const { period = '30d' } = req.query
    const { start, end } = getDateRange(period)
    
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const countries = await User.aggregate([
      {
        $match: {
          country: { $exists: true, $ne: null, $ne: '' },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$country',
          totalUsers: { $sum: 1 },
          agents: {
            $sum: { $cond: [{ $eq: ['$role', 'agent'] }, 1, 0] }
          },
          drivers: {
            $sum: { $cond: [{ $eq: ['$role', 'driver'] }, 1, 0] }
          },
          investors: {
            $sum: { $cond: [{ $eq: ['$role', 'investor'] }, 1, 0] }
          },
          customers: {
            $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { country: '$_id' },
          pipeline: [
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
              }
            },
            {
              $match: {
                $expr: { $eq: [{ $arrayElemAt: ['$user.country', 0] }, '$$country'] },
                createdAt: { $gte: start, $lte: end }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $addFields: {
          totalOrders: { $size: '$orders' },
          totalRevenue: { $sum: '$orders.totalAmount' },
          avgOrderValue: { $avg: '$orders.totalAmount' },
          marketPenetration: {
            $multiply: [
              {
                $divide: [
                  '$customers',
                  { $add: ['$totalUsers', 1] } // Add 1 to avoid division by zero
                ]
              },
              100
            ]
          }
        }
      },
      {
        $project: {
          country: '$_id',
          totalUsers: 1,
          agents: 1,
          drivers: 1,
          investors: 1,
          customers: 1,
          totalOrders: 1,
          totalRevenue: 1,
          avgOrderValue: 1,
          marketPenetration: 1
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ])

    res.json(countries)
  } catch (error) {
    console.error('Country report error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Country-wise Driver Performance Report
router.get('/country-drivers', auth, async (req, res) => {
  try {
    const { period = '30d' } = req.query
    const { start, end } = getDateRange(period)
    
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const countryDrivers = await User.aggregate([
      {
        $match: {
          role: 'driver',
          country: { $exists: true, $ne: null, $ne: '' },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$country',
          totalDrivers: { $sum: 1 },
          activeDrivers: {
            $sum: { $cond: [{ $eq: ['$availability', 'available'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'orders',
          let: { country: '$_id' },
          pipeline: [
            {
              $lookup: {
                from: 'users',
                localField: 'assignedDriver',
                foreignField: '_id',
                as: 'driver'
              }
            },
            {
              $match: {
                $expr: { $eq: [{ $arrayElemAt: ['$driver.country', 0] }, '$$country'] },
                createdAt: { $gte: start, $lte: end }
              }
            }
          ],
          as: 'deliveries'
        }
      },
      {
        $addFields: {
          totalDeliveries: { $size: '$deliveries' },
          successfulDeliveries: {
            $size: {
              $filter: {
                input: '$deliveries',
                cond: { $eq: ['$$this.status', 'delivered'] }
              }
            }
          },
          totalEarnings: {
            $sum: {
              $map: {
                input: '$deliveries',
                as: 'delivery',
                in: { $multiply: ['$$delivery.totalAmount', 0.1] } // 10% commission
              }
            }
          },
          successRate: {
            $cond: {
              if: { $gt: [{ $size: '$deliveries' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      {
                        $size: {
                          $filter: {
                            input: '$deliveries',
                            cond: { $eq: ['$$this.status', 'delivered'] }
                          }
                        }
                      },
                      { $size: '$deliveries' }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          },
          avgPerformance: {
            $switch: {
              branches: [
                { case: { $gte: ['$successRate', 95] }, then: 'excellent' },
                { case: { $gte: ['$successRate', 85] }, then: 'good' },
                { case: { $gte: ['$successRate', 70] }, then: 'average' }
              ],
              default: 'poor'
            }
          }
        }
      },
      {
        $project: {
          country: '$_id',
          totalDrivers: 1,
          activeDrivers: 1,
          totalDeliveries: 1,
          successfulDeliveries: 1,
          totalEarnings: 1,
          successRate: 1,
          avgPerformance: 1
        }
      },
      {
        $sort: { totalEarnings: -1 }
      }
    ])

    res.json(countryDrivers)
  } catch (error) {
    console.error('Country driver report error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

export default router