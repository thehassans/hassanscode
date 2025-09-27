import express from 'express'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { auth, allowRoles } from '../middleware/auth.js'
import User from '../models/User.js'
import { getIO } from '../config/socket.js'
import { createNotification } from './notifications.js'

const router = express.Router()

// Helper: emit targeted order updates
async function emitOrderChange(ord, action = 'updated'){
  try{
    const io = getIO()
    const orderId = String(ord?._id || '')
    const status = String(ord?.shipmentStatus || ord?.status || '')
    // Notify assigned driver
    if (ord?.deliveryBoy){
      const room = `user:${String(ord.deliveryBoy)}`
      const event = (action === 'assigned') ? 'order.assigned' : 'order.updated'
      try{ io.to(room).emit(event, { orderId, action, status, order: ord }) }catch{}
    }
    // Notify the order creator directly as well (e.g., agent who submitted the order)
    try{ io.to(`user:${String(ord.createdBy)}`).emit('orders.changed', { orderId, action, status }) }catch{}
    // Compute workspace owner for broadcast
    let ownerId = null
    try{
      const creator = await User.findById(ord.createdBy).select('role createdBy').lean()
      ownerId = (creator?.role === 'user') ? String(ord.createdBy) : (creator?.createdBy ? String(creator.createdBy) : String(ord.createdBy))
    }catch{}
    if (ownerId){
      try{ io.to(`workspace:${ownerId}`).emit('orders.changed', { orderId, action, status }) }catch{}
    }
  }catch{ /* ignore socket errors */ }
}

