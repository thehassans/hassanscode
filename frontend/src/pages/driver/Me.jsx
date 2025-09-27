import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch } from '../../api.js'

export default function DriverMe(){
  const [me, setMe] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} }
  })
  const [theme, setTheme] = useState(()=>{ try{ return localStorage.getItem('theme') || 'dark' }catch{ return 'dark' } })
  const [perf, setPerf] = useState({ assigned:0, delivered:0, cancelled:0, returned:0, inTransit:0, totalCollected:0 })
  const [loading, setLoading] = useState(true)
  const [changingPass, setChangingPass] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(()=>{
    try{ localStorage.setItem('theme', theme) }catch{}
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
  }, [theme])

  useEffect(()=>{
    let alive = true
    ;(async ()=>{
      try{ const r = await apiGet('/api/users/me'); if (!alive) return; setMe(r?.user||{}) }catch{}
      try{ const p = await apiGet('/api/users/drivers/me/performance'); if (!alive) return; setPerf(p||{}) }catch{}
      setLoading(false)
    })()
    return ()=>{ alive = false }
  },[])

  const fullName = `${me.firstName||''} ${me.lastName||''}`.trim() || 'Driver'

  async function changePassword(e){
    e?.preventDefault?.()
    if (!currentPassword || !newPassword){ alert('Please fill all fields'); return }
    if (newPassword.length < 6){ alert('New password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword){ alert('New password and confirmation do not match'); return }
    setChangingPass(true)
    try{
      await apiPatch('/api/users/me/password', { currentPassword, newPassword })
      alert('Password updated successfully')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPassModal(false)
    }catch(err){ alert(err?.message || 'Failed to change password') }
    finally{ setChangingPass(false) }
  }

  return (
    <div className="content" style={{ display:'grid', gap:16, padding:16, maxWidth:900, margin:'0 auto' }}>
      <div style={{ display:'grid', gap:6 }}>
        <div style={{ fontWeight:800, fontSize:20 }}>My Profile</div>
        <div className="helper">View your stats and manage personal settings.</div>
      </div>

      {/* Driver Details */}
      <div className="panel" style={{ display:'grid', gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:56, height:56, borderRadius:999, background:'var(--panel-2)', display:'grid', placeItems:'center', fontWeight:800, fontSize:20 }}>
            {((me.firstName||'D')[0]||'D').toUpperCase()}
          </div>
          <div style={{ display:'grid', gap:4 }}>
            <div style={{ fontWeight:800, fontSize:18 }}>{fullName}</div>
            <div className="helper" style={{ fontSize:14 }}>{me.email || ''}</div>
            {me.phone && <div className="helper" style={{ fontSize:14 }}>{me.phone}</div>}
          </div>
        </div>

        {/* Performance quick stats */}
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
          <div className="card" style={{ padding:14, display:'grid', gap:6 }}>
            <div className="helper">Total Delivered</div>
            <div style={{ fontWeight:800, fontSize:22, color:'var(--success)' }}>{perf.delivered||0}</div>
          </div>
          <div className="card" style={{ padding:14, display:'grid', gap:6 }}>
            <div className="helper">Total Collected</div>
            <div style={{ fontWeight:800, fontSize:22 }}>{Number(perf.totalCollected||0).toFixed(2)}</div>
          </div>
          <div className="card" style={{ padding:14, display:'grid', gap:6 }}>
            <div className="helper">Assigned</div>
            <div style={{ fontWeight:800, fontSize:22 }}>{perf.assigned||0}</div>
          </div>
          <div className="card" style={{ padding:14, display:'grid', gap:6 }}>
            <div className="helper">In Transit</div>
            <div style={{ fontWeight:800, fontSize:22 }}>{perf.inTransit||0}</div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="panel" style={{ display:'grid', gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span aria-hidden style={{ color:'var(--muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 4 0v.09c0 .67.39 1.28 1 1.57h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0c.3.61.91 1 1.58 1H21a2 2 0 0 1 0 4h-.09c-.67 0-1.28.39-1.57 1z"/></svg>
          </span>
          <div style={{ fontWeight:800 }}>Settings</div>
        </div>

        <div style={{ display:'grid', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:24, height:24, borderRadius:4, background:'var(--accent)', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/></svg>
              </div>
              <div>
                <div style={{ fontWeight:600 }}>Theme</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>Choose your preferred theme</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button type="button" className={`btn small ${theme==='light'?'success':'secondary'}`} onClick={()=> setTheme('light')}>Light</button>
              <button type="button" className={`btn small ${theme==='dark'?'success':'secondary'}`} onClick={()=> setTheme('dark')}>Dark</button>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:24, height:24, borderRadius:4, background:'var(--danger)', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <div style={{ fontWeight:600 }}>Security</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>Update your password</div>
              </div>
            </div>
            <button type="button" className="btn small secondary" onClick={()=>{ setShowPassModal(true); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}>Change Password</button>
          </div>
        </div>
      </div>

      {showPassModal && (
        <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9999, display:'grid', placeItems:'center' }}>
          <div className="card" role="dialog" aria-modal="true" style={{ width:'min(520px, 96vw)', padding:16, display:'grid', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:800 }}>Change Password</div>
              <button className="btn secondary" onClick={()=> setShowPassModal(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={changePassword} style={{ display:'grid', gap:8 }}>
              <input className="input" placeholder="Current password" type="password" value={currentPassword} onChange={e=> setCurrentPassword(e.target.value)} />
              <input className="input" placeholder="New password" type="password" value={newPassword} onChange={e=> setNewPassword(e.target.value)} />
              <input className="input" placeholder="Confirm new password" type="password" value={confirmPassword} onChange={e=> setConfirmPassword(e.target.value)} />
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
                <button type="button" className="btn secondary" onClick={()=> setShowPassModal(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={changingPass}>{changingPass? (<span><span className="spinner"/> Saving…</span>): 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
