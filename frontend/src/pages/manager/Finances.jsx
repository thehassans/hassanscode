import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiGet, apiPost } from '../../api.js'
import { io } from 'socket.io-client'

function Badge({ status }){
  const s = String(status||'').toLowerCase()
  const style = s==='pending' ? {borderColor:'#f59e0b', color:'#b45309'} : (s==='approved' || s==='accepted' ? {borderColor:'#3b82f6', color:'#1d4ed8'} : {borderColor:'#10b981', color:'#065f46'})
  const label = s==='pending' ? 'Pending' : (s==='approved' || s==='accepted' ? (s==='approved'?'Approved':'Accepted') : 'Sent')
  return <span className="badge" style={style}>{label}</span>
}

export default function ManagerFinances(){
  const [drv, setDrv] = useState({ items: [], loading: true })
  const [agt, setAgt] = useState({ items: [], loading: true, busyId:'' })

  async function loadDriverRemits(){
    try{ const r = await apiGet('/api/finance/remittances'); const items = Array.isArray(r?.remittances)? r.remittances:[]; setDrv({ items, loading:false }) }catch{ setDrv({ items:[], loading:false }) }
  }
  async function loadAgentRemits(){
    try{ const r = await apiGet('/api/finance/agent-remittances'); const items = Array.isArray(r?.remittances)? r.remittances:[]; setAgt(a=>({ ...a, items, loading:false })) }catch{ setAgt(a=>({ ...a, items:[], loading:false })) }
  }
  useEffect(()=>{ loadDriverRemits(); loadAgentRemits() },[])

  // live sockets
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const refreshDrivers = ()=>{ try{ loadDriverRemits() }catch{} }
      const refreshAgents = ()=>{ try{ loadAgentRemits() }catch{} }
      socket.on('remittance.created', refreshDrivers)
      socket.on('agentRemit.created', refreshAgents)
      socket.on('agentRemit.approved', refreshAgents)
      socket.on('agentRemit.sent', refreshAgents)
    }catch{}
    return ()=>{
      try{ socket && socket.off('remittance.created') }catch{}
      try{ socket && socket.off('agentRemit.created') }catch{}
      try{ socket && socket.off('agentRemit.approved') }catch{}
      try{ socket && socket.off('agentRemit.sent') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  // Actions
  async function acceptDriverRemit(id){ try{ await apiPost(`/api/finance/remittances/${id}/accept`,{}); await loadDriverRemits() }catch(e){ alert(e?.message||'Failed to accept') } }
  async function approveAgent(id){ try{ setAgt(a=>({ ...a, busyId:id })); await apiPost(`/api/finance/agent-remittances/${id}/approve`,{}); await loadAgentRemits() }catch(e){ alert(e?.message||'Failed to approve') } finally{ setAgt(a=>({ ...a, busyId:'' })) } }
  async function sendAgent(id){ try{ setAgt(a=>({ ...a, busyId:id })); await apiPost(`/api/finance/agent-remittances/${id}/send`,{}); await loadAgentRemits() }catch(e){ alert(e?.message||'Failed to mark as sent') } finally{ setAgt(a=>({ ...a, busyId:'' })) } }

  function waShareAgent(item){
    const phone = String(item?.agent?.phone||'').replace(/[^\d+]/g,'')
    const name = `${item?.agent?.firstName||''} ${item?.agent?.lastName||''}`.trim() || 'Agent'
    const text = encodeURIComponent(`Hi ${name}, your payout request of PKR ${Number(item.amount||0).toFixed(2)} is ${item.status==='approved'?'approved':'sent'}.`)
    if (phone) try{ window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer') }catch{}
  }
  function waShareDriver(r){
    const text = `Remittance Receipt\n\nDriver: ${r?.driver?.firstName||''} ${r?.driver?.lastName||''}\nCountry: ${r?.country||''}\nPeriod: ${(r?.fromDate? new Date(r.fromDate).toLocaleDateString():'-')} — ${(r?.toDate? new Date(r.toDate).toLocaleDateString():'-')}\nDeliveries: ${r?.totalDeliveredOrders||0}\nAmount: ${(r?.currency||'') + ' ' + Number(r?.amount||0).toFixed(2)}\nStatus: ${r?.status||'-'}\nCreated: ${r?.createdAt? new Date(r.createdAt).toLocaleString(): ''}`
    try{ window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer') }catch{}
  }

  const pendingDrivers = useMemo(()=> drv.items.filter(x=> String(x.status||'').toLowerCase()==='pending'), [drv.items])
  const actionableAgents = useMemo(()=> agt.items.filter(x=> ['pending','approved'].includes(String(x.status||'').toLowerCase())), [agt.items])

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span aria-hidden>{/* finance icon */}<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/></svg></span>
          <div>
            <div className="page-title">Finances</div>
            <div className="page-subtitle">Manage Driver and Agent remittances</div>
          </div>
        </div>
      </div>

      {/* Drivers Remittances */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div className="card-title">Drivers Remittances</div>
          <Link to="/manager/finances/history/drivers" className="btn light small">Go to history</Link>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          {drv.loading ? (
            <div className="helper">Loading…</div>
          ) : pendingDrivers.length===0 ? (
            <div className="empty-state">No pending driver remittances</div>
          ) : (
            pendingDrivers.map(r=>{
              const id = String(r._id||r.id)
              const name = `${r?.driver?.firstName||''} ${r?.driver?.lastName||''}`.trim() || 'Driver'
              return (
                <div key={id} className="panel" style={{display:'grid', gap:8, padding:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'grid', gap:2}}>
                      <div style={{fontWeight:800}}>{name}</div>
                      <div className="helper">Amount: {(r?.currency||'') + ' ' + Number(r?.amount||0).toFixed(2)}</div>
                    </div>
                    <Badge status={r.status} />
                  </div>
                  <div className="helper">Delivered Orders: {r?.totalDeliveredOrders||0} • Country: {r?.country||'-'}</div>
                  <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                    <button className="btn" onClick={()=> acceptDriverRemit(id)}>Accept</button>
                    <button className="btn secondary" onClick={()=> waShareDriver(r)}>WhatsApp</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Agent Remittances */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div className="card-title">Agent Remittances</div>
          <Link to="/manager/finances/history/agents" className="btn light small">Go to history</Link>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          {agt.loading ? (
            <div className="helper">Loading…</div>
          ) : actionableAgents.length===0 ? (
            <div className="empty-state">No pending/approved agent remittances</div>
          ) : (
            actionableAgents.map(it=>{
              const id = String(it._id||it.id)
              const name = `${it?.agent?.firstName||''} ${it?.agent?.lastName||''}`.trim() || 'Agent'
              const pending = String(it.status).toLowerCase()==='pending'
              const approved = String(it.status).toLowerCase()==='approved'
              const busy = agt.busyId===id
              return (
                <div key={id} className="panel" style={{display:'grid', gap:8, padding:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'grid', gap:2}}>
                      <div style={{fontWeight:800}}>{name}</div>
                      <div className="helper">Amount: PKR {Number(it?.amount||0).toFixed(2)}</div>
                    </div>
                    <Badge status={it.status} />
                  </div>
                  <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                    <button className="btn secondary" disabled={!pending || busy} onClick={()=> approveAgent(id)}>{busy? 'Working…':'Approve'}</button>
                    <button className="btn" disabled={!approved || busy} onClick={()=> sendAgent(id)}>{busy? 'Working…':'Mark as Sent'}</button>
                    <button className="btn light" onClick={()=> waShareAgent(it)}>WhatsApp</button>
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