// Create order (admin, user, agent, manager with permission)
router.post('/', auth, allowRoles('admin','user','agent','manager'), async (req, res) => {
  const { customerName, customerPhone, customerLocation, details, phoneCountryCode, orderCountry, city, customerArea, customerAddress, locationLat, locationLng, productId, quantity,
    shipmentMethod, courierName, trackingNumber, deliveryBoy, shippingFee, codAmount, collectedAmount, total, discount, preferredTiming } = req.body || {}
  if (!customerPhone || !customerLocation || !details) return res.status(400).json({ message: 'Missing required fields' })

  // Managers may be restricted by permission
  if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('managerPermissions')
    if (!mgr || !mgr.managerPermissions?.canCreateOrders){
      return res.status(403).json({ message: 'Manager not allowed to create orders' })
    }
  }

  // Duplicate guard: if same creator submits same phone+details in last 30s, return existing
  try{
    const since = new Date(Date.now() - 30_000)
    const dup = await Order.findOne({ createdBy: req.user.id, customerPhone, details, createdAt: { $gte: since } })
    if (dup){
      return res.status(200).json({ message: 'Duplicate submission ignored', order: dup, duplicate: true })
    }
  }catch(_e){ /* best effort */ }

  let prod = null
  if (productId){
    prod = await Product.findById(productId)
    if (!prod) return res.status(400).json({ message: 'Product not found' })
    // Optional: check availability by country
    if (orderCountry && prod.availableCountries?.length && !prod.availableCountries.includes(orderCountry)){
      return res.status(400).json({ message: 'Product not available in selected country' })
    }
  }
  const cod = Math.max(0, Number(codAmount||0))
  const collected = Math.max(0, Number(collectedAmount||0))
  const shipFee = Math.max(0, Number((shippingFee!=null? shippingFee : req.body?.shipping)||0))
  const ordTotal = (total!=null) ? Number(total) : (req.body?.total!=null ? Number(req.body.total) : undefined)
  const disc = (discount!=null) ? Number(discount) : (req.body?.discount!=null ? Number(req.body.discount) : undefined)
  const balanceDue = Math.max(0, cod - collected - shipFee)

  const doc = new Order({
    customerName: customerName || '',
    customerPhone,
    phoneCountryCode,
    orderCountry,
    city,
    customerAddress,
    customerArea: customerArea || '',
    locationLat,
    locationLng,
    customerLocation,
    preferredTiming: preferredTiming || '',
    details,
    productId: prod?._id,
    quantity: Math.max(1, Number(quantity || 1)),
    createdBy: req.user.id,
    createdByRole: req.user.role,
    shipmentMethod: shipmentMethod || 'none',
    courierName: courierName || undefined,
    trackingNumber: trackingNumber || undefined,
    deliveryBoy: deliveryBoy || undefined,
    shippingFee: shipFee,
    codAmount: cod,
    collectedAmount: collected,
    balanceDue,
    ...(ordTotal!=null ? { total: ordTotal } : {}),
    ...(disc!=null ? { discount: disc } : {}),
  })
  await doc.save()
  // Broadcast create
  emitOrderChange(doc, 'created').catch(()=>{})
  // Generate invoice PDF and optionally notify via WhatsApp
  try{
    const { generateInvoicePDF } = await import('../utils/invoice.js')
    const pdfPath = await generateInvoicePDF(doc, { product: prod })
    // Persist invoice path for audit
    try{ doc.invoicePath = `/uploads/invoices/${encodeURIComponent(pdfPath.split('/').pop())}`; await doc.save() }catch{}
    // Try to send WA message with the PDF (if WA enabled)
    try{
      const waEnabled = String(process.env.ENABLE_WA||'').toLowerCase() === 'true'
      if (waEnabled){
        const { sendDocument, sendText } = await import('../services/whatsapp.js')
        const msisdn = `${String(doc.phoneCountryCode||'').replace(/\D/g,'')}${String(doc.customerPhone||'').replace(/\D/g,'')}`
        if (msisdn){
          const jid = `${msisdn}@s.whatsapp.net`
          const fileName = pdfPath.split('/').pop()
          const caption = `Invoice ${doc.invoiceNumber || ''}`
          try{
            await sendDocument(jid, pdfPath, fileName, caption)
            try{ doc.invoiceSentAt = new Date(); await doc.save() }catch{}
          }catch(_e){
            try{ console.warn('[order] sendDocument failed; falling back to link:', _e?.message||_e) }catch{}
            // Fallback to link if document send fails
            const hostBase = process.env.PUBLIC_BASE_URL || (
              (req?.protocol && req?.get && req.get('host'))
                ? `${req.protocol}://${req.get('host')}`
                : 'https://your-domain.example'
            )
            const link = `${hostBase}/uploads/invoices/${encodeURIComponent(fileName)}`
            const msg = `Your invoice ${doc.invoiceNumber || ''} is ready.\nDownload: ${link}`
            await sendText(jid, msg)
          }
        } else {
          console.warn('[order] WA not sent: invalid msisdn', { phoneCountryCode: doc.phoneCountryCode, customerPhone: doc.customerPhone })
        }
      }
    }catch(err){ console.warn('WA notify failed:', err?.message || err) }
  }catch(err){ console.warn('Invoice PDF generation failed:', err?.message || err) }

  // Create notification for order submission
  try {
    // Determine who should receive the notification
    let notificationUserId = req.user.id
    
    // If order was created by agent or manager, notify the owner (user) as well
    if (req.user.role === 'agent' || req.user.role === 'manager') {
      const creator = await User.findById(req.user.id).select('createdBy role').lean()
      if (creator?.createdBy) {
        // Notify the owner (user who created this agent/manager)
        await createNotification({
          userId: creator.createdBy,
          type: 'order_created',
          title: 'New Order Submitted',
          message: `Order #${doc.invoiceNumber || doc._id} submitted by ${req.user.firstName} ${req.user.lastName} (${req.user.role})`,
          relatedId: doc._id,
          relatedType: 'order',
          triggeredBy: req.user.id,
          triggeredByRole: req.user.role,
          metadata: {
            customerPhone: doc.customerPhone,
            city: doc.city,
            total: doc.total,
            productName: prod?.name
          }
        })
      }
    }
    
    // Always notify the order creator
    await createNotification({
      userId: notificationUserId,
      type: 'order_created',
      title: 'Order Submitted Successfully',
      message: `Your order #${doc.invoiceNumber || doc._id} has been submitted successfully`,
      relatedId: doc._id,
      relatedType: 'order',
      triggeredBy: req.user.id,
      triggeredByRole: req.user.role,
      metadata: {
        customerPhone: doc.customerPhone,
        city: doc.city,
        total: doc.total,
        productName: prod?.name
      }
    })
  } catch (notificationError) {
    console.warn('Failed to create order notification:', notificationError?.message || notificationError)
  }

  res.status(201).json({ message: 'Order submitted', order: doc })
})

