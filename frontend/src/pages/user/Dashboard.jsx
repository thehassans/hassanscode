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
  async function load(){
    try{ setAnalytics(await apiGet('/api/orders/analytics/last7days')) }catch(_e){ setAnalytics({ days: [], totals:{} }) }
    try{ setMetrics(await apiGet('/api/reports/user-metrics')) }catch(_e){ console.error('Failed to fetch metrics') }
  }
  useEffect(()=>{ load() },[])
  // Live updates via socket
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['websocket','polling'], auth: { token } })
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
      <div style={{marginTop:12}}>
        <Chart analytics={analytics} />
      </div>
      <div style={{marginTop:12}}>
        <OrderStatusPie metrics={metrics} />
      </div>
    </div>
  )
}
