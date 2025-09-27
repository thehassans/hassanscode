import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet, API_BASE } from '../../api'

export default function PrintLabel(){
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const barcodeRef = useRef(null)
  const qrRef = useRef(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ const { order } = await apiGet(`/api/orders/${id}`); if(alive) setOrder(order) }catch{ if(alive) setOrder(null) } finally{ if(alive) setLoading(false) }
    })()
    return ()=>{ alive = false }
  }, [id])

  // Lazy-load JsBarcode and QRCode via CDN and render once order is ready
  useEffect(()=>{
    if (!order) return
    function loadScript(src){
      return new Promise((resolve, reject)=>{
        const s = document.createElement('script')
        s.src = src; s.async = true
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
      })
    }
    (async ()=>{
      try{
        if (!window.JsBarcode){ await loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js') }
        if (!window.QRCode){ await loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js') }
        const code = String(order.invoiceNumber || order._id || '').toUpperCase()
        try{ window.JsBarcode(barcodeRef.current, code, { format:'CODE128', displayValue: false, margin: 0, height: 40 }) }catch{}
        try{
          const url = `${window.location.origin}/label/${order._id}`
          window.QRCode.toCanvas(qrRef.current, url, { margin: 0, width: 110 })
        }catch{}
        // Auto open print dialog after a brief delay
        setTimeout(()=>{ try{ window.print() }catch{} }, 300)
      }catch{}
    })()
  }, [order])

  function fmt(n){ try{ return Number(n||0).toFixed(3) }catch{ return '0.000' } }
  function fmt2(n){ try{ return Number(n||0).toFixed(2) }catch{ return '0.00' } }

  if (loading){
    return (
      <div style={{display:'grid', placeItems:'center', minHeight:'100vh'}}>
        <div style={{display:'grid', gap:8, justifyItems:'center', color:'#9aa4b2'}}>
          <div className="spinner"/>
          <div>Preparing label…</div>
        </div>
      </div>
    )
  }
  if (!order){
    return <div style={{padding:20}}>Order not found</div>
  }

  const customerName = order.customerName || '-'
  const phoneFull = `${order.phoneCountryCode||''} ${order.customerPhone||''}`.trim()
  const whatsapp = phoneFull
  const addressLines = [order.customerArea, order.city, order.orderCountry].filter(Boolean).join(', ')
  const productName = order.productId?.name || (order.details ? order.details.slice(0,64) : '-')
  const qty = Number(order.quantity||1)
  const unit = (order.productId?.price != null) ? Number(order.productId.price) : undefined
  const total = (order.total!=null) ? Number(order.total) : (unit!=null ? unit*qty : undefined)
  const paymentMode = (Number(order.codAmount||0) > 0) ? 'COD' : 'PAID'
  const driverName = order.deliveryBoy ? `${order.deliveryBoy.firstName||''} ${order.deliveryBoy.lastName||''}`.trim() : '-'
  const codAmount = Number(order.codAmount||0)
  const invoice = String(order.invoiceNumber || order._id).toUpperCase()

  return (
    <div style={{display:'grid', placeItems:'center', padding:0}}>
      <style>{`
        @page { size: 6in 4in; margin: 0; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
        body, html, #root { background: #fff; }
        .label-6x4 { width: 6in; height: 4in; box-sizing: border-box; padding: 12px; color: #000; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        .grid { display: grid; gap: 6px; }
        .row { display:flex; justify-content:space-between; align-items:center; }
        .h { font-weight: 800; }
        .sec { border: 1px solid #000; border-radius: 4px; padding: 6px; }
        .title { font-size: 14px; font-weight: 800; text-decoration: underline; }
        .tbl { width: 100%; border-collapse: separate; border-spacing: 0; }
        .tbl th, .tbl td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; }
        .tbl th { background: #f3f4f6; }
        .badge { display:inline-block; padding:2px 6px; border:1px solid #000; border-radius: 4px; font-weight:700; }
        .muted { opacity: .85; }
      `}</style>
      <div className="label-6x4 grid">
        {/* Header row: brand and meta */}
        <div className="row">
          <div className="h" style={{display:'flex', alignItems:'center', gap:8}}>
            <img alt="Logo" src={`${API_BASE}/logo.png`} onError={(e)=>{e.currentTarget.style.display='none'}} style={{height:20}}/>
            <span>BuySial</span>
          </div>
          <div className="grid" style={{justifyItems:'end'}}>
            <div className="badge">{paymentMode}</div>
            <div className="muted" style={{fontSize:12}}>DATE: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Shipper Info */}
        <div className="sec grid">
          <div className="title">Shipper Information</div>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
            <div><strong>Name:</strong><div>{customerName}</div></div>
            <div><strong>Phone No:</strong><div>{phoneFull || '-'}</div></div>
            <div><strong>WhatsApp No:</strong><div>{whatsapp || '-'}</div></div>
          </div>
          <div><strong>Address:</strong> {addressLines || '-'}</div>
        </div>

        {/* Product Details */}
        <div className="sec grid">
          <div className="title">Product Details</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Product Name</th>
                <th style={{width:'70px'}}>Quantity</th>
                <th style={{width:'80px'}}>Price</th>
                <th style={{width:'80px'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{productName}</td>
                <td style={{textAlign:'center'}}>{qty}</td>
                <td style={{textAlign:'right'}}>{unit!=null ? fmt(unit) : '-'}</td>
                <td style={{textAlign:'right'}}>{total!=null ? fmt(total) : '-'}</td>
              </tr>
            </tbody>
          </table>
          <div className="row" style={{gap:6}}>
            <div className="badge">Total QTY {qty}</div>
            <div className="badge">Total Shipper 1</div>
            <div className="badge">Total Weight —</div>
          </div>
          <div className="row" style={{gap:8}}>
            <div><strong>Payment Mode:</strong> <span style={{marginLeft:6}}><input type="checkbox" checked={paymentMode==='COD'} readOnly/> COD <input style={{marginLeft:12}} type="checkbox" checked={paymentMode==='PAID'} readOnly/> PAID</span></div>
          </div>
        </div>

        {/* Footer grid: driver, COD, order no, barcode, QR, notes */}
        <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:8}}>
          <div className="sec" style={{display:'grid', gap:4}}>
            <div className="h">Assigned Driver</div>
            <div>{driverName || '-'}</div>
          </div>
          <div className="sec" style={{display:'grid', gap:4, justifyItems:'end'}}>
            <div className="h">COD AMOUNT</div>
            <div style={{fontSize:18, fontWeight:800}}>{fmt2(codAmount)}</div>
          </div>
          <div className="sec" style={{display:'grid', gap:6}}>
            <div className="h">Order No</div>
            <div>{invoice}</div>
          </div>
          <div className="sec" style={{display:'grid', gap:2, alignItems:'center', justifyItems:'center'}}>
            <svg ref={barcodeRef} style={{width:'100%', height:50}}/>
            <div style={{fontSize:10, opacity:0.8}}>Short barcode</div>
          </div>
          <div className="sec" style={{display:'grid', gap:4, alignItems:'center', justifyItems:'center'}}>
            <canvas ref={qrRef} width={110} height={110} />
            <div style={{fontSize:10, opacity:0.8}}>Scan QR to open</div>
          </div>
          <div className="sec" style={{display:'grid', gap:4}}>
            <div className="h">Note:</div>
            <div style={{minHeight:60}}>{order.deliveryNotes || '-'}</div>
          </div>
        </div>

        <div className="no-print" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button className="btn" onClick={()=> window.print()}>Print</button>
        </div>
      </div>
    </div>
  )
}
