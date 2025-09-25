import express from 'express'
import { auth, allowRoles } from '../middleware/auth.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'

const router = express.Router()

// Create notification (internal use - called by other routes)
export const createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData)
    await notification.save()
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

// Get notifications for current user
router.get('/', auth, allowRoles('admin', 'user', 'agent', 'manager'), async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query
    
    let match = { userId: req.user.id }
    if (unreadOnly === 'true') {
      match.read = false
    }

    const notifications = await Notification.find(match)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('triggeredBy', 'firstName lastName role')
      .lean()

    const total = await Notification.countDocuments(match)
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false })

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ message: 'Failed to fetch notifications' })
  }
})

// Mark notification as read
router.patch('/:id/read', auth, allowRoles('admin', 'user', 'agent', 'manager'), async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    })

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    notification.read = true
    notification.readAt = new Date()
    await notification.save()

    res.json({ message: 'Notification marked as read' })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({ message: 'Failed to mark notification as read' })
  }
})

// Mark all notifications as read
router.patch('/mark-all-read', auth, allowRoles('admin', 'user', 'agent', 'manager'), async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true, readAt: new Date() }
    )

    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    res.status(500).json({ message: 'Failed to mark all notifications as read' })
  }
})

// Delete notification
router.delete('/:id', auth, allowRoles('admin', 'user', 'agent', 'manager'), async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    })

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    res.json({ message: 'Notification deleted' })
  } catch (error) {
    console.error('Error deleting notification:', error)
    res.status(500).json({ message: 'Failed to delete notification' })
  }
})

// Get notification statistics
router.get('/stats', auth, allowRoles('admin', 'user', 'agent', 'manager'), async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unreadCount: {
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
          }
        }
      }
    ])

    const totalCount = await Notification.countDocuments({ userId: req.user.id })
    const totalUnreadCount = await Notification.countDocuments({ userId: req.user.id, read: false })

    res.json({
      byType: stats,
      total: totalCount,
      totalUnread: totalUnreadCount
    })
  } catch (error) {
    console.error('Error fetching notification stats:', error)
    res.status(500).json({ message: 'Failed to fetch notification statistics' })
  }
})

export default router