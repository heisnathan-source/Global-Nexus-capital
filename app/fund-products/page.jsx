"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";

export default function Funds(){
 const [products,setProducts]=useState([]),[productId,setProductId]=useState(''),[amount,setAmount]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch('/api/fund-products').then(r=>r.json()).then(d=>{setProducts(d.products||[]);if(d.products?.[0])setProductId(String(d.products[0].id));}).catch(e=>setStatus(e.message));},[]);
 const product=products.find(p=>String(p.id)===String(productId));
 const calc=useMemo(()=>{const a=Number(amount),r=Number(product?.interest_rate);if(!product||!Number.isFinite(a)||a<=0||!Number.isFinite(r))return null;const interest=Math.round(a*r)/100;return {interest,maturity:a+interest};},[amount,product]);
 async function buy(){setStatus('');if(!product||!calc)return setStatus('Choose a product and enter a valid amount.');if(calc.maturity<=0)return; if(!window.confirm('Are you sure you wish to proceed?'))return;setBusy(true);try{const r=await fetch('/api/fund-products',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:product.id,amount})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Purchase failed.');setStatus('Fund purchase successful. Your purchase is now in progress.');setAmount('');}catch(e){setStatus(e.message)}finally{setBusy(false)}}
 return <main className="mobile-shell scroll-page"><header className="topbar"><div><div className="eyebrow">Global Nexus Capital</div><h1>Fund Products</h1><p className="muted">Choose a fund and view its configured return</p></div><Link className="icon-button" href="/mine">←</Link></header>
 <section className="admin-card"><div className="admin-card-head"><strong>Fund Product</strong><span className="badge">Admin configured</span></div>
 {products.length===0?<p className="muted">No active fund products are currently available.</p>:<div className="form-card">{product?.image_url&&<img src={product.image_url} alt={product.name} style={{width:'100%',borderRadius:16,marginBottom:12}}/>}<label>Fund Product<select value={productId} onChange={e=>setProductId(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {p.interest_rate}% / {p.period_days} days</option>)}</select></label>
 <label>Buy Amount<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter amount"/></label>
 <div className="return-box"><span>Interest</span><strong>{calc?`GHS ${calc.interest.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—'}</strong></div>
 <div className="return-box"><span>Amount to receive at maturity</span><strong>{calc?`GHS ${calc.maturity.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—'}</strong></div>
 {product&&<p className="muted">Allowed amount: GHS {Number(product.min_purchase).toLocaleString()}–{product.max_purchase==null?'no maximum':`GHS ${Number(product.max_purchase).toLocaleString()}`}</p>}
 {status&&<p className="muted">{status}</p>}<button type="button" className="primary-button" onClick={buy} disabled={busy||!calc}>{busy?'Processing…':'PAY'}</button></div>}
 </section><section className="admin-card"><strong>My Fund Purchases</strong><div className="empty-document"><span>Active and matured fund records will appear here.</span></div></section></main>
}
