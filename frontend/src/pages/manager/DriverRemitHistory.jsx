import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../api.js'

export default function DriverRemitHistory(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ (async()=>{ try{ const r = await apiGet('/api/finance/remittances'); const arr = Array.isArray(r?.remittances)? r.remittances:[]; setItems(arr.filter(x=> String(x.status||'').toLowerCase()==='accepted')) }catch{ setItems([]) } finally{ setLoading(false) } })() },[])
  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header" style={{alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <div className="page-title">Drivers Remittances • History</div>
          <div className="page-subtitle">Accepted driver remittances</div>
        </div>
        <Link to="/manager/finances" className="btn light small">Back to Finances</Link>
      </div>
      <div className="card">
        <div className="section" style={{display:'grid', gap:8}}>
          {loading ? <div className="helper">Loading…</div> : items.length===0 ? <div className="empty-state">No accepted remittances</div> : (
            <div className="table">
              <div className="thead">
                <div className="tr">
                  <div className="th">Date</div>
                  <div className="th">Driver</div>
                  <div className="th">Country</div>
                  <div className="th">Delivered</div>
                  <div className="th">Amount</div>
                </div>
              </div>
              <div className="tbody">
                {items.map(it => (
                  <div className="tr" key={String(it._id||it.id)}>
                    <div className="td">{it?.acceptedAt? new Date(it.acceptedAt).toLocaleString(): (it?.createdAt? new Date(it.createdAt).toLocaleString(): '')}</div>
                    <div className="td">{`${it?.driver?.firstName||''} ${it?.driver?.lastName||''}`.trim()||'Driver'}</div>
                    <div className="td">{it?.country||'-'}</div>
                    <div className="td">{it?.totalDeliveredOrders||0}</div>
                    <div className="td">{(it?.currency||'') + ' ' + Number(it?.amount||0).toFixed(2)}</div>
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