// List orders (admin => all; others => own)
router.get('/', auth, allowRoles('admin','user','agent','manager'), async (req, res) => {
  let base = {}
  if (req.user.role === 'admin') {
    base = {}
  } else if (req.user.role === 'user') {
    // Include orders created by the user AND by agents/managers created by this user
    const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
    const agentIds = agents.map(a => a._id)
    const managerIds = managers.map(m => m._id)
    base = { createdBy: { $in: [req.user.id, ...agentIds, ...managerIds] } }
  } else if (req.user.role === 'manager') {
    // Manager sees workspace orders for their owner (user)
    const mgr = await User.findById(req.user.id).select('createdBy').lean()
    const ownerId = mgr?.createdBy
    if (ownerId){
      const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
      const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
      const agentIds = agents.map(a => a._id)
      const managerIds = managers.map(m => m._id)
      base = { createdBy: { $in: [ownerId, ...agentIds, ...managerIds] } }
    } else {
      base = { createdBy: req.user.id }
    }
  } else {
    // agent
    base = { createdBy: req.user.id }
  }
  const orders = await Order
    .find(base)
    .sort({ createdAt: -1 })
    .populate('productId')
    .populate('deliveryBoy', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email role')
  res.json({ orders })
})

// Unassigned orders with optional country/city filter (admin, user, manager)
router.get('/unassigned', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { country = '', city = '' } = req.query || {}
  let base = { deliveryBoy: { $in: [null, undefined] } }
  if (req.user.role === 'admin') {
    // no extra scoping
  } else if (req.user.role === 'user') {
    const agents = await User.find({ role: 'agent', createdBy: req.user.id }, { _id: 1 }).lean()
    const managers = await User.find({ role: 'manager', createdBy: req.user.id }, { _id: 1 }).lean()
    const agentIds = agents.map(a => a._id)
    const managerIds = managers.map(m => m._id)
    base.createdBy = { $in: [req.user.id, ...agentIds, ...managerIds] }
  } else {
    // manager workspace scoping
    const mgr = await User.findById(req.user.id).select('createdBy').lean()
    const ownerId = mgr?.createdBy
    if (ownerId){
      const agents = await User.find({ role: 'agent', createdBy: ownerId }, { _id: 1 }).lean()
      const managers = await User.find({ role: 'manager', createdBy: ownerId }, { _id: 1 }).lean()
      const agentIds = agents.map(a => a._id)
      const managerIds = managers.map(m => m._id)
      base.createdBy = { $in: [ownerId, ...agentIds, ...managerIds] }
    } else {
      base.createdBy = req.user.id
    }
  }
  if (country) base.orderCountry = country
  if (city) base.city = city
  const orders = await Order.find(base).sort({ createdAt: -1 }).populate('createdBy','firstName lastName role').populate('productId')
  res.json({ orders })
})

// Assign driver to an order (admin, user, manager). Manager limited to workspace drivers and matching city.
router.post('/:id/assign-driver', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { id } = req.params
  const { driverId } = req.body || {}
  if (!driverId) return res.status(400).json({ message: 'driverId required' })
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  const driver = await User.findById(driverId)
  if (!driver || driver.role !== 'driver') return res.status(400).json({ message: 'Driver not found' })
  // Workspace scoping: user can assign only own drivers; manager only owner drivers
  if (req.user.role === 'user'){
    if (String(driver.createdBy) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
  } else if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('createdBy')
    const ownerId = String(mgr?.createdBy || '')
    if (!ownerId || String(driver.createdBy) !== ownerId) return res.status(403).json({ message: 'Not allowed' })
  }
  // City rule: enforce order city matches driver city if provided
  if (driver.city && ord.city && String(driver.city).toLowerCase() !== String(ord.city).toLowerCase()){
    return res.status(400).json({ message: 'Driver city does not match order city' })
  }
  ord.deliveryBoy = driver._id
  if (!ord.shipmentStatus || ord.shipmentStatus === 'pending') ord.shipmentStatus = 'assigned'
  await ord.save()
  await ord.populate('deliveryBoy','firstName lastName email')
  // Notify driver + workspace
  emitOrderChange(ord, 'assigned').catch(()=>{})
  res.json({ message: 'Driver assigned', order: ord })
})

