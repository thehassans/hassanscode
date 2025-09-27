import express from 'express'
import { auth, allowRoles } from '../middleware/auth.js'
import Expense from '../models/Expense.js'
import Order from '../models/Order.js'
import Remittance from '../models/Remittance.js'
import AgentRemit from '../models/AgentRemit.js'
import User from '../models/User.js'
import { getIO } from '../config/socket.js'

const router = express.Router()

// Create expense (admin, user, agent)
router.post('/expenses', auth, allowRoles('admin','user','agent'), async (req, res) => {
  const { title, category, amount, currency, notes, incurredAt } = req.body || {}
  if (!title || amount == null) return res.status(400).json({ message: 'Missing title or amount' })

// --- Agent Remittances (Agent -> Approver: user or manager) ---
// Create agent remit request
router.post('/agent-remittances', auth, allowRoles('agent'), async (req, res) => {
  try{
    const { approverId, approverRole, amount, note } = req.body || {}
    if (!approverId || !approverRole || amount == null) return res.status(400).json({ message: 'approverId, approverRole and amount are required' })
    const role = String(approverRole).toLowerCase()
    if (!['user','manager'].includes(role)) return res.status(400).json({ message: 'Invalid approverRole' })
    const me = await User.findById(req.user.id).select('createdBy')
    const ownerId = me?.createdBy
    if (!ownerId) return res.status(400).json({ message: 'No workspace owner' })
    const approver = await User.findById(approverId)
    if (!approver || approver.role !== role) return res.status(400).json({ message: 'Approver not found' })
    // approver must be my owner (if user) or a manager under my owner
    if (role === 'user'){
      if (String(approver._id) !== String(ownerId)) return res.status(403).json({ message: 'Approver must be your workspace owner' })
    } else if (role === 'manager'){
      if (String(approver.createdBy) !== String(ownerId)) return res.status(403).json({ message: 'Manager not in your workspace' })
    }
    const doc = new AgentRemit({
      agent: req.user.id,
      owner: ownerId,
      approver: approverId,
      approverRole: role,
      amount: Math.max(0, Number(amount||0)),
      currency: 'PKR',
      note: note || '',
      status: 'pending',
    })
    await doc.save()
    try{ const io = getIO(); io.to(`user:${String(approverId)}`).emit('agentRemit.created', { id: String(doc._id) }) }catch{}
    return res.status(201).json({ message: 'Request submitted', remit: doc })
  }catch(err){
    return res.status(500).json({ message: 'Failed to submit request' })
  }
})

// List agent remittances
router.get('/agent-remittances', auth, allowRoles('agent','manager','user'), async (req, res) => {
  try{
    let match = {}
    if (req.user.role === 'agent') match.agent = req.user.id
    if (req.user.role === 'manager') match = { approver: req.user.id, approverRole: 'manager' }
    if (req.user.role === 'user') match = { approver: req.user.id, approverRole: 'user' }
    const items = await AgentRemit.find(match).sort({ createdAt: -1 }).populate('agent','firstName lastName email')
    return res.json({ remittances: items })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load agent remittances' })
  }
})

// Approve agent remittance (user or manager)
router.post('/agent-remittances/:id/approve', auth, allowRoles('user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await AgentRemit.findById(id)
    if (!r) return res.status(404).json({ message: 'Request not found' })
    if (String(r.approver) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (r.status !== 'pending') return res.status(400).json({ message: 'Already processed' })
    r.status = 'approved'
    r.approvedAt = new Date()
    r.approvedBy = req.user.id
    await r.save()
    try{ const io = getIO(); io.to(`user:${String(r.agent)}`).emit('agentRemit.approved', { id: String(r._id) }) }catch{}
    return res.json({ message: 'Approved', remit: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to approve' })
  }
})

// Mark agent remittance as sent (user or manager)
router.post('/agent-remittances/:id/send', auth, allowRoles('user','manager'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await AgentRemit.findById(id)
    if (!r) return res.status(404).json({ message: 'Request not found' })
    if (String(r.approver) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (!['approved'].includes(r.status)) return res.status(400).json({ message: 'Request must be approved first' })
    r.status = 'sent'
    r.sentAt = new Date()
    r.sentBy = req.user.id
    await r.save()
    try{ const io = getIO(); io.to(`user:${String(r.agent)}`).emit('agentRemit.sent', { id: String(r._id) }) }catch{}
    return res.json({ message: 'Marked as sent', remit: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to mark as sent' })
  }
})

// Agent wallet summary (sum of sent remittances by currency)
router.get('/agent-remittances/wallet', auth, allowRoles('agent'), async (req, res) => {
  try{
    const rows = await AgentRemit.aggregate([
      { $match: { agent: new (await import('mongoose')).default.Types.ObjectId(req.user.id), status: 'sent' } },
      { $group: { _id: '$currency', total: { $sum: { $ifNull: ['$amount', 0] } } } }
    ])
    const byCurrency = {}
    for (const r of rows){ byCurrency[r._id || ''] = r.total }
    return res.json({ byCurrency })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load wallet' })
  }
})
  const doc = new Expense({ title, category, amount: Math.max(0, Number(amount||0)), currency: currency||'SAR', notes, incurredAt: incurredAt ? new Date(incurredAt) : new Date(), createdBy: req.user.id })
  await doc.save()
  res.status(201).json({ message: 'Expense created', expense: doc })
})

// List expenses (admin => all; user => own+agents; agent => own)
router.get('/expenses', auth, allowRoles('admin','user','agent'), async (req, res) => {
  let match = {}
  if (req.user.role === 'admin') {
    match = {}
  } else if (req.user.role === 'user'){
    const User = (await import('../models/User.js')).default
    const agents = await User.find({ role:'agent', createdBy: req.user.id }, { _id:1 }).lean()
    const ids = agents.map(a=>a._id.toString())
    match = { createdBy: { $in: [req.user.id, ...ids] } }
  } else {
    match = { createdBy: req.user.id }
  }
  const items = await Expense.find(match).sort({ incurredAt: -1 })
  const total = items.reduce((a,b)=> a + Number(b.amount||0), 0)
  res.json({ expenses: items, total })
})

// Transactions: derive from orders and expenses
router.get('/transactions', auth, allowRoles('admin','user'), async (req, res) => {
  // Optional: ?start=ISO&end=ISO
  const start = req.query.start ? new Date(req.query.start) : null
  const end = req.query.end ? new Date(req.query.end) : null

  // scope orders
  let matchOrders = {}
  if (start || end){ matchOrders.createdAt = {} ; if (start) matchOrders.createdAt.$gte = start ; if (end) matchOrders.createdAt.$lte = end }
  if (req.user.role === 'user'){
    const User = (await import('../models/User.js')).default
    const agents = await User.find({ role:'agent', createdBy: req.user.id }, { _id:1 }).lean()
    const ids = agents.map(a=>a._id)
    matchOrders.createdBy = { $in: [req.user.id, ...ids] }
  }
  const orders = await Order.find(matchOrders).lean()

  // scope expenses
  let matchExp = {}
  if (start || end){ matchExp.incurredAt = {} ; if (start) matchExp.incurredAt.$gte = start ; if (end) matchExp.incurredAt.$lte = end }
  if (req.user.role === 'user'){
    const User = (await import('../models/User.js')).default
    const agents = await User.find({ role:'agent', createdBy: req.user.id }, { _id:1 }).lean()
    const ids = agents.map(a=>a._id)
    matchExp.createdBy = { $in: [req.user.id, ...ids] }
  }
  const expenses = await Expense.find(matchExp).lean()

  // Build transactions
  const tx = []
  for (const o of orders){
    // credit: money received from courier on settlement OR collected cash on delivery
    if (o.settled && o.receivedFromCourier > 0){
      tx.push({ date: o.settledAt || o.updatedAt || o.createdAt, type:'credit', source:'settlement', ref:`ORD-${o._id}`, amount: Number(o.receivedFromCourier||0), currency:'SAR', notes:'Courier settlement' })
    } else if ((o.collectedAmount||0) > 0 && String(o.shipmentStatus||'').toLowerCase()==='delivered'){
      tx.push({ date: o.deliveredAt || o.updatedAt || o.createdAt, type:'credit', source:'delivery', ref:`ORD-${o._id}`, amount: Number(o.collectedAmount||0), currency:'SAR', notes:'COD collected' })
    }
    // debits: shipping fee
    if ((o.shippingFee||0) > 0){
      tx.push({ date: o.updatedAt || o.createdAt, type:'debit', source:'shipping', ref:`ORD-${o._id}`, amount: Number(o.shippingFee||0), currency:'SAR', notes:'Shipping cost' })
    }
  }
  for (const e of expenses){
    tx.push({ date: e.incurredAt || e.createdAt, type:'debit', source:'expense', ref:`EXP-${e._id}`, amount: Number(e.amount||0), currency: e.currency||'SAR', notes: e.title })
  }

  tx.sort((a,b)=> new Date(b.date) - new Date(a.date))

  const totals = tx.reduce((acc, t)=>{
    if (t.type==='credit') acc.credits += t.amount; else acc.debits += t.amount; acc.net = acc.credits - acc.debits; return acc
  }, { credits:0, debits:0, net:0 })

  res.json({ transactions: tx, totals })
})

export default router

// --- Remittances (Driver -> Manager) ---
// Helper: currency by country
function currencyFromCountry(country){
  const map = { 'KSA':'SAR', 'Saudi Arabia':'SAR', 'UAE':'AED', 'Oman':'OMR', 'Bahrain':'BHD' }
  const key = String(country||'').trim()
  return map[key] || ''
}

// List remittances in scope
router.get('/remittances', auth, allowRoles('admin','user','manager','driver'), async (req, res) => {
  try{
    let match = {}
    if (req.user.role === 'admin'){
      // no scoping
    } else if (req.user.role === 'user'){
      match.owner = req.user.id
    } else if (req.user.role === 'manager'){
      match.manager = req.user.id
    } else if (req.user.role === 'driver'){
      match.driver = req.user.id
    }
    const items = await Remittance.find(match).sort({ createdAt: -1 }).populate('driver','firstName lastName email country').populate('manager','firstName lastName email country')
    res.json({ remittances: items })
  }catch(err){
    res.status(500).json({ message: 'Failed to list remittances' })
  }
})

// Create remittance (driver)
router.post('/remittances', auth, allowRoles('driver'), async (req, res) => {
  try{
    const { managerId, amount, fromDate, toDate, note } = req.body || {}
    if (!managerId || amount == null) return res.status(400).json({ message: 'managerId and amount are required' })
    const mgr = await User.findById(managerId)
    if (!mgr || mgr.role !== 'manager') return res.status(400).json({ message: 'Manager not found' })
    const me = await User.findById(req.user.id).select('createdBy country')
    const ownerId = String(me?.createdBy || '')
    if (!ownerId || String(mgr.createdBy) !== ownerId){
      return res.status(403).json({ message: 'Manager not in your workspace' })
    }
    // Optional country match
    if (me?.country && mgr?.country && String(me.country) !== String(mgr.country)){
      return res.status(400).json({ message: 'Manager country must match your country' })
    }
    // Compute delivered orders count in range for this driver
    const matchOrders = { deliveryBoy: req.user.id, shipmentStatus: 'delivered' }
    if (fromDate || toDate){
      matchOrders.deliveredAt = {}
      if (fromDate) matchOrders.deliveredAt.$gte = new Date(fromDate)
      if (toDate) matchOrders.deliveredAt.$lte = new Date(toDate)
    }
    const totalDeliveredOrders = await Order.countDocuments(matchOrders)
    const doc = new Remittance({
      driver: req.user.id,
      manager: managerId,
      owner: ownerId,
      country: me?.country || '',
      currency: currencyFromCountry(me?.country || ''),
      amount: Math.max(0, Number(amount||0)),
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      totalDeliveredOrders,
      note: note || '',
      status: 'pending',
    })
    await doc.save()
    try{ const io = getIO(); io.to(`user:${String(managerId)}`).emit('remittance.created', { id: String(doc._id) }) }catch{}
    return res.status(201).json({ message: 'Remittance submitted', remittance: doc })
  }catch(err){
    return res.status(500).json({ message: 'Failed to submit remittance' })
  }
})

// Accept remittance (manager)
router.post('/remittances/:id/accept', auth, allowRoles('manager'), async (req, res) => {
  try{
    const { id } = req.params
    const r = await Remittance.findById(id)
    if (!r) return res.status(404).json({ message: 'Remittance not found' })
    if (String(r.manager) !== String(req.user.id)) return res.status(403).json({ message: 'Not allowed' })
    if (r.status !== 'pending') return res.status(400).json({ message: 'Already processed' })
    r.status = 'accepted'
    r.acceptedAt = new Date()
    r.acceptedBy = req.user.id
    await r.save()
    try{ const io = getIO(); io.to(`user:${String(r.driver)}`).emit('remittance.accepted', { id: String(r._id) }) }catch{}
    return res.json({ message: 'Remittance accepted', remittance: r })
  }catch(err){
    return res.status(500).json({ message: 'Failed to accept remittance' })
  }
})

// Summary for driver: total delivered and collected in period
router.get('/remittances/summary', auth, allowRoles('driver'), async (req, res) => {
  try{
    const { fromDate = '', toDate = '' } = req.query || {}
    const match = { deliveryBoy: req.user.id, shipmentStatus: 'delivered' }
    if (fromDate || toDate){
      match.deliveredAt = {}
      if (fromDate) match.deliveredAt.$gte = new Date(fromDate)
      if (toDate) match.deliveredAt.$lte = new Date(toDate)
    }
    const rows = await Order.aggregate([
      { $match: match },
      { $group: { _id: null, totalDeliveredOrders: { $sum: 1 }, totalCollectedAmount: { $sum: { $ifNull: ['$collectedAmount', 0] } } } }
    ])
    const me = await User.findById(req.user.id).select('country')
    const currency = currencyFromCountry(me?.country || '')
    const out = rows && rows[0] ? rows[0] : { totalDeliveredOrders: 0, totalCollectedAmount: 0 }
    return res.json({ ...out, currency })
  }catch(err){
    return res.status(500).json({ message: 'Failed to load summary' })
  }
})
