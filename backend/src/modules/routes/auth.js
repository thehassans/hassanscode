import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import rateLimit from '../middleware/rateLimit.js';

// Use a default secret in development so the app works without .env
const SECRET = process.env.JWT_SECRET || 'devsecret-change-me';

const router = Router();

// Seed an initial admin if none exists (dev helper)
router.post('/seed-admin', async (req, res) => {
  const { firstName = 'Super', lastName = 'Admin', email = 'admin@local', password = 'admin123' } = req.body || {};
  const existing = await User.findOne({ role: 'admin' });
  if (existing) return res.json({ message: 'Admin already exists' });
  const admin = new User({ firstName, lastName, email, password, role: 'admin' });
  await admin.save();
  return res.json({ message: 'Admin created', admin: { id: admin._id, email: admin.email } });
});

// Dev helper: ensure an admin exists and return a ready-to-use token
router.post('/seed-admin-login', async (req, res) => {
  const { firstName = 'Super', lastName = 'Admin', email = 'admin@local', password = 'admin123' } = req.body || {};
  let admin = await User.findOne({ role: 'admin' });
  if (!admin){
    admin = new User({ firstName, lastName, email, password, role: 'admin' });
    await admin.save();
  }
  const token = jwt.sign({ id: admin._id, role: admin.role, firstName: admin.firstName, lastName: admin.lastName }, SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: admin._id, role: admin.role, firstName: admin.firstName, lastName: admin.lastName, email: admin.email } });
})

router.post('/login', rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
  try{
    let { email, password, loginType } = req.body || {};
    const e = String(email || '').trim().toLowerCase();
    const p = String(password || '').trim();
    if (!e || !p) return res.status(400).json({ message: 'Invalid credentials' });

    // Primary: normalized lookup
    let user = await User.findOne({ email: e });
    // Fallback: case-insensitive exact match (helps legacy data where email wasn't normalized)
    if (!user){
      try{
        const esc = e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        user = await User.findOne({ email: new RegExp('^'+esc+'$', 'i') });
      }catch{}
    }
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check if this is a customer login and user has appropriate role
    if (loginType === 'customer' && user.role !== 'customer') {
      return res.status(403).json({ message: 'Please use the staff login portal' });
    }

    let ok = await user.comparePassword(p);
    if (!ok){
      // Transitional support: if the stored password appears to be plaintext and matches, rehash it now
      try{
        const looksHashed = typeof user.password === 'string' && /^\$2[aby]\$/.test(user.password);
        if (!looksHashed && user.password === p){
          user.password = p; // triggers pre-save hook to bcrypt-hash
          await user.save();
          ok = true;
        }
      }catch{}
    }
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role, firstName: user.firstName, lastName: user.lastName }, SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user._id, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email } });
  }catch(err){
    try{ console.error('[auth/login] error', err?.message || err) }catch{}
    return res.status(500).json({ message: 'Login failed' })
  }
});

// Registration endpoint for customers
router.post('/register', rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, country, role = 'customer' } = req.body || {};
    
    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    
    // Only allow customer registration through this endpoint
    if (role !== 'customer') {
      return res.status(400).json({ message: 'Invalid registration type' });
    }
    
    // Create new user
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password,
      phone: phone?.trim() || '',
      country: country || 'UAE',
      role: 'customer'
    });
    
    await user.save();
    
    // Generate token for auto-login
    const token = jwt.sign(
      { id: user._id, role: user.role, firstName: user.firstName, lastName: user.lastName },
      SECRET,
      { expiresIn: '7d' }
    );
    
    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (err) {
    console.error('[auth/register] error', err?.message || err);
    return res.status(500).json({ message: 'Registration failed' });
  }
});

export default router;
