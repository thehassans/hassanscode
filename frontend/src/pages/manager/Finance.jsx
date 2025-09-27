import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api.js'
import { io } from 'socket.io-client'

export default function ManagerFinance(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  async function load(){
    setLoading(true)
    try{ const r = await apiGet('/api/finance/agent-remittances'); setItems(Array.isArray(r?.remittances)? r.remittances:[]) }catch{ setItems([]) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() },[])

  // live updates for new and status changes
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const refresh = ()=> { try{ load() }catch{} }
      socket.on('agentRemit.created', refresh)
      socket.on('agentRemit.approved', refresh)
      socket.on('agentRemit.sent', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('agentRemit.created') }catch{}
      try{ socket && socket.off('agentRemit.approved') }catch{}
      try{ socket && socket.off('agentRemit.sent') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  async function approve(id){
    try{ setBusyId(id); await apiPost(`/api/finance/agent-remittances/${id}/approve`, {}); await load() }catch(e){ alert(e?.message||'Failed to approve') } finally{ setBusyId('') }
  }
  async function markSent(id){
    try{ setBusyId(id); await apiPost(`/api/finance/agent-remittances/${id}/send`, {}); await load() }catch(e){ alert(e?.message||'Failed to mark as sent') } finally{ setBusyId('') }
  }

  function waShare(item){
    const phone = String(item?.agent?.phone||'').replace(/[^\d+]/g,'')
    const name = `${item?.agent?.firstName||''} ${item?.agent?.lastName||''}`.trim()
    const text = encodeURIComponent(`Hi ${name||'Agent'}, your payout request of PKR ${Number(item.amount||0).toFixed(2)} is ${item.status==='approved'?'approved':'sent'}.`)
    if (phone) window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  function Badge({ status }){
    const s = String(status||'').toLowerCase()
    const style = s==='pending' ? {borderColor:'#f59e0b', color:'#b45309'} : (s==='approved' ? {borderColor:'#3b82f6', color:'#1d4ed8'} : {borderColor:'#10b981', color:'#065f46'})
    const label = s==='pending' ? 'Pending' : (s==='approved' ? 'Approved' : 'Sent')
    return <span className="badge" style={style}>{label}</span>
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title">Finance</div>
          <div className="page-subtitle">Manage Agent Remittance Requests</div>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header">
          <div className="card-title">Agent Requests</div>
          <div className="card-subtitle">Approve first, then mark as sent. Use WhatsApp to notify agent.</div>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          {loading ? (
            <div className="helper">Loading…</div>
          ) : items.length===0 ? (
            <div className="empty-state">No requests</div>
          ) : (
            items.map(it => {
              const id = String(it._id||it.id)
              const name = `${it?.agent?.firstName||''} ${it?.agent?.lastName||''}`.trim() || 'Agent'
              const pending = String(it.status).toLowerCase()==='pending'
              const approved = String(it.status).toLowerCase()==='approved'
              const sent = String(it.status).toLowerCase()==='sent'
              return (
                <div key={id} className="panel" style={{display:'grid', gap:8, padding:12}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
                    <div style={{display:'grid', gap:4}}>
                      <div style={{fontWeight:800}}>{name}</div>
                      <div className="helper">Amount: PKR {Number(it.amount||0).toFixed(2)}</div>
                    </div>
                    <Badge status={it.status} />
                  </div>
                  <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                    <button className="btn secondary" disabled={!pending || busyId===id} onClick={()=> approve(id)}>{busyId===id? 'Working…':'Approve'}</button>
                    <button className="btn" disabled={!approved || busyId===id} onClick={()=> markSent(id)}>{busyId===id? 'Working…':'Mark as Sent'}</button>
                    <button className="btn light" onClick={()=> waShare(it)}>WhatsApp</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