// Driver: list assigned orders
router.get('/driver/assigned', auth, allowRoles('driver'), async (req, res) => {
  const orders = await Order.find({ deliveryBoy: req.user.id }).sort({ createdAt: -1 }).populate('productId')
  res.json({ orders })
})

// Driver: list orders in my country (optionally filter by city); unassigned only by default
router.get('/driver/available', auth, allowRoles('driver'), async (req, res) => {
  const me = await User.findById(req.user.id).select('country city')
  const { city = '', includeAssigned = 'false' } = req.query || {}
  const cond = { orderCountry: me?.country || '' }
  if (!cond.orderCountry) return res.json({ orders: [] })
  if (city) cond.city = city; else if (me?.city) cond.city = me.city
  if (includeAssigned !== 'true') cond.deliveryBoy = { $in: [null, undefined] }
  const orders = await Order.find(cond).sort({ createdAt: -1 }).populate('productId')
  res.json({ orders })
})

// Driver: claim an unassigned order
router.post('/:id/claim', auth, allowRoles('driver'), async (req, res) => {
  const { id } = req.params
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  if (ord.deliveryBoy) {
    if (String(ord.deliveryBoy) === String(req.user.id)) {
      return res.json({ message: 'Already assigned to you', order: ord })
    }
    return res.status(400).json({ message: 'Order already assigned' })
  }
  const me = await User.findById(req.user.id).select('country city')
  if (ord.orderCountry && me?.country && String(ord.orderCountry) !== String(me.country)) {
    return res.status(400).json({ message: 'Order not in your country' })
  }
  if (ord.city && me?.city && String(ord.city).toLowerCase() !== String(me.city).toLowerCase()) {
    return res.status(400).json({ message: 'Order city does not match your city' })
  }
  ord.deliveryBoy = req.user.id
  if (!ord.shipmentStatus || ord.shipmentStatus === 'pending') ord.shipmentStatus = 'assigned'
  await ord.save()
  await ord.populate('productId')
  emitOrderChange(ord, 'assigned').catch(()=>{})
  res.json({ message: 'Order claimed', order: ord })
})

