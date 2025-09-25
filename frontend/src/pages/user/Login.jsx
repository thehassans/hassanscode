import React, { useEffect, useState } from 'react'
import PasswordInput from '../../components/PasswordInput.jsx'
import { API_BASE, apiGet, apiPost } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'

export default function UserLogin(){
  const toast = useToast()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [health, setHealth] = useState({ ok:false, dbLabel:'unknown' })
  const [branding, setBranding] = useState({ headerLogo: null, loginLogo: null })

  // Health check with backoff; stop once healthy
  useEffect(()=>{
    let cancelled = false
    let attempt = 0
    const delays = [3000, 7000, 15000, 30000]
    async function run(){
      try{
        const j = await apiGet('/api/health')
        if (cancelled) return
        const dbLabel = j?.db?.label || 'unknown'
        const ok = j?.status === 'ok'
        setHealth({ ok, dbLabel })
        if (!ok){
          const d = delays[Math.min(attempt, delays.length-1)]
          attempt++
          setTimeout(()=>{ if(!cancelled) run() }, d)
        }
      }catch{
        if (cancelled) return
        setHealth({ ok:false, dbLabel:'unreachable' })
        const d = delays[Math.min(attempt, delays.length-1)]
        attempt++
        setTimeout(()=>{ if(!cancelled) run() }, d)
      }
    }
    run()
    return ()=>{ cancelled = true }
  },[])

  // Load branding (public, no auth needed)
  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try{
        const j = await apiGet('/api/settings/branding')
        if (!cancelled) setBranding({ headerLogo: j.headerLogo||null, loginLogo: j.loginLogo||null })
      }catch{ /* ignore */ }
    })()
    return ()=>{ cancelled = true }
  },[])

  async function login(e){
    e.preventDefault()
    setLoading(true)
    try{
      const data = await apiPost('/api/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('me', JSON.stringify(data.user))
      if (data.user.role === 'admin') location.href = '/admin'
      else if (data.user.role === 'agent') location.href = '/agent'
      else if (data.user.role === 'manager') location.href = '/manager'
      else if (data.user.role === 'investor') location.href = '/investor'
      else if (data.user.role === 'driver') location.href = '/driver'
      else location.href = '/user'
    }catch(e){
      const status = e?.status
      const msg = String(e?.message || '')
      if (status === 429){
        toast.info('Too many requests. Please wait a few seconds and try again.')
      } else if (status === 400 || /invalid|incorrect|credentials|password|email/i.test(msg)){
        toast.error('Incorrect email or password')
      } else {
        toast.error(msg || 'Login failed')
      }
    }finally{ setLoading(false) }
  }

  return (
    <div className="min-h-[100dvh] grid grid-rows-[auto_1fr] animated-gradient">
      {/* Header bar transparent on login to reveal gradient */}
      <div className="header flex items-center justify-center py-2" style={{ background:'transparent', borderBottom:'1px solid transparent' }}>
        {/* Brand removed per request to keep header clean on login */}
      </div>

      {/* Main content */}
      <div className="grid place-items-center p-6">
        <form onSubmit={login} className="card w-full max-w-md grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)]" aria-busy={loading}>
          <div className="grid place-items-center gap-2">
            {(()=>{
              const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
              const src = branding.loginLogo ? `${API_BASE}${branding.loginLogo}` : fallback
              return <img src={src} alt="BuySial" className="w-16 h-16 rounded-xl object-contain bg-white"/>
            })()}
            <div className="page-title gradient heading-brand text-[28px] tracking-tight">Welcome</div>
            <div className="helper text-center">Sign in to access your dashboard</div>
          </div>

          <div>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@buysial.com" autoComplete="email" required/>
          </div>
          <div>
            <div className="label">Password</div>
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password"/>
          </div>
          <div className="text-right mt-0.5">
            <a className="text-sm text-slate-500 hover:text-slate-700 underline-offset-4 hover:underline dark:text-slate-400 dark:hover:text-slate-200" href="#" onClick={(e)=>{e.preventDefault(); toast.info('Forgot password coming soon') }}>Forgot password?</a>
          </div>

          <button className="btn w-full mt-1.5" disabled={loading}>
            {loading ? (<><span className="spinner mr-2 align-middle"></span>Signing in…</>) : 'Login'}
          </button>

          <div className="mt-2 grid gap-1.5">
            {(()=>{
              const dbLabel = String(health.dbLabel||'').toLowerCase()
              const allGood = health.ok && dbLabel === 'connected'
              if (allGood) return null
              const apiLabel = health.ok ? 'ok' : 'down'
              const statusText = `API: ${apiLabel} · DB: ${health.dbLabel || 'unknown'}`
              return (
                <div className="flex justify-center">
                  <button type="button" className="btn danger" title={statusText} onClick={()=>window.location.reload()}>
                    Connection issue
                  </button>
                </div>
              )
            })()}
          </div>
        </form>
      </div>
    </div>
  )
}
