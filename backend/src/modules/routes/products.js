import express from 'express'
import multer from 'multer'
import path from 'path'
import { auth, allowRoles } from '../middleware/auth.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { createNotification } from './notifications.js'
import geminiService from '../services/geminiService.js'

const router = express.Router()

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    cb(null, `${name}-${Date.now()}${ext}`)
  }
})
const upload = multer({ storage })

// Create product (admin; user; manager with permission)
router.post('/', auth, allowRoles('admin','user','manager'), upload.any(), async (req, res) => {
  const { name, price, stockQty, purchasePrice, category, madeInCountry, description, stockUAE, stockOman, stockKSA, stockBahrain } = req.body || {}
  if (!name || price == null) return res.status(400).json({ message: 'Name and price are required' })
  
  let ownerId = req.user.id
  if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
    if (!mgr || !mgr.managerPermissions?.canManageProducts){ return res.status(403).json({ message: 'Manager not allowed to manage products' }) }
    ownerId = String(mgr.createdBy || req.user.id)
  }
  
  const files = Array.isArray(req.files) ? req.files : []
  const imageFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'image')
  const imagePaths = imageFiles.map(f => `/uploads/${f.filename}`)
  
  // per-country stock
  const sbc = { UAE:0, Oman:0, KSA:0, Bahrain:0 }
  if (stockUAE != null) sbc.UAE = Math.max(0, Number(stockUAE))
  if (stockOman != null) sbc.Oman = Math.max(0, Number(stockOman))
  if (stockKSA != null) sbc.KSA = Math.max(0, Number(stockKSA))
  if (stockBahrain != null) sbc.Bahrain = Math.max(0, Number(stockBahrain))
  
  // if stockQty not provided, sum from per-country
  let finalStockQty = stockQty != null ? Number(stockQty) : (sbc.UAE + sbc.Oman + sbc.KSA + sbc.Bahrain)
  
  const doc = new Product({
    name: String(name).trim(),
    price: Number(price),
    stockQty: finalStockQty,
    stockByCountry: sbc,
    imagePath: imagePaths[0] || '',
    images: imagePaths,
    purchasePrice: purchasePrice != null ? Number(purchasePrice) : 0,
    category: ['Skincare','Haircare','Bodycare','Other'].includes(category) ? category : 'Other',
    madeInCountry: madeInCountry || '',
    description: description || '',
    createdBy: ownerId,
  })
  await doc.save()
  
  // Create notification for product creation
  try {
    // If product was created by manager, notify the owner (user) as well
    if (req.user.role === 'manager') {
      const creator = await User.findById(req.user.id).select('createdBy role').lean()
      if (creator?.createdBy) {
        // Notify the owner (user who created this manager)
        await createNotification({
          userId: creator.createdBy,
          type: 'product_created',
          title: 'New Product Added',
          message: `Product "${doc.name}" added by ${req.user.firstName} ${req.user.lastName} (${req.user.role})`,
          relatedId: doc._id,
          relatedType: 'product',
          triggeredBy: req.user.id,
          triggeredByRole: req.user.role,
          metadata: {
            productName: doc.name,
            price: doc.price,
            category: doc.category,
            stockQty: doc.stockQty
          }
        })
      }
    }
    
    // Always notify the product creator
    await createNotification({
      userId: ownerId,
      type: 'product_created',
      title: 'Product Created Successfully',
      message: `Your product "${doc.name}" has been created successfully`,
      relatedId: doc._id,
      relatedType: 'product',
      triggeredBy: req.user.id,
      triggeredByRole: req.user.role,
      metadata: {
        productName: doc.name,
        price: doc.price,
        category: doc.category,
        stockQty: doc.stockQty
      }
    })
  } catch (notificationError) {
    console.warn('Failed to create product notification:', notificationError?.message || notificationError)
  }
  
  res.status(201).json({ message: 'Product created', product: doc })
})

// Get single product by ID (public endpoint)
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id).select('-createdBy -updatedAt -__v')
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    
    res.json({ product })
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({ message: 'Failed to fetch product' })
  }
})

// Public products endpoint (no authentication required)
router.get('/public', async (req, res) => {
  try {
    const { category, search, sort, limit = 50, page = 1 } = req.query
    
    let query = {}
    
    // Category filter
    if (category && category !== 'all') {
      query.category = category
    }
    
    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { category: searchRegex }
      ]
    }
    
    // Build sort object
    let sortObj = { createdAt: -1 } // default: newest first
    if (sort) {
      switch (sort) {
        case 'name':
          sortObj = { name: 1 }
          break
        case 'name-desc':
          sortObj = { name: -1 }
          break
        case 'price':
          sortObj = { price: 1 }
          break
        case 'price-desc':
          sortObj = { price: -1 }
          break
        case 'rating':
          sortObj = { rating: -1 }
          break
        case 'featured':
          sortObj = { featured: -1, createdAt: -1 }
          break
        case 'newest':
        default:
          sortObj = { createdAt: -1 }
          break
      }
    }
    
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum
    
    const products = await Product.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .select('-createdBy -updatedAt -__v')
    
    const total = await Product.countDocuments(query)
    
    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Public products error:', error)
    res.status(500).json({ message: 'Failed to fetch products' })
  }
})

