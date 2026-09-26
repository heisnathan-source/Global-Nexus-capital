"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
export default function Support(){
 const [subject,setSubject]=useState(""); const [message,setMessage]=useState(""); const [requests,setRequests]=useState([]); const [status,setStatus]=useState("");
 async function load(){const r=await fetch("/api/support"); if(r.ok){const j=await r.json();setRequests(j.requests||[]);}}
 useEffect(()=>{load()},[]);
 async function submit(e){e.preventDefault();setStatus(""); const r=await fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject,message})}); const j=await r.json(); if(!r.ok){setStatus(j.error||"Unable to submit request.");return;} setSubject("");setMessage("");setStatus("Support request submitted successfully.");load();}
 return <main className="mobile-shell scroll-page"><header className="topbar"><div><div className="eyebrow">Global Nexus Capital</div><h1>Support</h1><p className="muted">Contact Global Nexus Capital support</p></div><Link className="icon-button" href="/mine">←</Link></header><section className="admin-card"><strong>Submit a Support Request</strong><form className="form-card" onSubmit={submit}><label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} required/></label><label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} required/></label><button className="primary-button" type="submit">Submit Request</button>{status&&<p className="muted">{status}</p>}</form></section><section className="admin-card"><strong>My Requests</strong>{requests.map(x=><div className="list-row" key={x.id}><div><b>{x.subject}</b><p className="muted">{x.status}{x.admin_reply?` — ${x.admin_reply}`:""}</p></div></div>)}</section></main> }
