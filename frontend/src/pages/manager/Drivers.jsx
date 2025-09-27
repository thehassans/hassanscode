import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'

export default function ManagerDrivers(){
  // Remittances only
  const [remit, setRemit] = useState({ items: [], loading: false })

  // Currency formatter
  function fmtCurrency(ccy, amount){ try{ return `${ccy||''} ${Number(amount||0).toFixed(2)}` }catch{ return `${ccy||''} 0.00` } }

  // initial load is below after function definition

  async function acceptRemittance(id){
    try{ await apiPost(`/api/finance/remittances/${id}/accept`, {}); await loadRemittances() }catch(e){ alert(e?.message || 'Failed to accept') }
  }

  // Load remittances
  async function loadRemittances(){
    setRemit(r=>({ ...r, loading: true }))
    try{ const res = await apiGet('/api/finance/remittances'); setRemit({ items: Array.isArray(res?.remittances)? res.remittances:[], loading: false }) }
    catch{ setRemit({ items: [], loading: false }) }
  }
  useEffect(()=>{ loadRemittances() },[])

  // Real-time: refresh remittances
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
      const refreshRemit = ()=>{ loadRemittances() }
      socket.on('remittance.created', refreshRemit)
    }catch{}
    return ()=>{
      try{ socket && socket.off('remittance.created') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  function initials(name){ try{ return (name||'').split(' ').filter(Boolean).map(s=>s[0]).slice(0,2).join('').toUpperCase() }catch{ return '?' } }

  function waShareRemittance(r){
    const text = `Remittance Receipt\n\nDriver: ${r?.driver?.firstName||''} ${r?.driver?.lastName||''}\nCountry: ${r?.country||''}\nPeriod: ${(r?.fromDate? new Date(r.fromDate).toLocaleDateString():'-')} — ${(r?.toDate? new Date(r.toDate).toLocaleDateString():'-')}\nDeliveries: ${r?.totalDeliveredOrders||0}\nAmount: ${fmtCurrency(r?.currency, r?.amount)}\nStatus: ${r?.status||'-'}\nCreated: ${r?.createdAt? new Date(r.createdAt).toLocaleString(): ''}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    try{ window.open(url, '_blank', 'noopener,noreferrer') }catch{}
  }


  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Drivers • Remittances</div>
          <div className="page-subtitle">Review and accept remittances sent by drivers. Share receipt on WhatsApp.</div>
        </div>
      </div>

      {/* Remittances as Cards */}
      <div style={{display:'grid', gap:12}}>
        {remit.loading ? (
          <div className="card"><div className="section">Loading…</div></div>
        ) : remit.items.length === 0 ? (
          <div className="card"><div className="section">No remittance requests</div></div>
        ) : (
          remit.items.map(r => {
            const name = `${r?.driver?.firstName||''} ${r?.driver?.lastName||''}`.trim()
            const initialsText = initials(name || 'Driver')
            const isPending = String(r?.status||'').toLowerCase() === 'pending'
            return (
              <div key={String(r._id||r.id)} className="card" style={{display:'grid', gap:10}}>
                <div className="card-header" style={{alignItems:'center'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div style={{width:36, height:36, borderRadius:'50%', background:'var(--panel)', border:'1px solid var(--border)', display:'grid', placeItems:'center', fontWeight:800}} aria-hidden>{initialsText}</div>
                    <div style={{display:'grid'}}>
                      <div style={{fontWeight:800}}>{name || 'Driver'}</div>
                      <div style={{display:'flex', gap:6, alignItems:'center'}}>
                        <span className="badge">{r?.country||'-'}</span>
                        <span className="chip" style={{background:'transparent', border:'1px solid var(--border)'}}>Delivered: {r?.totalDeliveredOrders||0}</span>
                        <span className="chip" style={{border:`1px solid ${isPending?'#f59e0b':'#10b981'}`, color:isPending?'#b45309':'#0f766e', background:'transparent'}}>{isPending? 'Pending' : 'Accepted'}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="card-title" style={{margin:0}}>{fmtCurrency(r?.currency, r?.amount)}</div>
                    <div className="helper">{r?.createdAt? new Date(r.createdAt).toLocaleString(): ''}</div>
                  </div>
                </div>
                <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8}}>
                  <div>
                    <div className="label">Period</div>
                    <div className="helper">{r?.fromDate? new Date(r.fromDate).toLocaleDateString():'-'} — {r?.toDate? new Date(r.toDate).toLocaleDateString():'-'}</div>
                  </div>
                  <div>
                    <div className="label">Driver</div>
                    <div className="helper">{name || '-'}</div>
                  </div>
                  <div>
                    <div className="label">Status</div>
                    <div className="helper">{r?.status||'-'}</div>
                  </div>
                </div>
                <div className="section" style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                  {isPending ? (
                    <button className="btn" onClick={()=> acceptRemittance(String(r._id||r.id))}>Accept</button>
                  ) : null}
                  <button className="btn secondary" title="Share on WhatsApp" onClick={()=> waShareRemittance(r)} style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-hidden><path d="M20.52 3.48A11.82 11.82 0 0 0 .155 18.07L0 24l5.93-1.56A11.82 11.82 0 0 0 12.02 24c6.56 0 11.87-5.31 11.87-11.87 0-3.18-1.24-6.16-3.37-8.39zm-8.5 19.33c-1.95 0-3.85-.51-5.52-1.47l-.4-.24-3.51.93.94-3.43-.26-.42a9.7 9.7 0 0 1-1.47-5.17c0-5.38 4.37-9.75 9.75-9.75 2.61 0 5.06 1.02 6.91 2.87a9.65 9.65 0 0 1 2.84 6.88c0 5.38-4.37 9.75-9.75 9.75zm5.74-7.3c-.31-.16-1.82-.91-2.1-1.02-.28-.1-.48-.16-.68.16-.2.3-.78.96-.96 1.16-.18.2-.36.22-.66.08-.3-.14-1.29-.47-2.46-1.49-.91-.81-1.53-1.8-1.71-2.1-.18-.3-.02-.46.14-.62.14-.14.3-.36.46-.56.15-.2.2-.3.3-.5.1-.2.05-.38-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.64-.52-.55-.72-.56-.18-.01-.4-.02-.61-.02-.21 0-.56.08-.86.38-.3.3-1.13 1.1-1.13 2.68 0 1.58 1.12 3.1 1.28 3.31.16.2 2.22 3.4 5.35 4.76.75.33 1.34.53 1.8.68.76.24 1.45.21 2.01.13.61-.09 1.87-.77 2.13-1.52.26-.75.26-1.36.18-1.56-.08-.2-.29-.31-.6-.47z"/></svg>
                    Share
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
