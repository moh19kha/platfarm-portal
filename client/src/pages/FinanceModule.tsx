// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { CompanySelector } from "@/components/CompanySelector";
import { useCompanySelector } from "@/hooks/useCompanySelector";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PlatfarmLogo } from "@/components/PlatfarmLogo";

/* ═══ LOGO ═══ */

/* ═══ PERIODS ═══ */
const PERIODS={"7d":{label:"7 Days",days:7},"30d":{label:"30 Days",days:30},"90d":{label:"90 Days",days:90},"ytd":{label:"YTD",days:70}};

/* ═══ HELPERS ═══ */
const fmt=(n,c="EGP")=>`${c} ${Math.abs(n).toLocaleString("en-GB",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const pct=n=>`${n.toFixed(1)}%`;
const dl=(c,p)=>{const d=p?((c-p)/p*100):0;return{v:d,up:d>=0,l:`${d>=0?"+":""}${d.toFixed(1)}%`};};
const Badge=({type,label})=>{const m={success:{bg:"#E4EFE6",c:"#2D5A3D",b:"#B8D0BD"},warning:{bg:"#FDF6EC",c:"#D4960A",b:"#F5DDB8"},danger:{bg:"#FDF0F0",c:"#C94444",b:"#F5C4C4"},info:{bg:"#EDF2FE",c:"#3B6CCF",b:"#C4D5F5"},neutral:{bg:"#FAFAF8",c:"#95A09C",b:"#E4E1DC"},low:{bg:"#E4EFE6",c:"#2D5A3D",b:"#B8D0BD"},medium:{bg:"#FDF6EC",c:"#D4960A",b:"#F5DDB8"},high:{bg:"#FDF0F0",c:"#C94444",b:"#F5C4C4"}}; const s=m[type]||m.neutral; return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:99,fontSize:10,fontWeight:600,letterSpacing:.3,background:s.bg,color:s.c,border:`1px solid ${s.b}`,whiteSpace:"nowrap"}}>{label||type}</span>;};
const Dc=({c,p,inv:v})=>{const d=dl(c,p);const g=v?!d.up:d.up;return <span style={{fontSize:10,fontWeight:600,color:g?"#2D5A3D":"#C94444",marginLeft:4}}>{d.l}{g?" ↑":" ↓"}</span>;};
const PB=({v,color="#2D5A3D",h=6})=>(<div style={{width:"100%",height:h,borderRadius:h,background:"#EDEBE8"}}><div style={{width:`${Math.min(Math.max(v,2),100)}%`,height:h,borderRadius:h,background:color,transition:"width .4s"}}/></div>);
const RD=({l})=><div style={{width:8,height:8,borderRadius:"50%",background:{low:"#2D5A3D",medium:"#D4960A",high:"#C94444"}[l]||"#B0BAB6",flexShrink:0,marginTop:5}}/>;
const MBar=({data,h=140,fmtFn})=>{const mx=Math.max(...data.map(d=>Math.max(d.i||0,d.o||0)),1);const[hov,setHov]=useState(null);return(<div style={{position:"relative"}}><div style={{display:"flex",alignItems:"flex-end",gap:6,height:h,padding:"0 4px"}}>{data.map((d,idx)=>(<div key={idx} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}} onMouseEnter={()=>setHov(idx)} onMouseLeave={()=>setHov(null)}><div style={{display:"flex",gap:2,alignItems:"flex-end",height:h-20}}><div style={{width:14,height:Math.max((d.i/mx)*(h-20),3),background:"#2D5A3D",borderRadius:"3px 3px 0 0",opacity:hov===idx?1:.85,transition:"opacity .15s"}}/>{d.o>0&&<div style={{width:14,height:Math.max((d.o/mx)*(h-20),3),background:"#E4E1DC",borderRadius:"3px 3px 0 0",opacity:hov===idx?1:.7,transition:"opacity .15s"}}/>}</div><span style={{fontSize:8,color:hov===idx?"#2C3E50":"#95A09C",fontWeight:hov===idx?600:400,whiteSpace:"nowrap"}}>{d.w||d.label||d.m}</span></div>))}</div>{hov!==null&&data[hov]&&(()=>{const d=data[hov];const f=fmtFn||((n)=>`${Math.abs(n).toLocaleString()}`);const net=(d.i||0)-(d.o||0);return <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:"#1A2B24",color:"#fff",padding:"8px 14px",borderRadius:8,fontSize:10,lineHeight:1.7,whiteSpace:"nowrap",zIndex:20,boxShadow:"0 4px 12px rgba(0,0,0,.2)",pointerEvents:"none"}}><div style={{fontWeight:700,marginBottom:2,fontSize:11}}>{d.w||d.label||d.m}</div><div style={{display:"flex",gap:12}}><div><span style={{color:"#7AE8A0"}}>▲ In:</span> {f(d.i||0)}</div><div><span style={{color:"#FF9E9E"}}>▼ Out:</span> {f(d.o||0)}</div></div><div style={{borderTop:"1px solid rgba(255,255,255,.15)",marginTop:4,paddingTop:4,fontWeight:700,color:net>=0?"#7AE8A0":"#FF9E9E"}}>Net: {net>=0?"+":""}{f(net)}</div></div>;})()}</div>);};
const DateIn=({label,value,onChange})=>(<div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10,color:"#64706C"}}>{label}</span><input type="date" value={value} onChange={e=>onChange(e.target.value)} style={{height:32,padding:"0 8px",border:"1px solid #E4E1DC",borderRadius:6,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#2C3E50",outline:"none"}}/></div>);
const PeriodBar=({value,onChange,options,cf,ct,oCf,oCt})=>{const opts=[...(options||Object.keys(PERIODS)),"custom"];const isCust=value==="custom";return(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}><span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",color:"#4A7C59",letterSpacing:.5}}>Period:</span><div style={{display:"flex",background:"#fff",border:"1px solid #E4E1DC",borderRadius:7,overflow:"hidden"}}>{opts.map(k=>(<button key={k} onClick={()=>onChange(k)} style={{padding:"6px 14px",fontSize:11,fontWeight:value===k?600:400,color:value===k?"#2D5A3D":"#64706C",background:value===k?"#E4EFE6":"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",borderRight:"1px solid #E4E1DC"}}>{k==="custom"?"Custom":PERIODS[k]?.label||k}</button>))}</div>{isCust?<><DateIn label="From" value={cf||""} onChange={v=>oCf&&oCf(v)}/><DateIn label="To" value={ct||""} onChange={v=>oCt&&oCt(v)}/></>:null}</div>);};
const Gauge=({score,prev,label,sub,size:sz=100,primary:pr})=>{const cl=score>=70?"#2D5A3D":score>=40?"#D4960A":"#C94444";const bg=score>=70?"rgba(45,90,61,.06)":score>=40?"rgba(212,150,10,.06)":"rgba(201,68,68,.06)";const r=(sz-16)/2;const ci=2*Math.PI*r;const da=ci*Math.max(score,1)/100;const tr=score-(prev||score);const tg=score>=70?"Healthy":score>=40?"Needs Work":"Critical";return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",width:pr?sz+40:sz+16}}><div style={{position:"relative",width:sz,height:sz,marginBottom:6}}><svg viewBox={`0 0 ${sz} ${sz}`} width={sz} height={sz}><circle cx={sz/2} cy={sz/2} r={r} fill={bg} stroke="#E8E5E0" strokeWidth={pr?8:6}/>{score>0&&<circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={cl} strokeWidth={pr?8:6} strokeDasharray={`${da} ${ci-da}`} strokeLinecap="round" transform={`rotate(-90 ${sz/2} ${sz/2})`} style={{transition:"stroke-dasharray .9s"}}/>}</svg><div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:pr?sz*.32:sz*.28,fontWeight:800,color:cl,lineHeight:1}}>{score}</span><div style={{marginTop:pr?4:2,padding:"1px 6px",borderRadius:99,background:tr>0?"rgba(45,90,61,.1)":tr<0?"rgba(201,68,68,.1)":"rgba(0,0,0,.04)"}}><span style={{fontSize:pr?10:8,fontWeight:700,color:tr>0?"#2D5A3D":tr<0?"#C94444":"#95A09C",fontFamily:"'JetBrains Mono',monospace"}}>{tr>0?"▲":tr<0?"▼":"—"}{tr!==0&&` ${Math.abs(tr)}`}</span></div></div></div><span style={{fontSize:pr?11:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#4A5E56"}}>{label}</span><span style={{marginTop:3,fontSize:pr?10:8,fontWeight:600,padding:"2px 10px",borderRadius:99,background:score>=70?"#E4EFE6":score>=40?"#FDF6EC":"#FDF0F0",color:cl}}>{tg}</span>{sub&&<span style={{fontSize:8,color:"#95A09C",marginTop:3}}>{sub}</span>}</div>);};

/* ═══ LOADING SKELETON ═══ */
const Skeleton=({w="100%",h=20,r=6})=>(<div style={{width:w,height:h,borderRadius:r,background:"linear-gradient(90deg,#EDEBE8 25%,#F7F6F3 50%,#EDEBE8 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.5s infinite"}}/>);
const PageSkeleton=()=>(<div style={{padding:20}}><style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>{[1,2,3,4].map(i=>(<div key={i} style={{background:"#fff",border:"1px solid #E4E1DC",borderRadius:9,padding:16}}><Skeleton w="60%" h={10}/><div style={{marginTop:8}}><Skeleton w="80%" h={24}/></div><div style={{marginTop:6}}><Skeleton w="40%" h={10}/></div></div>))}</div><div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>{[1,2].map(i=>(<div key={i} style={{background:"#fff",border:"1px solid #E4E1DC",borderRadius:9,padding:16}}><Skeleton w="40%" h={14}/><div style={{marginTop:16}}>{[1,2,3,4].map(j=>(<div key={j} style={{marginTop:8}}><Skeleton h={12}/></div>))}</div></div>))}</div></div>);

/* ═══ MAIN ═══ */

const SectionError = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#C94444", marginBottom: 4 }}>Failed to load data</div>
      <div style={{ fontSize: 11, color: "#95A09C" }}>Check your connection or refresh the page.</div>
    </div>
  </div>
);
export default function FinanceModule(){
  const [, setLocation] = useLocation();
  const[pg,setPg]=useState("health");
  const[sideCol,setSideCol]=useState(false);
  const[companyDropdownOpen,setCompanyDropdownOpen]=useState(false);
  const {
    companies,
    companiesLoading,
    activeCompanyId,
    activeCompany,
    companyLabel,
    setActiveCompany,
    isAdmin,
  } = useCompanySelector();
  const[cfP,setCfP]=useState("90d");const[cfF,setCfF]=useState("");const[cfT,setCfT]=useState("");
  const[exP,setExP]=useState("90d");const[exF,setExF]=useState("");const[exT,setExT]=useState("");
  const[efP,setEfP]=useState("ytd");const[efF,setEfF]=useState("");const[efT,setEfT]=useState("");
  const[rcvSearch,setRcvSearch]=useState("");const[soaF,setSoaF]=useState(()=>{const d=new Date();d.setMonth(d.getMonth()-6);return d.toISOString().slice(0,10);});
  const[soaT2,setSoaT2]=useState(()=>new Date().toISOString().slice(0,10));
  const[sp,setSp]=useState(null);const[soaMode,setSoaMode]=useState("customer");
  const[soaSearch,setSoaSearch]=useState("");const[soaDropOpen,setSoaDropOpen]=useState(false);const soaDropRef=useRef(null);
  const[bankOnly,setBankOnly]=useState(true);
  const[saP,setSaP]=useState("90d");const[saF,setSaF]=useState("");const[saT,setSaT]=useState("");
  const[hovBar,setHovBar]=useState(null);
  const[saCurrencyMode,setSaCurrencyMode]=useState("original"); // "original" or "usd"

  // Close SOA dropdown on outside click
  useEffect(()=>{
    const handler=(e)=>{if(soaDropRef.current&&!soaDropRef.current.contains(e.target))setSoaDropOpen(false);};
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const cur = activeCompany?.currency||"EGP";
  const companyIdParam = activeCompanyId==="ALL"?undefined:activeCompanyId;
  const [isMob,setIsMob]=useState(()=>typeof window!=="undefined"&&window.innerWidth<768);
  useEffect(()=>{const h=()=>setIsMob(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  const sw=isMob?0:(sideCol?48:190);

  // ─── tRPC Queries ────────────────────────────────────────────────────
  const healthQ = trpc.finance.health.useQuery({companyId:companyIdParam},{enabled:pg==="health"});
  const cashQ = trpc.finance.cashOverview.useQuery({companyId:companyIdParam,period:cfP,customFrom:cfP==="custom"?cfF:undefined,customTo:cfP==="custom"?cfT:undefined},{enabled:pg==="overview"});
  const rcvQ = trpc.finance.receivables.useQuery({companyId:companyIdParam},{enabled:pg==="receivables"});
  const payQ = trpc.finance.payables.useQuery({companyId:companyIdParam},{enabled:pg==="payables"});
  const expQ = trpc.finance.expenses.useQuery({companyId:companyIdParam,period:exP,customFrom:exP==="custom"?exF:undefined,customTo:exP==="custom"?exT:undefined},{enabled:pg==="expenses"});
  const expendQ = trpc.finance.expenditure.useQuery({companyId:companyIdParam,period:exP,customFrom:exP==="custom"?exF:undefined,customTo:exP==="custom"?exT:undefined},{enabled:pg==="expenses"});
  const partnersQ = trpc.finance.partners.useQuery({companyId:companyIdParam},{enabled:pg==="soa"});
  const soaQ = trpc.finance.soa.useQuery({partnerId:sp||0,mode:soaMode,companyId:companyIdParam,dateFrom:soaF,dateTo:soaT2},{enabled:pg==="soa"&&!!sp});
  const efFrom=efP==="custom"?efF:efP==="ytd"?new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10):efP==="30d"?new Date(Date.now()-30*864e5).toISOString().slice(0,10):efP==="90d"?new Date(Date.now()-90*864e5).toISOString().slice(0,10):undefined;
  const efTo=efP==="custom"?efT:new Date().toISOString().slice(0,10);
  const exfQ = trpc.finance.exportFees.useQuery({companyId:companyIdParam,dateFrom:efFrom,dateTo:efTo},{enabled:pg==="exportfees"});
  const saQ = trpc.finance.salesAnalytics.useQuery({companyId:companyIdParam,period:saP,customFrom:saP==="custom"?saF:undefined,customTo:saP==="custom"?saT:undefined},{enabled:pg==="salesanalytics"});

  // ─── Derived Health Data ─────────────────────────────────────────────
  const h = healthQ.data;
  const lS = h ? Math.min(Math.round((h.cr||0)*30),100) : 0;
  const cS = h ? Math.round(Math.min(100, (h.dso<30?90:h.dso<45?70:h.dso<60?50:30))) : 0;
  const ccS = h ? Math.max(0,Math.min(100,Math.round(100-(h.ccc||0)*0.8))) : 0;
  const dS = h ? Math.max(0,Math.round(100-(h.topCustomerPct||0)*2.5)) : 0;
  const oH = h ? Math.round((lS+cS+ccS+dS)/4) : 0;
  const burn = expQ.data ? (expQ.data.total / (expQ.data.dateRange?.days||90) * 30) : 0;
  const runway = h && burn>0 ? (h.totalCash/burn) : 0;

  const todayStr = new Date().toISOString().slice(0,10);
  const todayLabel = new Date().toLocaleDateString("en-GB",{month:"short",day:"numeric",year:"numeric"});

  return(
    <div style={{fontFamily:"'DM Sans', system-ui, sans-serif",background:"#F7F6F3",minHeight:"100vh"}}>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}.ab{height:3px;background:linear-gradient(90deg,#2D5A3D,#C0714A)}.sb{position:fixed;top:3px;left:0;bottom:0;background:#fff;border-right:1px solid #E4E1DC;z-index:50;transition:width .2s;overflow:hidden;display:flex;flex-direction:column}.sb-logo{padding:16px;cursor:pointer;border-bottom:1px solid #E4E1DC;display:flex;align-items:center;gap:10px;min-height:56px}.app-sb-ni{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;transition:background .15s;font-size:12px;font-weight:500;color:#64706C;white-space:nowrap;overflow:hidden;border-right:3px solid transparent}.app-sb-ni:hover{background:#F2F7F3}.app-sb-ni.app-sb-act{background:#E4EFE6;color:#2D5A3D;font-weight:700;border-right-color:#2D5A3D}.app-sb-ni svg{width:16px;height:16px;flex-shrink:0}.app-sb-ns{font-size:9px;color:#95A09C;margin-top:1px;font-weight:400}.ph{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #E4E1DC;background:#fff;position:sticky;top:3px;z-index:40}.pt{font-size:18px;font-weight:700;color:#2C3E50;display:flex;align-items:center;gap:10px}.sg{display:grid;gap:12px;margin-bottom:20px}.sc{background:#fff;border:1px solid #CDDDD1;border-radius:9px;padding:16px}.sl{font-size:9px;font-weight:700;text-transform:uppercase;color:#4A7C59;letter-spacing:.5px;margin-bottom:6px}.sv{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#2D5A3D}.ss{font-size:10px;color:#95A09C;margin-top:2px}.xc{background:#fff;border:1px solid #E4E1DC;border-radius:9px;overflow:hidden;margin-bottom:16px}.xh{background:#2D5A3D;padding:10px 16px;display:flex;align-items:center;justify-content:space-between}.xh h3{font-size:13px;font-weight:600;color:#fff;display:flex;align-items:center;gap:8px}.xh .ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;color:rgba(255,255,255,.7)}.tbl{width:100%;border-collapse:collapse}.tbl th{font-size:9px;font-weight:700;text-transform:uppercase;color:#4A7C59;letter-spacing:.5px;padding:8px 10px;text-align:left;border-bottom:1px solid #E4E1DC}.tbl td{font-size:11.5px;color:#2C3E50;padding:10px;border-bottom:1px solid #F2F0EC}.tbl tr:hover td{background:#FAFAF8}.mn{font-family:'JetBrains Mono',monospace;font-weight:600}.ip{background:#fff;border:1px solid #E4E1DC;border-radius:9px;padding:18px}.ip h4{font-size:13px;font-weight:700;color:#2C3E50;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #F2F0EC}.sel{height:34px;padding:0 10px;border:1px solid #E4E1DC;border-radius:6px;font-family:inherit;font-size:11px;color:#2C3E50;outline:none;background:#fff;cursor:pointer;min-width:160px}@media(max-width:900px){.sg{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:767px){.sb{display:none!important}.ph{padding:10px 12px}.pt{font-size:14px}.sel{min-width:100px}.sg{grid-template-columns:1fr!important}.fin-mob-bar{display:flex!important;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #E4E1DC;z-index:100;padding:4px 0 max(4px,env(safe-area-inset-bottom));justify-content:space-around;align-items:center}.fin-mob-bar>div{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 6px;cursor:pointer;font-size:8px;color:#64706C;min-width:40px}.fin-mob-bar>div.act{color:#2D5A3D;font-weight:700}.fin-mob-bar>div .icon{font-size:14px;line-height:1}}@media(min-width:768px){.fin-mob-bar{display:none!important}}`}</style>
      <div className="ab"/>
      {/* ═══ SIDEBAR ═══ */}
      <div className="sb" style={{width:sw,minWidth:sw}}>
        <div className="sb-logo" onClick={()=>setSideCol(!sideCol)}><PlatfarmLogo height={sideCol ? 24 : 28} treeColor="#1B3A2D" textColor="#D4845F" /></div>
        <div style={{flex:1,padding:"8px 0",overflowY:"auto"}}>
          <div className="app-sb-ni" onClick={()=>setLocation("/")} style={{marginBottom:4}}>
            <span style={{fontSize:15}}>🏠</span>{!sideCol&&<span>Home</span>}
          </div>
          {[["health","Financial Health","Scorecard"],["overview","Cash Overview","Banks"],["receivables","Receivables","Aging"],["payables","Payables","Bills"],["expenses","Expenses","Cost Intel"],["salesanalytics","Sales Analytics","By Customer"],["soa","SOA","Ledger"],["exportfees","Export Fees","Account"]].map(([k,l,sub])=>(
            <div key={k} className={`app-sb-ni ${pg===k?"app-sb-act":""}`} onClick={()=>setPg(k)}>
              <span style={{fontSize:13}}>{(({health:"🛡",overview:"🏦",receivables:"📈",payables:"📉",expenses:"📊",salesanalytics:"💰",soa:"📄",exportfees:"🚢"} as Record<string,string>)[k])}</span>
              {!sideCol&&<div>{l}{sub&&<div className="app-sb-ns">{sub}</div>}</div>}
            </div>
          ))}
        </div>
        <div style={{padding:"12px 16px",borderTop:"1px solid #E4E1DC",display:"flex",alignItems:"center",gap:10}}><div style={{width:28,height:28,borderRadius:"50%",background:"#2D5A3D",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>MH</div>{!sideCol&&<div><div style={{fontSize:11,fontWeight:600,color:"#2C3E50"}}>Mohamed</div><div style={{fontSize:8,color:"#B0BAB6"}}>Admin</div></div>}</div>
      </div>
      {/* ═══ CONTENT ═══ */}
      <div className="mob-pb-bar" style={{marginLeft:sw,transition:"margin-left .2s",minHeight:"calc(100vh - 3px)",overflow:isMob?"auto":undefined}}>
        <div className="ph">
          <div className="pt">
            {{health:"Financial Health",overview:"Cash Overview",receivables:"Receivables",payables:"Payables",expenses:"Expenses",salesanalytics:"Sales Analytics",soa:"Statement of Account",exportfees:"Export Fees"}[pg]}
            <span style={{padding:"3px 10px",borderRadius:99,fontSize:10,fontWeight:600,background:"#E4EFE6",color:"#2D5A3D"}}>{companyLabel}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <CompanySelector
              companies={companies}
              companiesLoading={companiesLoading}
              activeCompanyId={activeCompanyId}
              activeCompany={activeCompany}
              companyLabel={companyLabel}
              setActiveCompany={setActiveCompany}
              allowAll={isAdmin}
              open={companyDropdownOpen}
              onOpenChange={setCompanyDropdownOpen}
            />
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#95A09C"}}>{todayLabel}</span>
          </div>
        </div>

        {/* ═══ PAGE: FINANCIAL HEALTH ═══ */}
        {pg==="health"&&(healthQ.isLoading?<PageSkeleton/>:healthQ.isError?<SectionError/>:h?<div style={{padding:20}}>
          <div style={{fontSize:10,color:"#95A09C",marginBottom:12}}>Point-in-time as of <strong style={{color:"#2C3E50"}}>{todayLabel}</strong></div>
          {/* Executive banner */}
          <div style={{background:"linear-gradient(135deg,#1A2B24,#2D5A3D 60%,#3A7350)",borderRadius:12,padding:"20px 24px",marginBottom:20,display:"flex",gap:24,alignItems:"center"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(255,255,255,.1)",border:"3px solid rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:24,fontWeight:800,color:"#fff"}}>{oH}</span></div>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>{oH>=70?"Solid — maintain course":oH>=50?"Mixed signals — attention needed":"Stress — action required"}</div><div style={{fontSize:12,color:"rgba(255,255,255,.7)",lineHeight:1.6}}>{`Liquidity ${lS>=70?"strong":"adequate"}, ${h.ccc}-day cash cycle. ${h.topCustomerPct>25?`Top customer at ${pct(h.topCustomerPct)} creates concentration risk.`:""} ${h.badDebt>0?`Bad debt provision: ${fmt(h.badDebt,cur)}.`:""}`}</div></div>
            <div style={{display:"flex",gap:16,flexShrink:0}}>{[["Runway",runway>0?runway.toFixed(1)+"mo":"—",runway>=6],["CCC",h.ccc+"d",h.ccc<=45],["Gap",h.cashGap+"d",h.cashGap<=5]].map(([l,v,ok])=>(<div key={l} style={{textAlign:"center"}}><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:700,color:ok?"#7AE8A0":"#FF9E9E"}}>{v}</div><div style={{fontSize:9,color:"rgba(255,255,255,.5)",fontWeight:600,textTransform:"uppercase"}}>{l}</div></div>))}</div>
          </div>
          {/* Gauges */}
          <div style={{background:"#fff",border:"1px solid #E4E1DC",borderRadius:12,overflow:"hidden",marginBottom:20}}>
            <div style={{background:"#2D5A3D",padding:"12px 20px",display:"flex",justifyContent:"space-between"}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff"}}>🛡 Scorecard</h3><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,.12)",padding:"2px 10px",borderRadius:99}}>{oH}/100</span></div>
            <div style={{padding:"28px 20px 20px",display:"flex",justifyContent:"center",alignItems:"flex-start",gap:8}}>
              <Gauge score={oH} prev={oH} label="Overall" sub="avg" size={120} primary/>
              <div style={{width:1,height:130,background:"linear-gradient(180deg,transparent,#E4E1DC,transparent)",margin:"0 16px",alignSelf:"center"}}/>
              <Gauge score={lS} prev={lS} label="Liquidity" sub={h.cr.toFixed(2)+"x"} size={96}/>
              <Gauge score={cS} prev={cS} label="Collections" sub={h.dso+"d DSO"} size={96}/>
              <Gauge score={ccS} prev={ccS} label="Cash Cycle" sub={h.ccc+"d CCC"} size={96}/>
              <Gauge score={dS} prev={dS} label="Diversification" sub={"top: "+pct(h.topCustomerPct)} size={96}/>
            </div>
            <div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",borderTop:"1px solid #F0EDE9",background:"#FCFBFA"}}>
              {[{t:"Liquidity",q:"Pay bills?",m:`${h.cr.toFixed(2)}x current`,s:lS>=70?"#2D5A3D":"#D4960A"},{t:"Collections",q:"Paying on time?",m:`${h.dso}d DSO`,s:cS>=70?"#2D5A3D":"#D4960A"},{t:"Cash Cycle",q:"Cash tied up?",m:`${h.dso}+${h.dio}−${h.dpo}=${h.ccc}d`,s:ccS>=40?"#D4960A":"#C94444"},{t:"Diversification",q:"Customer risk?",m:`Top: ${pct(h.topCustomerPct)}`,s:dS>=40?"#D4960A":"#C94444"}].map((x,i)=>(<div key={i} style={{padding:"12px 16px",borderRight:i<3?"1px solid #F0EDE9":"none"}}><div style={{fontSize:11,fontWeight:700,color:x.s,marginBottom:2}}>{x.t}</div><div style={{fontSize:10,color:"#8A948F",fontStyle:"italic",marginBottom:4}}>{x.q}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,fontWeight:600,color:"#3A4A44"}}>{x.m}</div></div>))}
            </div>
          </div>
          {/* KPI row */}
          <div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:20}}>{[{l:"Current Ratio",v:h.cr.toFixed(2)+"x",s:h.cr>=1.5?"#2D5A3D":"#D4960A"},{l:"Quick Ratio",v:h.qr.toFixed(2)+"x",s:h.qr>=1?"#2D5A3D":"#D4960A"},{l:"Runway",v:runway>0?runway.toFixed(1)+"mo":"—",s:runway>=6?"#2D5A3D":runway>=3?"#D4960A":"#C94444"},{l:"CCC",v:h.ccc+"d",s:h.ccc<=45?"#2D5A3D":h.ccc<=60?"#D4960A":"#C94444"},{l:"Bad Debt Est.",v:fmt(h.badDebt,cur),s:"#C94444"}].map((k,i)=>(<div key={i} style={{background:"#fff",border:"1px solid #E4E1DC",borderRadius:9,padding:"14px 16px",borderLeft:`4px solid ${k.s}`}}><div className="sl">{k.l}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:800,color:k.s}}>{k.v}</div></div>))}</div>
          {/* CCC + Risks */}
          <div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div className="ip"><h4>Cash Conversion Cycle</h4>{(()=>{const cccBars=[{l:"DSO",v:h.dso,c:"#3B6CCF",s:"Collect"},{l:"DIO",v:h.dio,c:"#C0714A",s:"Hold"},{l:"DPO",v:h.dpo,c:"#2D5A3D",s:"Pay"},{l:"CCC",v:h.ccc,c:h.ccc<=45?"#2D5A3D":"#C94444",s:"Result",res:true}];const maxVal=Math.max(...cccBars.map(b=>Math.abs(b.v)),1);const maxBarH=100;return <div style={{display:"flex",alignItems:"flex-end",gap:0,height:160,marginBottom:16,padding:"0 8px"}}>{[{l:"DSO",v:h.dso,c:"#3B6CCF",s:"Collect"},{op:"+"},{l:"DIO",v:h.dio,c:"#C0714A",s:"Hold"},{op:"−"},{l:"DPO",v:h.dpo,c:"#2D5A3D",s:"Pay"},{op:"="},{l:"CCC",v:h.ccc,c:h.ccc<=45?"#2D5A3D":"#C94444",s:"Result",res:true}].map((it,i)=>{if(it.op)return <div key={i} style={{width:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#C0BAB0",fontWeight:700,paddingBottom:50}}>{it.op}</div>;const bh=Math.max((Math.abs(it.v)/maxVal)*maxBarH,12);return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:800,color:it.c,marginBottom:4}}>{it.v}d</span><div style={{width:"70%",height:bh,background:it.c,borderRadius:"8px 8px 2px 2px",opacity:.85,border:it.res?"2px solid "+it.c:"none"}}/><span style={{fontSize:10,fontWeight:700,color:it.c,marginTop:6}}>{it.l}</span><span style={{fontSize:8,color:"#8A948F"}}>{it.s}</span></div>);})}</div>})()}
              {h.ccc>45&&<div style={{padding:12,background:"#FDF0F0",borderRadius:8,border:"1px solid #F5C4C4",fontSize:11,color:"#2C3E50",lineHeight:1.6}}><strong style={{color:"#C94444"}}>⚠ {h.ccc}d cycle is long.</strong> DIO at {h.dio}d is the biggest drag.</div>}
              <div style={{marginTop:14,background:"#FAFAF8",borderRadius:8,border:"1px solid #E4E1DC",padding:"12px 14px"}}><div style={{fontSize:10,fontWeight:700,color:"#4A7C59",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Term Definitions</div>{[{t:"DSO",f:"Days Sales Outstanding",d:"Average number of days to collect payment from customers after a sale. Lower is better — means faster cash collection."},{t:"DIO",f:"Days Inventory Outstanding",d:"Average number of days inventory is held before being sold. Lower means faster inventory turnover."},{t:"DPO",f:"Days Payable Outstanding",d:"Average number of days to pay suppliers. Higher is better — means you hold cash longer before paying."},{t:"CCC",f:"Cash Conversion Cycle",d:"DSO + DIO − DPO. Measures how many days cash is tied up in operations. Negative CCC means you collect before you pay — ideal."}].map((def,i)=>(<div key={i} style={{marginBottom:i<3?8:0,paddingBottom:i<3?8:0,borderBottom:i<3?"1px solid #EDEBE8":"none"}}><div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:2}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:"#2D5A3D"}}>{def.t}</span><span style={{fontSize:10,color:"#64706C",fontStyle:"italic"}}>{def.f}</span></div><div style={{fontSize:10,color:"#8A948F",lineHeight:1.5}}>{def.d}</div></div>))}</div>
            </div>
            <div style={{background:"#fff",border:"1px solid #E4E1DC",borderRadius:12,overflow:"hidden"}}><div style={{background:"#1A2B24",padding:"12px 20px",display:"flex",justifyContent:"space-between"}}><h4 style={{fontSize:14,fontWeight:700,color:"#fff"}}>⚠ Risk Signals</h4><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#FF9E9E",background:"rgba(201,68,68,.2)",padding:"2px 10px",borderRadius:99}}>{h.risks.filter(r=>r.status!=="ok").length} active</span></div><div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
              {h.risks.filter(r=>r.status!=="ok").map((rk,i)=>{const sev=rk.status==="danger"?"high":"medium";const c2={high:"#C94444",medium:"#D4960A"}[sev];const bg2={high:"#FEF7F7",medium:"#FFFCF5"}[sev];return(<div key={i} style={{display:"flex",gap:12,padding:"12px 14px",background:bg2,border:"1px solid "+(sev==="high"?"#F5C4C4":"#F5DDB8"),borderRadius:8}}><RD l={sev}/><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,fontWeight:700}}>{rk.label}</span><span className="mn" style={{fontSize:11,color:c2}}>{rk.value}</span></div></div></div>);})}
              {h.risks.filter(r=>r.status!=="ok").length===0&&<div style={{textAlign:"center",padding:20,color:"#2D5A3D",fontSize:12}}>All indicators healthy ✓</div>}
            </div></div>
          </div>
        </div>:<div style={{padding:40,textAlign:"center",color:"#95A09C"}}>No data available</div>)}

        {/* ═══ PAGE: CASH OVERVIEW ═══ */}
        {pg==="overview"&&(cashQ.isLoading?<PageSkeleton/>:cashQ.isError?<SectionError/>:cashQ.data?<div style={{padding:20}}>
          <PeriodBar value={cfP} onChange={setCfP} options={["30d","90d","ytd"]} cf={cfF} ct={cfT} oCf={setCfF} oCt={setCfT}/>
          {(()=>{const d=cashQ.data;const cf=d.cashFlow;return(<>
          <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>{[["Inflows",fmt(cf.inflows,cur),<Dc c={cf.inflows} p={cf.prevInflows}/>],["Outflows",fmt(cf.outflows,cur),<Dc c={cf.outflows} p={cf.prevOutflows} inv/>],["Net Flow",fmt(cf.net,cur),cf.net>=0?<Badge type="success" label="Positive"/>:<Badge type="danger" label="Negative"/>],["Cash in Bank",fmt(d.totalCash,cur),<Dc c={d.totalCash} p={d.prevTotalCash}/>]].map(([l,v,s],i)=>(<div className="sc" key={i}><div className="sl">{l}</div><div className="sv" style={{fontSize:18}}>{v}</div><div className="ss">{s}</div></div>))}</div>
          <div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div className="xc"><div className="xh"><h3>📊 Cash Flow</h3></div><div style={{padding:16}}><div style={{display:"flex",justifyContent:"flex-end",gap:16,marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:"#2D5A3D"}}/><span style={{fontSize:10,color:"#64706C"}}>Inflows</span></div><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:"#E4E1DC"}}/><span style={{fontSize:10,color:"#64706C"}}>Outflows</span></div></div><MBar data={cf.periods.map(p=>({w:p.label,i:p.inflow,o:p.outflow}))}/><div style={{marginTop:12}}>{cf.periods.map((p,i)=>{const n=p.inflow-p.outflow;return(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #F2F0EC"}}><span style={{fontSize:10,color:"#64706C"}}>{p.label}</span><span className="mn" style={{fontSize:10,color:n>=0?"#2D5A3D":"#C94444"}}>{n>=0?"+":""}{fmt(n,cur)}</span></div>);})}</div></div></div>
            <div className="xc"><div className="xh" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3>🏦 Bank Accounts</h3><label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:10,color:"#fff",fontWeight:400}}><span>Banks Only</span><div onClick={()=>setBankOnly(!bankOnly)} style={{width:32,height:18,borderRadius:9,background:bankOnly?"#7AE8A0":"rgba(255,255,255,.25)",position:"relative",cursor:"pointer",transition:"background .2s"}}><div style={{width:14,height:14,borderRadius:7,background:"#fff",position:"absolute",top:2,left:bankOnly?16:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/></div></label></div><div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Account</th><th style={{textAlign:"right"}}>Balance</th><th>Currency</th></tr></thead><tbody>{d.banks.filter(a=>!bankOnly||/bank|banque|bnk/i.test(a.name)).map(a=>(<tr key={a.id}><td style={{fontSize:11.5,fontWeight:500}}>{a.name}<div style={{fontSize:9,color:"#95A09C"}}>{a.companyName}</div></td><td className="mn" style={{textAlign:"right",fontSize:12,color:a.balance>=0?"#2D5A3D":"#C94444"}}>{a.balance.toLocaleString("en-GB",{minimumFractionDigits:2})}</td><td style={{fontSize:10}}>{a.currency}</td></tr>))}</tbody></table></div>{bankOnly&&<div style={{padding:"6px 12px",fontSize:9,color:"#95A09C",borderTop:"1px solid #F2F0EC"}}>Showing bank accounts only. Toggle off to see all accounts (petty cash, settlements, etc.)</div>}</div>
          </div></>);})()}
        </div>:<div style={{padding:40,textAlign:"center",color:"#95A09C"}}>No data available</div>)}

        {/* ═══ PAGE: RECEIVABLES ═══ */}
        {pg==="receivables"&&(rcvQ.isLoading?<PageSkeleton/>:rcvQ.isError?<SectionError/>:rcvQ.data?<div style={{padding:20}}>
          {(()=>{const r=rcvQ.data;
          const fq=rcvSearch.toLowerCase();
          const filtOv=rcvSearch?r.overdue.filter((o:any)=>(o.ref||"").toLowerCase().includes(fq)||(o.customer||"").toLowerCase().includes(fq)||(o.soRef||"").toLowerCase().includes(fq)||(o.dueDate||"").includes(fq)):r.overdue;
          const filtTotal=filtOv.reduce((s:number,o:any)=>s+o.amount,0);
          const fAg={c:{a:0,n:0},d31:{a:0,n:0},d61:{a:0,n:0},d90:{a:0,n:0}} as Record<string,{a:number;n:number}>;
          filtOv.forEach((o:any)=>{const b=o.daysOverdue<=30?"c":o.daysOverdue<=60?"d31":o.daysOverdue<=90?"d61":"d90";fAg[b].a+=o.amount;fAg[b].n++;});
          const mkBkt=(k:string)=>({amount:Math.round(fAg[k].a),count:fAg[k].n,pct:filtTotal>0?Math.round(fAg[k].a/filtTotal*100):0});
          const filtAging={current:mkBkt("c"),d31:mkBkt("d31"),d61:mkBkt("d61"),d90:mkBkt("d90")};
          const cMap={} as Record<string,{a:number;maxDays:number}>;
          filtOv.forEach((o:any)=>{if(!cMap[o.customer])cMap[o.customer]={a:0,maxDays:0};cMap[o.customer].a+=o.amount;cMap[o.customer].maxDays=Math.max(cMap[o.customer].maxDays,o.daysOverdue);});
          const filtCust=Object.entries(cMap).map(([name,d])=>({name,amount:Math.round(d.a),share:filtTotal>0?Math.round(d.a/filtTotal*1000)/10:0,risk:d.maxDays>90?"high":d.maxDays>30?"medium":"low"})).sort((a:any,b:any)=>b.amount-a.amount).slice(0,10);
          const filtTopConc=filtCust.length>0?filtCust[0].share:0;
          const filtBadDebt=Math.round(fAg.d90.a*0.5+fAg.d61.a*0.2+fAg.d31.a*0.05);
          const ag=rcvSearch?filtAging:r.aging;
          const topCust=rcvSearch?filtCust:r.topCustomers;
          return(<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}><div style={{fontSize:10,color:"#95A09C"}}>Aging as of <strong style={{color:"#2C3E50"}}>{todayLabel}</strong></div><div style={{display:"flex",alignItems:"center",gap:8,background:"#fff",border:"1px solid #D8E8DC",borderRadius:8,padding:"6px 12px",boxShadow:"0 1px 3px rgba(0,0,0,.06)",minWidth:280}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input value={rcvSearch} onChange={e=>setRcvSearch(e.target.value)} placeholder="Search customer, invoice or shipment…" style={{border:"none",outline:"none",fontSize:12,color:"#2C3E50",background:"transparent",width:240}} />{rcvSearch&&<button onClick={()=>setRcvSearch("")} style={{border:"none",background:"none",cursor:"pointer",color:"#95A09C",fontSize:14,padding:0,lineHeight:1}}>✕</button>}</div></div>
          <div className="sg" style={{gridTemplateColumns:"repeat(6,1fr)"}}>{[["Total AR",fmt(r.total,cur),"due + not yet due"],["Overdue AR",fmt(rcvSearch?filtTotal:r.overdueTotal,cur),rcvSearch?(filtOv.length+" invoice"+(filtOv.length!==1?"s":"")+" matching"):(r.total>0?Math.round((r.overdueTotal/r.total)*100)+"% of total AR":"")],["DSO",rcvSearch?"—":r.dso+"d",""],["On Time %",rcvSearch?"—":r.collectionRate+"%","of AR within due date"],["Bad Debt",fmt(rcvSearch?filtBadDebt:r.badDebt,cur),"provision"],["Concentration",pct(rcvSearch?filtTopConc:r.topConcentration),(rcvSearch?filtTopConc:r.topConcentration)>25?<Badge type="danger" label="High"/>:<Badge type="low" label="OK"/>]].map(([l,v,s],i)=>(<div className="sc" key={i}><div className="sl">{l}</div><div className="sv" style={{fontSize:17}}>{v}</div><div className="ss">{s}</div></div>))}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div className="ip"><h4>Aging Buckets</h4>{[["Current 0-30d",ag.current,"#2D5A3D"],["31-60d",ag.d31,"#D4960A"],["61-90d",ag.d61,"#C0714A"],["90+d",ag.d90,"#C94444"]].map(([l,d,c])=>(<div key={l} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#64706C"}}>{l} ({d.count})</span><span className="mn" style={{fontSize:11,color:c}}>{fmt(d.amount,cur)} · {d.pct}%</span></div><PB v={d.pct} color={c}/></div>))}</div>
            <div className="ip"><h4>Customer Concentration</h4>{topCust.map((c:any,i:number)=>(<div key={i} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><div style={{display:"flex",alignItems:"center",gap:6}}><RD l={c.risk}/><span style={{fontSize:11,fontWeight:500}}>{c.name}</span></div><span className="mn" style={{fontSize:11,color:c.share>25?"#C94444":"#2D5A3D"}}>{pct(c.share)}</span></div><PB v={c.share} color={c.share>25?"#C94444":c.share>15?"#D4960A":"#2D5A3D"} h={4}/></div>))}</div>
          </div>
          {(()=>{const filteredOverdue=filtOv;const exportOverdue=()=>{const hdr=["Invoice","Shipment","Customer","Payment Term","Ref Date","Orig. Amount","Currency","AED Amount","Paid (AED)","Due Date","Days Overdue","Risk"];const rows2=filteredOverdue.map((o:any)=>[o.ref,o.soRef||"",o.customer,o.paymentTerm||"",o.refDate||"",o.amountNative,o.currencyCode,o.amount,o.paid>0?o.paid:0,o.dueDate,o.daysOverdue,o.risk]);const csv=[hdr,...rows2].map((r:any)=>r.map((v:any)=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"').join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download=`overdue${rcvSearch?"_"+rcvSearch:""}_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);};const totAed=filteredOverdue.reduce((s:number,o:any)=>s+o.amount,0);const totPaid=filteredOverdue.reduce((s:number,o:any)=>s+(o.paid||0),0);const nativeTotals:Record<string,number>={};filteredOverdue.forEach((o:any)=>{nativeTotals[o.currencyCode]=(nativeTotals[o.currencyCode]||0)+o.amountNative;});return(<div className="xc"><div className="xh" style={{background:"#C0714A",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3>🔴 Overdue ({filteredOverdue.length}{rcvSearch?" matching":""})</h3><button onClick={exportOverdue} style={{background:"rgba(255,255,255,.18)",border:"1px solid rgba(255,255,255,.35)",borderRadius:6,color:"#fff",fontSize:10,fontWeight:600,padding:"4px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>⬇ Export CSV</button></div><div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Invoice</th><th>Shipment</th><th>Customer</th><th>Payment Term</th><th>Ref Date</th><th style={{textAlign:"right"}}>Orig. Amount</th><th style={{textAlign:"right"}}>AED Amount</th><th style={{textAlign:"right"}}>Paid (AED)</th><th>Due</th><th>Age</th><th>Risk</th></tr></thead><tbody>{filteredOverdue.map(o=>(<tr key={o.id}><td className="mn" style={{fontSize:11}}><a href={`https://odoo.platfarm.io/web#id=${o.id}&model=account.move&view_type=form`} target="_blank" rel="noreferrer" style={{color:"#2D5A3D",textDecoration:"none",fontWeight:500}} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>{o.ref}</a></td><td className="mn" style={{fontSize:11}}>{o.soRef?<a href={`/sales/${o.soId||""}`} target="_blank" rel="noreferrer" style={{color:"#4A7C59",textDecoration:"none",fontWeight:500}} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>{o.soRef}</a>:<span style={{color:"#C4C0BB"}}>—</span>}</td><td style={{fontSize:11}}>{o.customer}</td><td style={{fontSize:11,color:"#64706C"}}>{o.paymentTerm||"—"}</td><td className="mn" style={{fontSize:11,color:"#64706C"}}>{o.refDate||"—"}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:"#2C3E50"}}>{o.currencyCode!=="AED"?`${o.currencyCode} ${o.amountNative.toLocaleString("en-GB")}`:fmt(o.amountNative,"AED")}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:"#64706C"}}>{fmt(o.amount,cur)}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:o.paidNative>0?"#2D5A3D":"#C4C0BB"}}>{o.paid>0?fmt(o.paid,"AED"):"—"}</td><td className="mn" style={{fontSize:11}}>{o.dueDate}</td><td className="mn" style={{fontSize:11,color:o.daysOverdue>90?"#C94444":"#D4960A"}}>{o.daysOverdue}d</td><td><Badge type={o.risk} label={o.risk}/></td></tr>))}{filteredOverdue.length===0&&<tr><td colSpan={11} style={{padding:20,textAlign:"center",color:"#95A09C",fontSize:11}}>No results for "{rcvSearch}"</td></tr>}</tbody><tfoot><tr style={{background:"#F2F0EC",fontWeight:700}}><td colSpan={5} style={{padding:"8px 12px",fontSize:11,textAlign:"right",color:"#64706C"}}>TOTALS</td><td className="mn" style={{textAlign:"right",fontSize:11,borderTop:"2px solid #E4E1DC",paddingTop:8}}>{Object.entries(nativeTotals).map(([cur,tot]:any)=><div key={cur}>{cur!=="AED"?cur+" ":fmt(0,"AED").split("0")[0]}{Math.round(tot).toLocaleString("en-GB")}</div>)}</td><td className="mn" style={{textAlign:"right",fontSize:11,borderTop:"2px solid #E4E1DC",paddingTop:8,color:"#2D5A3D"}}>{fmt(totAed,"AED")}</td><td className="mn" style={{textAlign:"right",fontSize:11,borderTop:"2px solid #E4E1DC",paddingTop:8,color:"#2D5A3D"}}>{totPaid>0?fmt(totPaid,"AED"):"—"}</td><td colSpan={3} style={{borderTop:"2px solid #E4E1DC"}}/></tr></tfoot></table></div></div>);})()}
          </>);})()}
        </div>:<div style={{padding:40,textAlign:"center",color:"#95A09C"}}>No data available</div>)}

        {/* ═══ PAGE: PAYABLES ═══ */}
        {pg==="payables"&&(payQ.isLoading?<PageSkeleton/>:payQ.isError?<SectionError/>:payQ.data?<div style={{padding:20}}>
          {(()=>{const p=payQ.data;const cashGap=healthQ.data?.cashGap||0;return(<>
          <div style={{fontSize:10,color:"#95A09C",marginBottom:12}}>Open bills as of <strong style={{color:"#2C3E50"}}>{todayLabel}</strong></div>
          <div className="sg" style={{gridTemplateColumns:"repeat(5,1fr)"}}>{[["Total AP",fmt(p.total,cur),""],["DPO",p.dpo+"d",""],["Cash Gap",cashGap+"d",<Badge type={cashGap>10?"danger":"warning"} label={cashGap>0?"Gap":"OK"}/>],["Due ≤7d",fmt(p.dueWithin7d,cur),"urgent"],["Bills",p.billCount,"open"]].map(([l,v,s],i)=>(<div className="sc" key={i}><div className="sl">{l}</div><div className="sv" style={{fontSize:17}}>{v}</div><div className="ss">{s}</div></div>))}</div>
          {cashGap>0&&<div style={{padding:14,background:"#FDF6EC",border:"1px solid #F5DDB8",borderRadius:9,marginBottom:16,display:"flex",gap:12}}><span style={{fontSize:24}}>⏱</span><div><div style={{fontSize:12,fontWeight:600,color:"#D4960A"}}>Cash Gap: {cashGap}d</div><div style={{fontSize:11,color:"#64706C"}}>Pay {cashGap}d before collecting.</div></div></div>}
          <div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div className="xc"><div className="xh" style={{background:"#C0714A"}}><h3>🔥 Due This Week</h3></div><div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Bill</th><th>Supplier</th><th style={{textAlign:"right"}}>Orig. Amount</th><th style={{textAlign:"right"}}>AED Amount</th><th style={{textAlign:"right"}}>Paid (AED)</th><th>Due</th><th>Urgency</th></tr></thead><tbody>{p.dueThisWeek.map((b,i)=>(<tr key={i}><td className="mn" style={{color:"#2D5A3D",fontSize:11}}>{b.ref}</td><td style={{fontSize:11}}>{b.supplier}</td><td className="mn" style={{textAlign:"right",fontSize:11}}>{fmt(b.amount,cur)}</td><td className="mn" style={{fontSize:11}}>{b.dueDate}</td><td><Badge type={b.urgency==="Critical"?"danger":"low"} label={b.urgency}/></td></tr>))}</tbody></table></div>{p.dueThisWeek.length===0&&<div style={{padding:20,textAlign:"center",color:"#95A09C",fontSize:11}}>No bills due this week</div>}</div>
            <div className="ip"><h4>Aging</h4>{[["≤7d",p.aging.d7,"#C94444"],["8-30d",p.aging.d30,"#C0714A"],["31-60d",p.aging.d60,"#D4960A"],[">60d",p.aging.d60p,"#4A7C59"]].map(([l,a,c])=>(<div key={l} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:"#64706C"}}>{l}</span><span className="mn" style={{fontSize:11,color:c}}>{fmt(a,cur)}</span></div><PB v={p.total?a/p.total*100:0} color={c}/></div>))}</div>
          </div>
          </>);})()}
        </div>:<div style={{padding:40,textAlign:"center",color:"#95A09C"}}>No data available</div>)}

        {/* ═══ PAGE: EXPENSES ═══ */}
        {pg==="expenses"&&(expQ.isLoading?<PageSkeleton/>:expQ.isError?<SectionError/>:expQ.data?<div style={{padding:20}}>
          {(()=>{const ex=expQ.data;const exBurn=ex.runRate;return(<>
          <PeriodBar value={exP} onChange={setExP} options={["30d","90d","ytd"]} cf={exF} ct={exT} oCf={setExF} oCt={setExT}/>
          <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>{[["Total",fmt(ex.total,cur),<Dc c={ex.total} p={ex.prevTotal} inv/>],["Run Rate",fmt(exBurn,cur)+"/mo","normalized"],["COGS %",pct(ex.cogsPct),"of total"],["vs Prior",<Dc c={ex.total} p={ex.prevTotal} inv/>,""]].map(([l,v,s],i)=>(<div className="sc" key={i}><div className="sl">{l}</div><div className="sv" style={{fontSize:17}}>{v}</div><div className="ss">{s}</div></div>))}</div>
          {/* ── Expenditure Distribution (above Categories & Monthly) ── */}
          {expendQ.data&&(()=>{const ed=expendQ.data;return(<>
          <div className="xc" style={{marginBottom:16}}><div className="xh"><h3>💰 Distribution</h3><span className="ct">{ed.distribution.length} categories</span></div><div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Category</th><th style={{textAlign:"right"}}>Amount</th><th>Txns</th><th>%</th><th style={{width:160}}>Bar</th></tr></thead><tbody>{ed.distribution.map((d,i)=>(<tr key={i}><td style={{fontSize:11.5,fontWeight:500}}>{d.category}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:"#2D5A3D"}}>{fmt(d.amount,cur)}</td><td style={{fontSize:11}}>{d.count}</td><td className="mn" style={{fontSize:11}}>{pct(d.pct)}</td><td><PB v={d.pct} color={i<2?"#2D5A3D":"#7A9E7E"}/></td></tr>))}</tbody></table></div></div>
          </>);})()}
          <div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div className="xc"><div className="xh"><h3>📂 Categories</h3></div><div style={{padding:14}}>{ex.groups.map((g,i)=>{const d=dl(g.amount,g.prevAmount);return(<div key={i} style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,fontWeight:600}}>{g.name}</span><div style={{display:"flex",alignItems:"center",gap:6}}><span className="mn" style={{fontSize:11,color:"#2D5A3D"}}>{fmt(g.amount,cur)}</span><span style={{fontSize:10,fontWeight:600,color:d.up?"#C94444":"#2D5A3D"}}>{d.l}</span></div></div><PB v={ex.total?g.amount/ex.total*100:0} color={i<2?"#2D5A3D":"#7A9E7E"} h={5}/><div style={{marginTop:4,paddingLeft:12}}>{g.subs.map((s,j)=>(<div key={j} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:10,color:"#95A09C"}}>{s.name}</span><span style={{fontSize:10,color:"#64706C",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(s.amount,cur)}</span></div>))}</div></div>);})}</div></div>
            <div className="xc"><div className="xh"><h3>📈 Monthly</h3></div><div style={{padding:16}}>{(()=>{
              const CAT_COLORS: Record<string,string> = {"Cost of Sale":"#2D5A3D","Other":"#7A9E7E","Admin":"#D4845F","Facilities":"#C9A84C","Salaries":"#6B8FA3","Transportation":"#A67B5B","Financial":"#8B6F9E"};
              const catNames = ex.groups.map(g=>g.name);
              const maxTotal = Math.max(...ex.monthly.map(m=>m.amount),1);
              const barH = 160;
              return(<>
              {/* Legend */}
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",marginBottom:14}}>{catNames.map(cat=>(
                <div key={cat} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:10,height:10,borderRadius:3,background:CAT_COLORS[cat]||"#B0BAB6",flexShrink:0}}/>
                  <span style={{fontSize:9,color:"#64706C",whiteSpace:"nowrap"}}>{cat}</span>
                </div>
              ))}</div>
              {/* Stacked Bars */}
              {(()=>{const hovIdx=hovBar;const setHovIdx=setHovBar;return <div style={{position:"relative"}}><div style={{display:"flex",alignItems:"flex-end",gap:8,height:barH,padding:"0 4px"}}>{ex.monthly.map((m,idx)=>{
                const total = m.amount;
                const barPx = Math.max((total/maxTotal)*(barH-24),4);
                return(<div key={idx} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}} onMouseEnter={()=>setHovIdx(idx)} onMouseLeave={()=>setHovIdx(null)}>
                  <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",height:barH-24,width:"100%",maxWidth:40}}>
                    <div style={{height:barPx,borderRadius:"4px 4px 2px 2px",overflow:"hidden",display:"flex",flexDirection:"column",opacity:hovIdx===idx?1:.8,transition:"opacity .15s"}}>
                      {catNames.map((cat,ci)=>{
                        const catAmt = m.categories?.[cat]||0;
                        const pctH = total>0?(catAmt/total*100):0;
                        if(pctH<0.5) return null;
                        return <div key={ci} style={{width:"100%",flexBasis:`${pctH}%`,flexGrow:0,flexShrink:0,background:CAT_COLORS[cat]||"#B0BAB6",minHeight:pctH>0?1:0}}/>;
                      })}
                    </div>
                  </div>
                  <span style={{fontSize:8,color:hovIdx===idx?"#2C3E50":"#95A09C",fontWeight:hovIdx===idx?600:400,whiteSpace:"nowrap"}}>{m.month}</span>
                </div>);
              })}</div>{hovIdx!==null&&ex.monthly[hovIdx]&&(()=>{const m=ex.monthly[hovIdx];return <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:"#1A2B24",color:"#fff",padding:"10px 16px",borderRadius:8,fontSize:10,lineHeight:1.8,zIndex:20,boxShadow:"0 4px 12px rgba(0,0,0,.2)",pointerEvents:"none",minWidth:180}}><div style={{fontWeight:700,fontSize:11,marginBottom:4,borderBottom:"1px solid rgba(255,255,255,.15)",paddingBottom:4}}>{m.month} — {fmt(m.amount,cur)}</div>{catNames.filter(cat=>(m.categories?.[cat]||0)>0).map(cat=>(<div key={cat} style={{display:"flex",justifyContent:"space-between",gap:12}}><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:CAT_COLORS[cat]||"#B0BAB6",flexShrink:0}}/>{cat}</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{fmt(m.categories[cat],cur)}</span></div>))}</div>;})()}</div>})()}
              {/* Monthly totals list */}
              <div style={{marginTop:14}}>{ex.monthly.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #F2F0EC"}}>
                  <span style={{fontSize:11,color:"#64706C"}}>{m.month}</span>
                  <span className="mn" style={{fontSize:11,color:"#2D5A3D"}}>{fmt(m.amount,cur)}</span>
                </div>
              ))}</div>
              </>);
            })()}</div></div>
          </div>
          </>);})()}
        </div>:<div style={{padding:40,textAlign:"center",color:"#95A09C"}}>No data available</div>)}



        {/* ═══ PAGE: SOA (Dual Mode) ═══ */}
        {pg==="soa"&&<div style={{padding:20}}>
          <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",background:"#fff",border:"1px solid #E4E1DC",borderRadius:7,overflow:"hidden"}}>{[["customer","Customer Statement"],["supplier","Supplier Statement"]].map(([k,l])=>(<button key={k} onClick={()=>{setSoaMode(k);setSp(null);}} style={{padding:"8px 18px",fontSize:11,fontWeight:soaMode===k?600:400,color:soaMode===k?"#fff":"#64706C",background:soaMode===k?(k==="customer"?"#2D5A3D":"#C0714A"):"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>{l}</button>))}</div>
            <div ref={soaDropRef} style={{position:"relative",flex:1,minWidth:220,maxWidth:400}}>
              <div onClick={()=>setSoaDropOpen(!soaDropOpen)} style={{display:"flex",alignItems:"center",border:"1px solid #E4E1DC",borderRadius:7,background:"#fff",padding:"6px 10px",cursor:"pointer",gap:6}}>
                {soaDropOpen?<input autoFocus value={soaSearch} onChange={e=>{setSoaSearch(e.target.value);}} onClick={e=>e.stopPropagation()} placeholder={`Search ${soaMode==="customer"?"customers":"suppliers"}...`} style={{border:"none",outline:"none",flex:1,fontSize:12,fontFamily:"inherit",background:"transparent"}}/>:<span style={{flex:1,fontSize:12,color:sp?"#2C3E50":"#95A09C"}}>{sp?(partnersQ.data||[]).find(p=>p.id===sp)?.name||"Selected":`Select ${soaMode==="customer"?"Customer":"Supplier"}...`}</span>}
                {sp&&!soaDropOpen?<span onClick={e=>{e.stopPropagation();setSp(null);setSoaSearch("");}} style={{fontSize:14,color:"#95A09C",cursor:"pointer",padding:"0 2px",lineHeight:1}} title="Clear selection">✕</span>:<span style={{fontSize:10,color:"#95A09C",transform:soaDropOpen?"rotate(180deg)":"none",transition:"transform .15s"}}>▼</span>}
              </div>
              {soaDropOpen&&<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"#fff",border:"1px solid #E4E1DC",borderRadius:7,marginTop:4,maxHeight:280,overflowY:"auto",boxShadow:"0 4px 12px rgba(0,0,0,.1)"}}>
                {(()=>{const partners=(partnersQ.data||[]).filter(p=>soaMode==="customer"?(p.type==="customer"||p.type==="both"):(p.type==="supplier"||p.type==="both")).filter(p=>!soaSearch||p.name.toLowerCase().includes(soaSearch.toLowerCase()));return partners.length>0?partners.map(p=>(<div key={p.id} onClick={()=>{setSp(p.id);setSoaDropOpen(false);setSoaSearch("");}} style={{padding:"8px 12px",fontSize:12,cursor:"pointer",background:sp===p.id?"#E4EFE6":"transparent",borderBottom:"1px solid #F5F3F0"}} onMouseEnter={e=>{if(sp!==p.id)e.currentTarget.style.background="#F2F7F3"}} onMouseLeave={e=>{if(sp!==p.id)e.currentTarget.style.background="transparent"}}>{p.name}{sp===p.id&&<span style={{float:"right",color:"#2D5A3D"}}>✓</span>}</div>)):<div style={{padding:"12px",fontSize:12,color:"#95A09C",textAlign:"center"}}>No {soaMode}s matching "{soaSearch}"</div>})()}
              </div>}
            </div>
            {sp&&<><DateIn label="From:" value={soaF} onChange={setSoaF}/><DateIn label="To:" value={soaT2} onChange={setSoaT2}/><Badge type={soaMode==="customer"?"info":"warning"} label={soaMode==="customer"?"Customer":"Supplier"}/><button onClick={()=>{const params=new URLSearchParams();params.set("mode",soaMode);params.set("partnerId",String(sp));params.set("dateFrom",soaF);params.set("dateTo",soaT2);const partnerName=(partnersQ.data||[]).find(p=>p.id===sp)?.name||"Statement";params.set("partnerName",partnerName);window.open(`/api/statement-of-account-pdf?${params.toString()}`,"_blank");}} style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#C0714A",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>📄 Export PDF</button></>}
          </div>
          {sp&&soaQ.isLoading&&<PageSkeleton/>}
          {sp&&soaQ.data&&(()=>{const s=soaQ.data;const partnerName=(partnersQ.data||[]).find(p=>p.id===sp)?.name||"";return(<>
            <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
              {(soaMode==="customer"?[["Opening",fmt(s.openingBalance,cur),"as of "+soaF],["Invoiced",fmt(s.totalDebit,cur),"debits"],["Collected",fmt(s.totalCredit,cur),"credits"],["Customer Owes",fmt(s.closingBalance,cur),"balance"]]:[["Opening",fmt(Math.abs(s.openingBalance),cur),"as of "+soaF],["Billed",fmt(s.totalCredit,cur),"credits"],["Paid",fmt(s.totalDebit,cur),"debits"],["We Owe",fmt(Math.abs(s.closingBalance),cur),"balance"]]).map(([l,v,sub],i)=>(<div className="sc" key={i}><div className="sl">{l}</div><div className="sv" style={{fontSize:18}}>{v}</div><div className="ss">{sub}</div></div>))}
            </div>
            <div className="xc"><div className="xh" style={{background:soaMode==="customer"?"#2D5A3D":"#C0714A"}}><h3>{soaMode==="customer"?"📄":"📋"} {partnerName}</h3><span className="ct">{soaF} → {soaT2}</span></div>
              <div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Date</th><th>Ref</th><th>Description</th><th>Due</th><th style={{textAlign:"right"}}>{soaMode==="customer"?"Debit":"Debit (Paid)"}</th><th style={{textAlign:"right"}}>{soaMode==="customer"?"Credit":"Credit (Billed)"}</th><th style={{textAlign:"right"}}>Balance</th></tr></thead><tbody>
                {s.openingBalance!==0&&<tr style={{background:"#F2F7F3"}}><td className="mn" style={{fontSize:11}}>{soaF}</td><td style={{fontSize:11,color:"#4A7C59",fontStyle:"italic"}}>Opening</td><td colSpan={2}/><td/><td/><td className="mn" style={{textAlign:"right",fontSize:11,fontWeight:700}}>{soaMode==="supplier"&&s.openingBalance<0?"(":""}{fmt(Math.abs(s.openingBalance),cur)}{soaMode==="supplier"&&s.openingBalance<0?")":""}</td></tr>}
                {s.entries.map(t=>(<tr key={t.id}><td className="mn" style={{fontSize:11}}>{t.date}</td><td className="mn" style={{fontSize:11,color:"#2D5A3D"}} title={t.ref}>{t.ref}</td><td style={{fontSize:11}} title={t.description}>{t.description}</td><td className="mn" style={{fontSize:11,color:"#95A09C"}}>{t.dueDate||"—"}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:t.debit?"#2D5A3D":"#B0BAB6"}}>{t.debit?fmt(t.debit,cur):"—"}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:t.credit?"#C0714A":"#B0BAB6"}}>{t.credit?fmt(t.credit,cur):"—"}</td><td className="mn" style={{textAlign:"right",fontSize:11,fontWeight:700,color:soaMode==="customer"?(t.runningBalance>=0?"#2D5A3D":"#C94444"):(t.runningBalance<=0?"#C94444":"#2D5A3D")}}>{soaMode==="supplier"&&t.runningBalance<0?"(":""}{fmt(Math.abs(t.runningBalance),cur)}{soaMode==="supplier"&&t.runningBalance<0?")":""}</td></tr>))}
                <tr style={{background:"#F2F7F3"}}><td colSpan={4} style={{fontWeight:700,fontSize:11,textAlign:"right"}}>Totals:</td><td className="mn" style={{textAlign:"right",fontSize:11,fontWeight:700,color:"#2D5A3D"}}>{fmt(s.totalDebit,cur)}</td><td className="mn" style={{textAlign:"right",fontSize:11,fontWeight:700,color:"#C0714A"}}>{fmt(s.totalCredit,cur)}</td><td className="mn" style={{textAlign:"right",fontSize:12,fontWeight:700}}>{soaMode==="supplier"&&s.closingBalance<0?"(":""}{fmt(Math.abs(s.closingBalance),cur)}{soaMode==="supplier"&&s.closingBalance<0?")":""}</td></tr>
              </tbody></table></div>
            </div>
            <div style={{padding:10,background:"#FCFBFA",border:"1px solid #F0EDE9",borderRadius:8,fontSize:10,color:"#8A948F"}}>{soaMode==="customer"?<><strong style={{color:"#2D5A3D"}}>Customer:</strong> Debit = invoiced. Credit = collected. Positive = they owe you.</>:<><strong style={{color:"#C0714A"}}>Supplier:</strong> Credit = billed. Debit = paid. (Parentheses) = you owe them.</>}</div>
          </>);})()}
          {!sp&&<div style={{textAlign:"center",padding:60,color:"#B0BAB6"}}><div style={{fontSize:48,marginBottom:12}}>{soaMode==="customer"?"📄":"📋"}</div><div style={{fontSize:14}}>Select a {soaMode} to view their statement</div></div>}
        </div>}

        {/* ═══ PAGE: SALES ANALYTICS ═══ */}
        {pg==="salesanalytics"&&(saQ.isLoading?<PageSkeleton/>:saQ.isError?<SectionError/>:saQ.data?<div style={{padding:20}}>
          <PeriodBar value={saP} onChange={setSaP} options={["30d","90d","ytd"]} cf={saF} ct={saT} oCf={setSaF} oCt={setSaT}/>
          {(()=>{const sa=saQ.data;const topCust=sa.customers[0];const maxTons=sa.customers.length>0?sa.customers[0].totalTons:1;
          // Mini bar chart helper
          const MiniBar=({data,color,valueKey,labelFn}:{data:any[],color:string,valueKey:string,labelFn:(v:number)=>string})=>{
            const max=Math.max(...data.map(d=>d[valueKey]||0),1);
            return(<div style={{display:"flex",alignItems:"flex-end",gap:6,height:160,padding:"0 4px"}}>{data.map((m,i)=>{const h=max>0?((m[valueKey]||0)/max*140):0;return(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><div style={{fontSize:9,fontWeight:700,color}}>{labelFn(m[valueKey]||0)}</div><div style={{width:"100%",maxWidth:44,height:h,background:color,borderRadius:"3px 3px 0 0",minHeight:m[valueKey]>0?2:0}}/><div style={{fontSize:8,color:"#64706C",textAlign:"center",lineHeight:1.1}}>{m.month}</div></div>);})}</div>);
          };
          return(<>
          {/* KPI Cards */}
          <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>{[["Total Tons",sa.totalTons.toFixed(1)+" t",sa.customerCount+" customers"],["Total Shipments",sa.totalOrders+" SOs",sa.totalContainers+" containers"],["Top Customer",topCust?.name||"—",topCust?(topCust.totalTons.toFixed(1)+" t"):""],["Avg/Customer",(sa.customerCount>0?(sa.totalTons/sa.customerCount).toFixed(1):"0")+" t",""]].map(([l,v,s],i)=>(<div className="sc" key={i}><div className="sl">{l}</div><div className="sv" style={{fontSize:16}}>{v}</div><div className="ss">{s}</div></div>))}</div>

          {/* Customer Distribution Charts */}
          {sa.customers.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}}>

            {/* Donut chart — Tons distribution */}
            {(()=>{
              const COLORS=["#2D5A3D","#C0714A","#4A7FA5","#8B6BAE","#D4A843","#5B8C5A","#A05050","#3A7A9C"];
              const total=sa.totalTons||1;
              // Build SVG donut
              const r=70,cx=90,cy=90,stroke=28;
              const circumference=2*Math.PI*r;
              let offset=0;
              const slices=sa.customers.map((c,i)=>{
                const pct=c.totalTons/total;
                const dash=pct*circumference;
                const gap=circumference-dash;
                const s={pct,dash,gap,offset,color:COLORS[i%COLORS.length],name:c.name,tons:c.totalTons};
                offset+=dash;
                return s;
              });
              return(
              <div className="xc"><div className="xh"><h3>🥧 Tons Distribution</h3></div>
              <div style={{padding:"16px",display:"flex",gap:16,alignItems:"center"}}>
                <svg width={180} height={180} style={{flexShrink:0}}>
                  {slices.map((s,i)=>(
                    <circle key={i} cx={cx} cy={cy} r={r}
                      fill="none" stroke={s.color} strokeWidth={stroke}
                      strokeDasharray={`${s.dash} ${s.gap}`}
                      strokeDashoffset={-s.offset}
                      style={{transform:"rotate(-90deg)",transformOrigin:`${cx}px ${cy}px`}}
                    />
                  ))}
                  <text x={cx} y={cy-8} textAnchor="middle" style={{fontSize:13,fontWeight:700,fill:"#2C3E50"}}>{sa.totalTons.toFixed(0)}</text>
                  <text x={cx} y={cy+10} textAnchor="middle" style={{fontSize:10,fill:"#64706C"}}>tons total</text>
                </svg>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                  {slices.map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:10,height:10,borderRadius:2,background:s.color,flexShrink:0}}/>
                      <div style={{flex:1,fontSize:10,color:"#2C3E50",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                      <div style={{fontSize:10,fontWeight:700,color:s.color,whiteSpace:"nowrap"}}>{(s.pct*100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
              </div>);
            })()}

            {/* Horizontal bar chart — Tons per customer */}
            {(()=>{
              const COLORS=["#2D5A3D","#C0714A","#4A7FA5","#8B6BAE","#D4A843","#5B8C5A","#A05050","#3A7A9C"];
              const maxT=sa.customers[0]?.totalTons||1;
              return(
              <div className="xc"><div className="xh"><h3>📊 Tons by Customer</h3></div>
              <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
                {sa.customers.map((c,i)=>(
                  <div key={i}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,fontWeight:600,color:"#2C3E50",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{c.name}</span>
                      <span style={{fontSize:10,fontWeight:700,color:COLORS[i%COLORS.length],whiteSpace:"nowrap"}}>{c.totalTons.toFixed(1)} t &nbsp;<span style={{color:"#95A09C",fontWeight:400}}>({c.pctTons.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{background:"#E4EFE6",borderRadius:4,height:8,overflow:"hidden"}}>
                      <div style={{width:(c.totalTons/maxT*100)+"%",height:"100%",background:COLORS[i%COLORS.length],borderRadius:4,transition:"width 0.4s ease"}}/>
                    </div>
                  </div>
                ))}
              </div>
              </div>);
            })()}

          </div>}

          {/* Customer Ranking Table */}
          <div className="xc" style={{marginTop:16}}><div className="xh"><h3>📊 Sales by Customer</h3></div>
          <div className="mob-table-scroll"><table className="tbl"><thead><tr><th style={{textAlign:"left"}}>Customer</th><th style={{textAlign:"right"}}>Tons</th><th style={{textAlign:"right"}}>%</th><th style={{textAlign:"right"}}>Shipments</th><th style={{textAlign:"right"}}>Containers</th><th style={{textAlign:"right"}}>Amount</th><th style={{width:"15%"}}>Bar</th></tr></thead><tbody>{sa.customers.map((c,i)=>(<tr key={i}><td style={{fontWeight:600,fontSize:12}}>{c.name}</td><td className="mn" style={{textAlign:"right",fontWeight:700,fontSize:13}}>{c.totalTons.toFixed(1)}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:"#64706C"}}>{c.pctTons.toFixed(1)}%</td><td className="mn" style={{textAlign:"right",fontSize:12}}>{c.orderCount}</td><td className="mn" style={{textAlign:"right",fontSize:12,color:"#2D5A3D",fontWeight:600}}>{c.totalContainers}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:"#64706C"}}>{c.currency} {c.totalAmount.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}</td><td><div style={{background:"#E4EFE6",borderRadius:4,height:10,overflow:"hidden"}}><div style={{width:(c.totalTons/maxTons*100)+"%",height:"100%",background:"#2D5A3D",borderRadius:4}}/></div></td></tr>))}</tbody></table></div>
          {sa.customers.length===0&&<div style={{padding:20,textAlign:"center",color:"#95A09C",fontSize:11}}>No sales data for this period</div>}
          </div>

          {/* Ultimate Customer Distribution */}
          {sa.ultimateCustomers&&sa.ultimateCustomers.length>0&&(()=>{
            const COLORS=["#2D5A3D","#C0714A","#4A7FA5","#8B6BAE","#D4A843","#5B8C5A","#A05050","#3A7A9C","#6B8E6B","#C4956A"];
            const ucList=sa.ultimateCustomers;
            const maxUCTons=ucList[0]?.tons||1;
            // SVG donut
            const r=70,cx=90,cy=90,stroke=28;
            const circumference=2*Math.PI*r;
            let offset=0;
            const totalUCT=ucList.reduce((s,u)=>s+u.tons,0)||1;
            const slices=ucList.map((u,i)=>{
              const pct=u.tons/totalUCT;
              const dash=pct*circumference;
              const gap=circumference-dash;
              const s={pct,dash,gap,offset,color:COLORS[i%COLORS.length],name:u.name,tons:u.tons};
              offset+=dash;
              return s;
            });
            return(
            <div className="xc" style={{marginTop:16}}>
              <div className="xh" style={{background:"#4A7FA5"}}><h3>🎯 Ultimate Customer Distribution</h3><span className="ct">{ucList.length} end buyers</span></div>
              <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16,padding:"16px 20px",alignItems:"start"}}>
                {/* Donut */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                  <svg width={180} height={180}>
                    {slices.map((s,i)=>(
                      <circle key={i} cx={cx} cy={cy} r={r}
                        fill="none" stroke={s.color} strokeWidth={stroke}
                        strokeDasharray={`${s.dash} ${s.gap}`}
                        strokeDashoffset={-s.offset}
                        style={{transform:"rotate(-90deg)",transformOrigin:`${cx}px ${cy}px`}}
                      />
                    ))}
                    <text x={cx} y={cy-8} textAnchor="middle" style={{fontSize:13,fontWeight:700,fill:"#2C3E50"}}>{totalUCT.toFixed(0)}</text>
                    <text x={cx} y={cy+10} textAnchor="middle" style={{fontSize:10,fill:"#64706C"}}>tons</text>
                  </svg>
                  <div style={{display:"flex",flexDirection:"column",gap:4,width:"100%"}}>
                    {slices.map((s,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/>
                        <div style={{flex:1,fontSize:9,color:"#2C3E50",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                        <div style={{fontSize:9,fontWeight:700,color:s.color,whiteSpace:"nowrap"}}>{(s.pct*100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Horizontal bars + table */}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {ucList.map((u,i)=>(
                    <div key={i}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:11,fontWeight:600,color:"#2C3E50",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%"}}>{u.name}</span>
                        <span style={{fontSize:11,fontWeight:700,color:COLORS[i%COLORS.length],whiteSpace:"nowrap"}}>{u.tons.toFixed(1)} t <span style={{color:"#95A09C",fontWeight:400,fontSize:10}}>({u.pctTons.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{background:"#E8F0F8",borderRadius:4,height:8,overflow:"hidden"}}>
                        <div style={{width:(u.tons/maxUCTons*100)+"%",height:"100%",background:COLORS[i%COLORS.length],borderRadius:4,transition:"width 0.4s ease"}}/>
                      </div>
                      <div style={{fontSize:9,color:"#95A09C",marginTop:1}}>{u.orderCount} SO{u.orderCount!==1?"s":""}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>);
          })()}

          {/* Trend Charts Row */}
          {sa.monthly.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginTop:16}}>

            {/* Tons Trend */}
            <div className="xc"><div className="xh"><h3>⚖️ Tons Exported</h3></div>
            <div style={{padding:"12px 16px"}}>
              <MiniBar data={sa.monthly} color="#2D5A3D" valueKey="tons" labelFn={v=>v>0?v.toFixed(0)+"t":"0"}/>
            </div>
            <div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Month</th><th style={{textAlign:"right"}}>Tons</th></tr></thead><tbody>{sa.monthly.map((m,i)=>(<tr key={i}><td style={{fontSize:11}}>{m.month}</td><td className="mn" style={{textAlign:"right",fontWeight:700,fontSize:12}}>{(m.tons||0).toFixed(1)}</td></tr>))}</tbody></table></div>
            </div>

            {/* Shipments Trend */}
            <div className="xc"><div className="xh" style={{background:"#C0714A"}}><h3>🚚 Shipments (#SOs)</h3></div>
            <div style={{padding:"12px 16px"}}>
              <MiniBar data={sa.monthly} color="#C0714A" valueKey="orders" labelFn={v=>v>0?v+" SO":"—"}/>
            </div>
            <div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Month</th><th style={{textAlign:"right"}}># SOs</th></tr></thead><tbody>{sa.monthly.map((m,i)=>(<tr key={i}><td style={{fontSize:11}}>{m.month}</td><td className="mn" style={{textAlign:"right",fontWeight:700,fontSize:12,color:"#C0714A"}}>{m.orders||0}</td></tr>))}</tbody></table></div>
            </div>

            {/* Containers Trend */}
            <div className="xc"><div className="xh" style={{background:"#4A7FA5"}}><h3>📦 Containers Exported</h3></div>
            <div style={{padding:"12px 16px"}}>
              <MiniBar data={sa.monthly} color="#4A7FA5" valueKey="containers" labelFn={v=>v>0?v+" ctr":"—"}/>
            </div>
            <div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Month</th><th style={{textAlign:"right"}}># Containers</th></tr></thead><tbody>{sa.monthly.map((m,i)=>(<tr key={i}><td style={{fontSize:11}}>{m.month}</td><td className="mn" style={{textAlign:"right",fontWeight:700,fontSize:12,color:"#4A7FA5"}}>{m.containers||0}</td></tr>))}</tbody></table></div>
            </div>

          </div>}

          </>);})()}
        </div>:<div style={{padding:40,textAlign:"center",color:"#95A09C"}}>No data available</div>)}

        {/* ═══ PAGE: EXPORT FEES ═══ */}
        {pg==="exportfees"&&(exfQ.isLoading?<PageSkeleton/>:exfQ.isError?<SectionError/>:exfQ.data?<div style={{padding:20}}>
          <PeriodBar value={efP} onChange={setEfP} options={["30d","90d","ytd"]} cf={efF} ct={efT} oCf={setEfF} oCt={setEfT}/>
          {(()=>{const ef=exfQ.data;const avgMo=ef.monthly.length>0?Math.round(ef.total/ef.monthly.length):0;return(<>
          <div style={{fontSize:10,color:"#95A09C",marginBottom:12}}>Account <strong style={{color:"#2C3E50"}}>{ef.accountCode}</strong> — cumulative since first posting</div>
          <div className="sg" style={{gridTemplateColumns:"repeat(4,1fr)"}}>{[["Cumulative",fmt(ef.total,cur),ef.monthly.length+"mo"],["Avg/Mo",fmt(avgMo,cur),""],["Txns",ef.transactionCount,"entries"],["Account",ef.accountCode,""]].map(([l,v,s],i)=>(<div className="sc" key={i}><div className="sl">{l}</div><div className="sv" style={{fontSize:16}}>{v}</div><div className="ss">{s}</div></div>))}</div>
          <div className="mob-detail-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div className="xc"><div className="xh"><h3>📈 Monthly</h3></div><div style={{padding:16}}><MBar data={ef.monthly.map(m=>({m:m.month,i:m.amount,o:0}))}/></div><div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Month</th><th style={{textAlign:"right"}}>Amount</th><th style={{textAlign:"right"}}>Cumulative</th></tr></thead><tbody>{ef.monthly.map((m,i)=>(<tr key={i}><td style={{fontSize:11}}>{m.month}</td><td className="mn" style={{textAlign:"right",fontSize:11}}>{fmt(m.amount,cur)}</td><td className="mn" style={{textAlign:"right",fontSize:11,color:"#2D5A3D"}}>{fmt(m.cumulative,cur)}</td></tr>))}</tbody></table></div></div>
            <div className="xc"><div className="xh" style={{background:"#C0714A"}}><h3>📋 Recent</h3></div><div className="mob-table-scroll"><table className="tbl"><thead><tr><th>Date</th><th>Entry</th><th>Partner</th><th>Label</th><th style={{textAlign:"right"}}>Debit</th></tr></thead><tbody>{ef.recent.map(t=>(<tr key={t.id}><td className="mn" style={{fontSize:11}}>{t.date}</td><td className="mn" style={{color:"#2D5A3D",fontSize:10}}>{t.journalEntry}</td><td style={{fontSize:11}}>{t.partner}</td><td style={{fontSize:10,color:"#64706C",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.label}</td><td className="mn" style={{textAlign:"right",fontSize:11}}>{fmt(t.debit,cur)}</td></tr>))}</tbody></table></div>{ef.recent.length===0&&<div style={{padding:20,textAlign:"center",color:"#95A09C",fontSize:11}}>No entries found</div>}</div>
          </div>
          </>);})()}
        </div>:<div style={{padding:40,textAlign:"center",color:"#95A09C"}}>No data available</div>)}



      </div>
      {/* Mobile bottom bar */}
      <div className="fin-mob-bar">
        {[["health","🛡","Health"],["overview","🏦","Cash"],["receivables","📈","AR"],["payables","📉","AP"],["expenses","📊","Expenses"],["salesanalytics","💰","Sales"],["soa","📄","SOA"],["exportfees","🚢","Export"]].map(([k,icon,label])=>(
          <div key={k} className={pg===k?"act":""} onClick={()=>setPg(k)}>
            <span className="icon">{icon}</span>{label}
          </div>
        ))}
      </div>
    </div>
  );
}
