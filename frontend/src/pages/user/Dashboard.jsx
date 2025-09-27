import React, { useEffect, useState } from 'react'
import MetricCard from '../../components/MetricCard.jsx'
import Chart from '../../components/Chart.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'

const OrderStatusPie = ({ metrics }) => {
  const data = [
    { label: 'Pending', value: metrics.pendingOrders, color: '#F59E0B' },
    { label: 'Out for Delivery', value: metrics.outForDelivery, color: '#3B82F6' },
    { label: 'Delivered', value: metrics.deliveredOrders, color: '#10B981' },
    { label: 'Cancelled', value: metrics.cancelledOrders, color: '#EF4444' },
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <div>No orders</div>;
  let cumulative = 0;
  const gradient = data.map(item => {
    const percentage = (item.value / total) * 360;
    const start = cumulative;
    cumulative += percentage;
    return `${item.color} ${start}deg ${cumulative}deg`;
  }).join(', ');
  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{width: 200, height: 200, borderRadius: '50%', background: `conic-gradient(${gradient})`}}></div>
      <div style={{marginLeft: 20}}>
        {data.map((item, idx) => (
          <div key={idx} style={{display: 'flex', alignItems: 'center'}}>
            <div style={{width: 12, height: 12, background: item.color, marginRight: 8}}></div>
            <span>{item.label}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function UserDashboard(){
  const toast = useToast()
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalOrders: 0,
    pendingOrders: 0,
    outForDelivery: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalProductsInHouse: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    totalExpense: 0,
  })
  const me = JSON.parse(localStorage.getItem('me')||'{}')
  const [analytics, setAnalytics] = useState(null)
  const [salesByCountry, setSalesByCountry] = useState({ KSA:0, Oman:0, UAE:0, Bahrain:0, Other:0 })
  const [orders, setOrders] = useState([])
  async function load(){
    try{ setAnalytics(await apiGet('/api/orders/analytics/last7days')) }catch(_e){ setAnalytics({ days: [], totals:{} }) }
    try{ setMetrics(await apiGet('/api/reports/user-metrics')) }catch(_e){ console.error('Failed to fetch metrics') }
    try{ setSalesByCountry(await apiGet('/api/reports/user-metrics/sales-by-country')) }catch(_e){ setSalesByCountry({ KSA:0, Oman:0, UAE:0, Bahrain:0, Other:0 }) }
    try{ const res = await apiGet('/api/orders'); setOrders(Array.isArray(res?.orders) ? res.orders : []) }catch(_e){ setOrders([]) }
  }
  useEffect(()=>{ load() },[])
  // Live updates via socket
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
      socket.on('orders.changed', (payload={})=>{
        load()
        try{
          const { orderId, action, status } = payload
          let msg = null
          if (action === 'delivered') msg = `Order #${String(orderId||'').slice(-6)} delivered`
          else if (action === 'assigned') msg = `Order #${String(orderId||'').slice(-6)} assigned`
          else if (action === 'cancelled') msg = `Order #${String(orderId||'').slice(-6)} cancelled`
          else if (action === 'shipment_updated'){
            const label = (status === 'picked_up') ? 'picked up' : (String(status||'').replace('_',' '))
            msg = `Shipment ${label} (#${String(orderId||'').slice(-6)})`
          }
          if (msg) toast.info(msg)
        }catch{}
      })
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[toast])

  // Recent order history: delivered or cancelled
  const orderHistory = React.useMemo(()=>{
    const list = Array.isArray(orders) ? orders : []
    const hist = list.filter(o => ['delivered','cancelled'].includes(String(o?.shipmentStatus||'').toLowerCase()))
    hist.sort((a,b)=> new Date(b.deliveredAt || b.updatedAt || b.createdAt) - new Date(a.deliveredAt || a.updatedAt || a.createdAt))
    return hist.slice(0, 12)
  }, [orders])
  return (
    <div className="container">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Dashboard</div>
          <div className="page-subtitle">Your business at a glance</div>
        </div>
      </div>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
        <MetricCard title="Total Sales" value={metrics.totalSales} icon="💰" />
        <MetricCard title="Total Orders" value={metrics.totalOrders} icon="🧾" />
        <MetricCard title="Pending Orders" value={metrics.pendingOrders} icon="⏳" />
        <MetricCard title="Out for Delivery" value={metrics.outForDelivery} icon="🚚" />
        <MetricCard title="Delivered Orders" value={metrics.deliveredOrders} icon="✅" />
        <MetricCard title="Cancelled Orders" value={metrics.cancelledOrders} icon="❌" />
        <MetricCard title="Total Products In House" value={metrics.totalProductsInHouse} icon="🏠" />
        <MetricCard title="Total Deposit" value={metrics.totalDeposit} icon="📥" />
        <MetricCard title="Total Withdraw" value={metrics.totalWithdraw} icon="📤" />
        <MetricCard title="Total Expense" value={metrics.totalExpense} icon="💸" />
      </div>
      {/* Sales by Country */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#4f46e5,#06b6d4)',display:'grid',placeItems:'center',color:'#fff',fontWeight:800}}>🌍</div>
            <div>
              <div style={{fontWeight:800}}>Sales by Country</div>
              <div className="helper">Workspace delivered sales totals</div>
            </div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in KSA" value={salesByCountry.KSA||0} icon="🇸🇦" />
          <MetricCard title="Sales in Oman" value={salesByCountry.Oman||0} icon="🇴🇲" />
          <MetricCard title="Sales in UAE" value={salesByCountry.UAE||0} icon="🇦🇪" />
          <MetricCard title="Sales in Bahrain" value={salesByCountry.Bahrain||0} icon="🇧🇭" />
        </div>
      </div>
      <div style={{marginTop:12}}>
        <Chart analytics={analytics} />
      </div>
      <div style={{marginTop:12}}>
        <OrderStatusPie metrics={metrics} />
      </div>

      {/* Recent Order History */}
      <div className="card" style={{marginTop:12, display:'grid', gap:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#10b981,#059669)',display:'grid',placeItems:'center',color:'#fff',fontWeight:800}}>📜</div>
            <div>
              <div style={{fontWeight:800}}>Recent Order History</div>
              <div className="helper">Delivered or Cancelled</div>
            </div>
          </div>
        </div>
        {orderHistory.length === 0 ? (
          <div className="empty-state">No delivered or cancelled orders yet</div>
        ) : (
          <div style={{display:'grid', gap:8}}>
            {orderHistory.map(o => {
              const id = String(o?._id || o?.id || '')
              const code = o?.invoiceNumber ? `#${o.invoiceNumber}` : `#${id.slice(-6)}`
              const st = String(o?.shipmentStatus||'').toLowerCase()
              const when = o?.deliveredAt || o?.updatedAt || o?.createdAt
              const whenStr = when ? new Date(when).toLocaleString() : ''
              const color = st==='delivered' ? '#10b981' : (st==='cancelled' ? '#ef4444' : 'var(--fg)')
              return (
                <div key={id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, background:'var(--panel)'}}>
                  <div style={{display:'grid'}}>
                    <div style={{fontWeight:700}}>{code} • <span style={{opacity:.9}}>{o?.customerName || 'Customer'}</span></div>
                    <div className="helper" style={{fontSize:12}}>{whenStr}</div>
                  </div>
                  <div className="chip" style={{background:'transparent', border:`1px solid ${color}`, color}}>{st.replace('_',' ')}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