// List products (admin => all; agent => all; user => own; manager => owner's; customer => all public)
router.get('/', auth, allowRoles('admin','user','agent','manager','customer'), async (req, res) => {
  let base = {}
  if (req.user.role === 'admin' || req.user.role === 'agent' || req.user.role === 'customer') base = {}
  else if (req.user.role === 'user') base = { createdBy: req.user.id }
  else if (req.user.role === 'manager'){
    const mgr = await User.findById(req.user.id).select('createdBy')
    base = { createdBy: mgr?.createdBy || '__none__' }
  }
  const products = await Product.find(base).sort({ createdAt: -1 })
  res.json({ products })
})

// Update product (admin; user owner; manager with permission on owner's products)
router.patch('/:id', auth, allowRoles('admin','user','manager'), upload.any(), async (req, res) => {
  const { id } = req.params
  const prod = await Product.findById(id)
  if (!prod) return res.status(404).json({ message: 'Product not found' })
  if (req.user.role !== 'admin'){
    let ownerId = req.user.id
    if (req.user.role === 'manager'){
      const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
      if (!mgr || !mgr.managerPermissions?.canManageProducts){ return res.status(403).json({ message: 'Manager not allowed to manage products' }) }
      ownerId = String(mgr.createdBy || req.user.id)
    }
    if (String(prod.createdBy) !== String(ownerId)) return res.status(403).json({ message: 'Not allowed' })
  }
  const { name, price, stockQty, purchasePrice, category, madeInCountry, description, inStock, stockUAE, stockOman, stockKSA, stockBahrain } = req.body || {}
  if (name != null) prod.name = String(name).trim()
  if (price != null) prod.price = Number(price)
  if (stockQty != null) prod.stockQty = Math.max(0, Number(stockQty))
  if (purchasePrice != null) prod.purchasePrice = Number(purchasePrice)
  if (category != null) prod.category = ['Skincare','Haircare','Bodycare','Other'].includes(category) ? category : 'Other'
  if (inStock != null) prod.inStock = Boolean(inStock)
  if (madeInCountry != null) prod.madeInCountry = String(madeInCountry)
  if (description != null) prod.description = String(description)
  // per-country stock updates
  const sbc = { ...(prod.stockByCountry || { UAE:0, Oman:0, KSA:0, Bahrain:0 }) }
  if (stockUAE != null) sbc.UAE = Math.max(0, Number(stockUAE))
  if (stockOman != null) sbc.Oman = Math.max(0, Number(stockOman))
  if (stockKSA != null) sbc.KSA = Math.max(0, Number(stockKSA))
  if (stockBahrain != null) sbc.Bahrain = Math.max(0, Number(stockBahrain))
  prod.stockByCountry = sbc
  // if client didn't send stockQty explicitly, recompute from per-country
  if (stockQty == null && (stockUAE != null || stockOman != null || stockKSA != null || stockBahrain != null)){
    prod.stockQty = (sbc.UAE + sbc.Oman + sbc.KSA + sbc.Bahrain)
  }
  const files = Array.isArray(req.files) ? req.files : []
  const imageFiles = files.filter(f => f.fieldname === 'images' || f.fieldname === 'image')
  if (imageFiles.length){
    const imagePaths = imageFiles.map(f => `/uploads/${f.filename}`)
    prod.imagePath = imagePaths[0]
    prod.images = imagePaths
  }
  await prod.save()
  res.json({ message: 'Updated', product: prod })
})

// Delete product (admin; user owner; manager with permission on owner's products)
router.delete('/:id', auth, allowRoles('admin','user','manager'), async (req, res) => {
  const { id } = req.params
  const prod = await Product.findById(id)
  if (!prod) return res.status(404).json({ message: 'Product not found' })
  if (req.user.role !== 'admin'){
    let ownerId = req.user.id
    if (req.user.role === 'manager'){
      const mgr = await User.findById(req.user.id).select('managerPermissions createdBy')
      if (!mgr || !mgr.managerPermissions?.canManageProducts){ return res.status(403).json({ message: 'Manager not allowed to manage products' }) }
      ownerId = String(mgr.createdBy || req.user.id)
    }
    if (String(prod.createdBy) !== String(ownerId)) return res.status(403).json({ message: 'Not allowed' })
  }
  await Product.deleteOne({ _id: id })
  res.json({ message: 'Deleted' })
})

// Generate product description using Gemini AI
router.post('/generate-description', auth, allowRoles('admin','user','manager'), async (req, res) => {
  try {
    const { productName, category, additionalInfo } = req.body

    if (!productName || !category) {
      return res.status(400).json({ 
        message: 'Product name and category are required' 
      })
    }

    if (!geminiService.isAvailable()) {
      return res.status(503).json({ 
        message: 'AI service is not available. Please check API configuration.' 
      })
    }

    const description = await geminiService.generateProductDescription(
      productName, 
      category, 
      additionalInfo || ''
    )

    const tags = await geminiService.generateProductTags(
      productName, 
      category, 
      description.description
    )

    res.json({
      success: true,
      data: {
        ...description,
        tags
      }
    })
  } catch (error) {
    console.error('Generate description error:', error)
    res.status(500).json({ 
      message: error.message || 'Failed to generate product description' 
    })
  }
})

// Get available product categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      'Skincare',
      'Haircare', 
      'Bodycare',
      'Makeup',
      'Fragrance',
      'Health & Wellness',
      'Baby Care',
      'Men\'s Grooming',
      'Tools & Accessories',
      'Gift Sets',
      'Other'
    ]

    res.json({
      success: true,
      categories
    })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ 
      message: 'Failed to fetch categories' 
    })
  }
})

export default router
