import { useEffect, useMemo, useState } from "react";
import { Printer, RefreshCw, Search } from "lucide-react";
import { supabase } from "../lib/supabase";

type Attendance={id:string;employee_id:string;attendance_date:string;check_in:string|null;check_out:string|null;status:string|null};
type Employee={id:string;full_name:string;employee_code:string|null;status?:string|null};

export function HRModules({lang}:{section:"reports";lang:"en"|"ar"}){
 const ar=lang==="ar";const tx=(en:string,aa:string)=>ar?aa:en;
 const [records,setRecords]=useState<Attendance[]>([]);const [employees,setEmployees]=useState<Employee[]>([]);
 const [period,setPeriod]=useState<"day"|"month">("month");
 const [date,setDate]=useState(new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Baghdad"}));
 const [query,setQuery]=useState("");const [selectedEmployee,setSelectedEmployee]=useState("all");const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 async function load(){if(!supabase){setError(tx("Supabase is not configured.","Supabase غير مهيأ."));setLoading(false);return;}setLoading(true);setError("");const [a,e]=await Promise.all([supabase.from("attendance").select("id,employee_id,attendance_date,check_in,check_out,status").order("attendance_date",{ascending:false}),supabase.from("employees").select("id,full_name,employee_code,status").order("full_name")]);if(a.error)setError(a.error.message);else setRecords((a.data??[]) as Attendance[]);if(e.error)setError(e.error.message);else setEmployees((e.data??[]) as Employee[]);setLoading(false)}
 useEffect(()=>{void load()},[]);
 const names=useMemo(()=>new Map(employees.map(e=>[e.id,e])),[employees]);
 const dateList=period==="day"?[date]:Array.from({length:new Date(Number(date.slice(0,4)),Number(date.slice(5,7)),0).getDate()},(_,i)=>`${date.slice(0,7)}-${String(i+1).padStart(2,"0")}`);
 const isFriday=(value:string)=>new Date(`${value}T12:00:00+03:00`).getDay()===5;
 const baseFiltered=records.filter(r=>period==="day"?r.attendance_date===date:r.attendance_date.startsWith(date.slice(0,7))).filter(r=>!isFriday(r.attendance_date)).filter(r=>selectedEmployee==="all"||r.employee_id===selectedEmployee).filter(r=>{const n=names.get(r.employee_id);return !query||[n?.full_name,n?.employee_code].some(v=>(v??"").toLowerCase().includes(query.toLowerCase()))});
 const weeklyOffRows:Attendance[]=dateList.filter(isFriday).flatMap(day=>employees.filter(e=>e.status!=="inactive"&&(selectedEmployee==="all"||e.id===selectedEmployee)&&(!query||[e.full_name,e.employee_code].some(v=>(v??"").toLowerCase().includes(query.toLowerCase())))).map(e=>({id:`weekly-off:${e.id}:${day}`,employee_id:e.id,attendance_date:day,check_in:null,check_out:null,status:"weekly_off"})));
 const filtered=[...baseFiltered,...weeklyOffRows].sort((a,b)=>b.attendance_date.localeCompare(a.attendance_date)||((names.get(a.employee_id)?.full_name??"").localeCompare(names.get(b.employee_id)?.full_name??"")));
 const present=filtered.filter(r=>r.check_in||r.status==="present").length;
 const completed=filtered.filter(r=>r.check_in&&r.check_out).length;
 return <section className="hr-module report-page" dir={ar?"rtl":"ltr"}><style>{`
 .report-page{display:grid;gap:16px;color:#263238}
 .report-page .panel{padding:20px;border-radius:10px;background:#fff;color:#263238}
 .report-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
 .report-head h3{font-size:19px;margin:0 0 4px;color:#202b33}
 .report-head p{font-size:13px;color:#687780;margin:0}
 .report-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0}
 .report-tools button,.report-tools input,.report-tools select{border:1px solid #d6dde1;border-radius:6px;background:#fff;padding:9px 11px;color:#263238;font:inherit;font-size:13px}
 .report-tools button.active{background:#eef2f3;border-color:#aebbc0;color:#263238}
 .report-tools button{cursor:pointer}
 .report-employee-select{min-width:190px}
 .report-search{display:flex;align-items:center;gap:7px;border:1px solid #d6dde1;border-radius:6px;padding-inline:9px;background:#fff}
 .report-search input{border:0;outline:0;min-width:150px}
 .report-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px}
 .report-stat{background:#fff;border:1px solid #e0e5e8;border-radius:7px;padding:12px}
 .report-stat span{display:block;color:#687780;font-size:12px}
 .report-stat strong{display:block;color:#202b33;font-size:22px;margin-top:4px}
 .report-table{width:100%;border-collapse:collapse;min-width:560px;background:#fff}
 .report-table th{background:#f1f3f4;color:#263238;text-align:start;font-size:12px;font-weight:600;padding:10px;border:1px solid #dce1e4}
 .report-table td{border:1px solid #e1e5e7;padding:9px 10px;font-size:13px;color:#303b40;background:#fff}
  .report-badge{display:inline-block;color:#303b40;font-size:12px}
 .report-table tr.report-weekly-off td{background:#fff1c7!important;color:#8b6816!important}
 .report-table tr.report-weekly-off .report-badge{color:#8b6816!important;font-weight:700}
 .report-empty{text-align:center;padding:24px;color:#687780}
 .report-error{background:#fff0f0;color:#a83232;border-radius:6px;padding:10px}
 .report-print-heading{display:none}
 @media(max-width:650px){.report-stats{grid-template-columns:1fr}.report-tools>*{max-width:100%}}
 @media print{
  @page{size:A4 portrait;margin:12mm}
  :root{color-scheme:light!important}
  html,body,#root,.app-shell,.main-area,.page-content{background:#fff!important;color:#111!important;width:100%!important;min-width:0!important;margin:0!important;padding:0!important;box-shadow:none!important}
  body{ -webkit-print-color-adjust:economy!important;print-color-adjust:economy!important}
  .sidebar,.topbar,.page-heading,.report-tools,.report-error{display:none!important}
  .report-page,.report-page *{visibility:visible!important;color:#111!important;box-shadow:none!important;text-shadow:none!important}
  .report-page{display:block!important;background:#fff!important;color:#111!important;width:100%!important;margin:0!important;padding:0!important}
  .report-page .panel{display:block!important;background:#fff!important;border:0!important;border-radius:0!important;margin:0!important;padding:0!important}
  .report-print-heading{display:block!important;background:#fff!important;margin:0 0 8mm;padding:0 0 4mm;border-bottom:1px solid #999}
  .report-print-heading h2{font-size:17pt;font-weight:600;margin:0 0 3mm;color:#111!important}
  .report-print-heading p{display:inline-block;font-size:9pt;margin:0 7mm 0 0;color:#333!important}
  .report-stats{display:flex!important;gap:8mm;margin:0 0 6mm}
  .report-stat{flex:1;background:#fff!important;border:1px solid #ccc!important;border-radius:0!important;padding:3mm}
  .report-stat span{font-size:8pt;color:#444!important}
  .report-stat strong{font-size:15pt;color:#111!important}
  .table-wrap{display:block!important;overflow:visible!important;width:100%!important}
  .report-table{display:table!important;width:100%!important;min-width:0!important;table-layout:auto!important;border-collapse:collapse!important;background:#fff!important}
  .report-table thead{display:table-header-group}
  .report-table tr{break-inside:avoid;page-break-inside:avoid}
  .report-table th,.report-table td{background:#fff!important;color:#111!important;border:1px solid #bbb!important;padding:2.5mm 2mm!important;font-size:8.5pt!important}
  .report-table tr.report-weekly-off td{background:#fff1c7!important;color:#76550d!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .report-table th{font-weight:700!important}
  .report-badge{background:#fff!important;color:#111!important}
 }
 `}</style>
 <div className="panel"><div className="report-head"><div><h3>{tx("Attendance reports","تقارير الحضور")}</h3><p>{tx("Simple attendance report","تقرير حضور بسيط")}</p></div><div style={{display:"flex",gap:8}}><button className="report-tools" style={{margin:0}} onClick={()=>void load()}><RefreshCw size={15}/>{tx("Refresh","تحديث")}</button><button className="report-tools" style={{margin:0}} onClick={()=>window.print()}><Printer size={15}/>{tx("Print","طباعة")}</button></div></div>
 {error&&<div className="report-error">{error}</div>}
 <div className="report-print-heading"><h2>{tx("Attendance report","تقرير الحضور")}</h2><p>{tx("Employee:","الموظف:")} {selectedEmployee==="all"?tx("All employees","جميع الموظفين"):(names.get(selectedEmployee)?.full_name??"—")}</p><p>{tx("Period:","الفترة:")} {period==="day"?date:date.slice(0,7)}</p><p>{tx("Generated:","تاريخ الإصدار:")} {new Date().toLocaleDateString(ar?"ar-IQ":"en-GB",{year:"numeric",month:"short",day:"numeric",timeZone:"Asia/Baghdad"})}</p></div>
 <div className="report-tools"><button className={period==="day"?"active":""} onClick={()=>setPeriod("day")}>{tx("Daily","يومي")}</button><button className={period==="month"?"active":""} onClick={()=>setPeriod("month")}>{tx("Monthly","شهري")}</button><input type={period==="day"?"date":"month"} value={period==="day"?date:date.slice(0,7)} onChange={e=>setDate(period==="day"?e.target.value:e.target.value+"-01")}/><select className="report-employee-select" aria-label={tx("Select employee","اختيار الموظف")} value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)}><option value="all">{tx("All employees","جميع الموظفين")}</option>{employees.map(employee=><option key={employee.id} value={employee.id}>{employee.full_name}{employee.employee_code?` · ${employee.employee_code}`:""}</option>)}</select><div className="report-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={tx("Search employee","ابحث عن موظف")}/></div></div>
 <div className="report-stats"><div className="report-stat"><span>{tx("Attendance records","سجلات الحضور")}</span><strong>{filtered.length}</strong></div><div className="report-stat"><span>{tx("Present","حاضر")}</span><strong>{present}</strong></div><div className="report-stat"><span>{tx("Completed check-outs","مكتمل الانصراف")}</span><strong>{completed}</strong></div></div>
 <div className="table-wrap"><table className="report-table"><thead><tr><th>{tx("Employee","الموظف")}</th><th>{tx("Date","التاريخ")}</th><th>{tx("Check in","الدخول")}</th><th>{tx("Check out","الخروج")}</th><th>{tx("Status","الحالة")}</th></tr></thead><tbody>{loading?<tr><td colSpan={5} className="report-empty">{tx("Loading...","جارٍ التحميل...")}</td></tr>:filtered.length===0?<tr><td colSpan={5} className="report-empty">{tx("No records for this period.","لا توجد سجلات لهذه الفترة.")}</td></tr>:filtered.map(r=><tr key={r.id} className={r.status==="weekly_off"?"report-weekly-off":""}><td><strong>{names.get(r.employee_id)?.full_name??"—"}</strong><div style={{fontSize:11,color:"#687780"}}>{names.get(r.employee_id)?.employee_code??""}</div></td><td>{r.attendance_date}</td><td>{r.check_in?new Date(r.check_in).toLocaleTimeString(ar?"ar-IQ":"en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Baghdad"}):"—"}</td><td>{r.check_out?new Date(r.check_out).toLocaleTimeString(ar?"ar-IQ":"en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Baghdad"}):"—"}</td><td><span className="report-badge">{r.status==="weekly_off"?tx("Weekly off","عطلة أسبوعية"):r.status??"—"}</span></td></tr>)}</tbody></table></div>
 </div></section>
}
