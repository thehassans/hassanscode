import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiPost, apiGet, API_BASE } from '../../api'
import { useToast } from '../../ui/Toast'
import PasswordInput from '../../components/PasswordInput'

export default function CustomerLogin() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [branding, setBranding] = useState({ headerLogo: null, loginLogo: null })

  // Load branding
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await apiGet('/api/settings/branding')
        if (!cancelled) setBranding({ headerLogo: j.headerLogo || null, loginLogo: j.loginLogo || null })
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!password) {
      toast.error('Password is required')
      return
    }

    setLoading(true)
    try {
      const data = await apiPost('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
        loginType: 'customer' // Specify this is a customer login
      })
      
      localStorage.setItem('token', data.token)
      localStorage.setItem('me', JSON.stringify(data.user))
      
      toast.success('Welcome back!')
      
      // Redirect to catalog for customers
      window.location.href = '/catalog'
    } catch (err) {
      const status = err?.status
      const msg = String(err?.message || '')
      
      if (status === 401) {
        toast.error('Invalid email or password')
      } else if (status === 403) {
        toast.error('Account access restricted. Please contact support.')
      } else {
        toast.error(msg || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] grid grid-rows-[auto_1fr] animated-gradient">
      {/* Header */}
      <div className="header flex items-center justify-between py-4 px-6" style={{ background: 'rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <Link to="/catalog" className="flex items-center gap-2 text-white hover:text-orange-200 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Catalog
        </Link>
        <Link to="/register" className="text-white hover:text-orange-200 transition-colors font-medium">
          New customer? Create Account
        </Link>
      </div>

      {/* Main content */}
      <div className="grid place-items-center p-6">
        <form onSubmit={handleSubmit} className="card w-full max-w-md grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)]" aria-busy={loading}>
          {/* Header */}
          <div className="grid place-items-center gap-2 mb-4">
            {(() => {
              const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
              const src = branding.loginLogo ? `${API_BASE}${branding.loginLogo}` : fallback
              return <img src={src} alt="BuySial" className="w-16 h-16 rounded-xl object-contain bg-white" />
            })()}
            <div className="page-title gradient heading-brand text-[28px] tracking-tight">Welcome Back</div>
            <div className="helper text-center">Sign in to your account</div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              autoComplete="current-password"
            />
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-orange-600 hover:text-orange-700">
              Forgot your password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-md transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 outline-none"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

          {/* Register Link */}
          <div className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-orange-600 hover:text-orange-700 font-medium">
              Create one here
            </Link>
          </div>

          {/* Admin/Staff Login */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Staff/Admin Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}