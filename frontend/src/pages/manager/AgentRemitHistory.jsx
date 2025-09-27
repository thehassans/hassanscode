import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../api.js'

export default function AgentRemitHistory(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ (async()=>{ try{ const r = await apiGet('/api/finance/agent-remittances'); const arr = Array.isArray(r?.remittances)? r.remittances:[]; setItems(arr.filter(x=> String(x.status||'').toLowerCase()==='sent')) }catch{ setItems([]) } finally{ setLoading(false) } })() },[])
  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header" style={{alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Agent Remittances • History</div>
          <div className="page-subtitle">Completed agent payouts</div>
        </div>
        <Link to="/manager/finances" className="btn light small">Back to Finances</Link>
      </div>
      <div className="card">
        <div className="section" style={{display:'grid', gap:8}}>
          {loading ? <div className="helper">Loading…</div> : items.length===0 ? <div className="empty-state">No sent agent remittances</div> : (
            <div className="table">
              <div className="thead">
                <div className="tr">
                  <div className="th">Date</div>
                  <div className="th">Agent</div>
                  <div className="th">Amount (PKR)</div>
                  <div className="th">Status</div>
                </div>
              </div>
              <div className="tbody">
                {items.map(it => (
                  <div className="tr" key={String(it._id||it.id)}>
                    <div className="td">{it?.sentAt? new Date(it.sentAt).toLocaleString(): (it?.approvedAt? new Date(it.approvedAt).toLocaleString(): (it?.createdAt? new Date(it.createdAt).toLocaleString(): ''))}</div>
                    <div className="td">{`${it?.agent?.firstName||''} ${it?.agent?.lastName||''}`.trim()||'Agent'}</div>
                    <div className="td">{Number(it?.amount||0).toFixed(2)}</div>
                    <div className="td">{it?.status||'-'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