// Mark shipped (admin, user). Decrement product stock if tracked
router.post('/:id/ship', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  if (ord.status === 'shipped') return res.json({ message: 'Already shipped', order: ord })

  // Optional shipment updates at ship time
  const { shipmentMethod, courierName, trackingNumber, deliveryBoy, shippingFee, codAmount, collectedAmount } = req.body || {}
  if (shipmentMethod) ord.shipmentMethod = shipmentMethod
  if (courierName != null) ord.courierName = courierName
  if (trackingNumber != null) ord.trackingNumber = trackingNumber
  if (deliveryBoy != null) ord.deliveryBoy = deliveryBoy
  if (shippingFee != null) ord.shippingFee = Math.max(0, Number(shippingFee))
  if (codAmount != null) ord.codAmount = Math.max(0, Number(codAmount))
  if (collectedAmount != null) ord.collectedAmount = Math.max(0, Number(collectedAmount))
  // recompute balance
  ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))

  ord.status = 'shipped'
  if (!ord.shipmentStatus || ord.shipmentStatus === 'pending' || ord.shipmentStatus === 'assigned') ord.shipmentStatus = 'in_transit'
  ord.shippedAt = new Date()
  await ord.save()
  if (ord.productId){
    const prod = await Product.findById(ord.productId)
    if (prod){
      const qty = Math.max(1, ord.quantity || 1)
      const country = ord.orderCountry
      // Decrement per-country stock if structured stock is used
      if (prod.stockByCountry){
        const byC = prod.stockByCountry
        if (country === 'UAE') byC.UAE = Math.max(0, (byC.UAE || 0) - qty)
        else if (country === 'Oman') byC.Oman = Math.max(0, (byC.Oman || 0) - qty)
        else if (country === 'KSA') byC.KSA = Math.max(0, (byC.KSA || 0) - qty)
        else if (country === 'Bahrain') byC.Bahrain = Math.max(0, (byC.Bahrain || 0) - qty)
        // sync legacy total stockQty from per-country
        const totalLeft = (byC.UAE||0) + (byC.Oman||0) + (byC.KSA||0) + (byC.Bahrain||0)
        prod.stockQty = totalLeft
        prod.inStock = totalLeft > 0
      } else if (prod.stockQty != null){
        // Legacy behavior
        prod.stockQty = Math.max(0, (prod.stockQty || 0) - qty)
        prod.inStock = prod.stockQty > 0
      }
      await prod.save()
    }
  }
  // Broadcast status change
  emitOrderChange(ord, 'shipped').catch(()=>{})
  res.json({ message: 'Order shipped', order: ord })
})

// Update shipment fields and status
router.post('/:id/shipment/update', auth, allowRoles('admin','user','agent','driver'), async (req, res) => {
  const { id } = req.params
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })

  // Drivers: restricted update scope and permissions
  if (req.user.role === 'driver') {
    if (String(ord.deliveryBoy || '') !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not allowed' })
    }
    const { shipmentStatus, deliveryNotes, note } = req.body || {}
    if (shipmentStatus) {
      const allowed = new Set(['no_response', 'attempted', 'contacted', 'picked_up'])
      if (!allowed.has(String(shipmentStatus))) {
        return res.status(400).json({ message: 'Invalid status' })
      }
      ord.shipmentStatus = shipmentStatus
      if (shipmentStatus === 'picked_up') {
        try{ ord.pickedUpAt = new Date() }catch{}
      }
    }
    if (deliveryNotes != null || note != null) ord.deliveryNotes = (note != null ? note : deliveryNotes)
    // Recompute balance
    ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))
    await ord.save()
    emitOrderChange(ord, 'shipment_updated').catch(()=>{})
    return res.json({ message: 'Shipment updated', order: ord })
  }

  // Non-driver roles retain full update capabilities
  const { shipmentMethod, shipmentStatus, courierName, trackingNumber, deliveryBoy, shippingFee, codAmount, collectedAmount, deliveryNotes, returnReason } = req.body || {}
  if (shipmentMethod) ord.shipmentMethod = shipmentMethod
  if (shipmentStatus) ord.shipmentStatus = shipmentStatus
  if (courierName != null) ord.courierName = courierName
  if (trackingNumber != null) ord.trackingNumber = trackingNumber
  if (deliveryBoy != null) ord.deliveryBoy = deliveryBoy
  if (shippingFee != null) ord.shippingFee = Math.max(0, Number(shippingFee))
  if (codAmount != null) ord.codAmount = Math.max(0, Number(codAmount))
  if (collectedAmount != null) ord.collectedAmount = Math.max(0, Number(collectedAmount))
  if (deliveryNotes != null) ord.deliveryNotes = deliveryNotes
  if (returnReason != null) ord.returnReason = returnReason
  ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))
  await ord.save()
  emitOrderChange(ord, 'shipment_updated').catch(()=>{})
  res.json({ message: 'Shipment updated', order: ord })
})

