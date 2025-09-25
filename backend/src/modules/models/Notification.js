import mongoose from 'mongoose'

const NotificationSchema = new mongoose.Schema({
  // Who should see this notification (workspace owner)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // Notification details
  type: { 
    type: String, 
    enum: ['order_created', 'order_shipped', 'order_delivered', 'product_created', 'product_updated', 'user_created', 'agent_created', 'manager_created', 'driver_created', 'expense_added', 'other'], 
    required: true,
    index: true
  },
  
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Related entity information
  relatedId: { type: mongoose.Schema.Types.ObjectId }, // ID of related order, product, user, etc.
  relatedType: { type: String, enum: ['Order', 'Product', 'User', 'Expense', 'Other'] },
  
  // Who triggered this notification
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  triggeredByRole: { type: String, enum: ['admin', 'user', 'agent', 'manager', 'driver'] },
  
  // Notification status
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
  
  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  
}, { timestamps: true })

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 })
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 })
NotificationSchema.index({ type: 1, createdAt: -1 })

export default mongoose.model('Notification', NotificationSchema)