// Mark as delivered
router.post('/:id/deliver', auth, allowRoles('admin','user','agent','driver'), async (req, res) => {
  const { id } = req.params
  const { collectedAmount, deliveryNotes, note } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  // Permissions: drivers may deliver only their assigned orders; agents only their own created orders
  if (req.user.role === 'driver' && String(ord.deliveryBoy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  if (req.user.role === 'agent' && String(ord.createdBy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  if (collectedAmount != null) ord.collectedAmount = Math.max(0, Number(collectedAmount))
  if (deliveryNotes != null || note != null) ord.deliveryNotes = (note != null ? note : deliveryNotes)
  ord.deliveredAt = new Date()
  ord.shipmentStatus = 'delivered'
  ord.balanceDue = Math.max(0, (ord.codAmount||0) - (ord.collectedAmount||0) - (ord.shippingFee||0))
  await ord.save()
  emitOrderChange(ord, 'delivered').catch(()=>{})
  res.json({ message: 'Order delivered', order: ord })
})

// Mark as returned
router.post('/:id/return', auth, allowRoles('admin','user','agent'), async (req, res) => {
  const { id } = req.params
  const { reason } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  ord.shipmentStatus = 'returned'
  ord.returnReason = reason || ord.returnReason
  await ord.save()
  emitOrderChange(ord, 'returned').catch(()=>{})
  res.json({ message: 'Order returned', order: ord })
})

// Cancel order with reason (admin, user, agent, manager, driver)
router.post('/:id/cancel', auth, allowRoles('admin','user','agent','manager','driver'), async (req, res) => {
  const { id } = req.params
  const { reason } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  // Permissions: drivers may cancel only their assigned orders; agents only their own created orders
  if (req.user.role === 'driver' && String(ord.deliveryBoy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  if (req.user.role === 'agent' && String(ord.createdBy||'') !== String(req.user.id)){
    return res.status(403).json({ message: 'Not allowed' })
  }
  ord.shipmentStatus = 'cancelled'
  if (reason != null) ord.returnReason = String(reason)
  await ord.save()
  emitOrderChange(ord, 'cancelled').catch(()=>{})
  res.json({ message: 'Order cancelled', order: ord })
})

// Settle COD with courier/delivery
router.post('/:id/settle', auth, allowRoles('admin','user'), async (req, res) => {
  const { id } = req.params
  const { receivedFromCourier } = req.body || {}
  const ord = await Order.findById(id)
  if (!ord) return res.status(404).json({ message: 'Order not found' })
  ord.receivedFromCourier = Math.max(0, Number(receivedFromCourier || 0))
  ord.settled = true
  ord.settledAt = new Date()
  ord.settledBy = req.user.id
  await ord.save()
  emitOrderChange(ord, 'settled').catch(()=>{})
  res.json({ message: 'Order settled', order: ord })
})

export default router

// Analytics: last 7 days sales by country
router.get('/analytics/last7days', auth, allowRoles('admin','user'), async (req, res) => {
  try{
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6) // include today + previous 6 days
    sevenDaysAgo.setHours(0,0,0,0)

    const docs = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $project: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orderCountry: { $ifNull: ['$orderCountry', ''] }
        }
      },
      { $group: { _id: { day: '$day', country: '$orderCountry' }, count: { $sum: 1 } } },
      { $project: { _id: 0, day: '$_id.day', country: '$_id.country', count: 1 } },
      { $sort: { day: 1 } }
    ])

    // Build a response with all 7 days and 4 countries
    const countries = ['UAE','Oman','KSA','Bahrain']
    const days = []
    for (let i=6;i>=0;i--){
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      d.setHours(0,0,0,0)
      const key = d.toISOString().slice(0,10)
      days.push(key)
    }

    const byDay = days.map(day => {
      const entry = { day }
      for (const c of countries) entry[c] = 0
      return entry
    })

    for (const row of docs){
      const idx = byDay.findIndex(x => x.day === row.day)
      if (idx >= 0){
        if (countries.includes(row.country)) byDay[idx][row.country] += row.count
      }
    }

    // Totals per country across 7 days
    const totals = Object.fromEntries(countries.map(c => [c, byDay.reduce((acc, d) => acc + (d[c]||0), 0)]))

    res.json({ days: byDay, totals })
  }catch(err){
    res.status(500).json({ message: 'Failed to load analytics', error: err?.message })
  }
})
