import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, RefreshCw, Check, LogOut, Palmtree } from "lucide-react";
import { supabase } from "../lib/supabase";

type AttendanceRow = { id: string; employee_id: string; attendance_date: string; check_in: string | null; check_out: string | null; status: string | null };
type EmployeeRow = { id: string; full_name: string; employee_code: string | null; status?: string | null };
type ProfileRow = { employee_id: string | null; login_email: string | null; is_active: boolean };
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const todayBaghdad = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const nowBaghdad = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
const timeText = (v: string | null) => v ? new Date(v).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Baghdad"}) : "—";
const stamp = (date: string,time: string) => new Date(`${date}T${time}:00+03:00`).toISOString();

export default function AttendanceManagement({ lang }: { lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const [selectedDate,setSelectedDate] = useState(todayBaghdad());
  const [employees,setEmployees] = useState<EmployeeRow[]>([]);
  const [profiles,setProfiles] = useState<ProfileRow[]>([]);
  const [records,setRecords] = useState<AttendanceRow[]>([]);
  const [selectedEmployee,setSelectedEmployee] = useState("all");
  const [timeDialog,setTimeDialog] = useState<{employee:EmployeeRow;kind:"check_in"|"check_out"}|null>(null);
  const [time,setTime] = useState(nowBaghdad());
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [calendarMonth,setCalendarMonth] = useState(monthKey(new Date()));

  const monthDays = useMemo(() => {
    const [y,m] = calendarMonth.split("-").map(Number);
    const first = new Date(y,m-1,1);
    const count = new Date(y,m,0).getDate();
    const offset = first.getDay();
    return { offset, days: Array.from({length:count},(_,i)=>`${calendarMonth}-${String(i+1).padStart(2,"0")}`) };
  },[calendarMonth]);
  const recordMap = useMemo(()=>new Map(records.map(r=>[`${r.employee_id}|${r.attendance_date}`,r])),[records]);
  const profileMap = useMemo(()=>new Map(profiles.map(p=>[p.employee_id,p])),[profiles]);
  const activeEmployees = employees.filter(e=>e.status !== "inactive");
  const rows = selectedEmployee === "all" ? activeEmployees : activeEmployees.filter(e=>e.id===selectedEmployee);
  const dayOffDates = useMemo(()=>new Set(records.filter(r=>["day_off","day-off","leave"].includes(r.status??"")).map(r=>r.attendance_date)),[records]);
  const dayRecords = rows.map(employee=>({employee,record:recordMap.get(`${employee.id}|${selectedDate}`)??null}));
  const presentCount = dayRecords.filter(x=>x.record?.check_in || x.record?.status==="present").length;
  const offCount = dayRecords.filter(x=>["day_off","day-off","leave"].includes(x.record?.status??"")).length;
  const absentCount = dayRecords.filter(x=>!x.record).length;

  async function load() {
    if(!supabase) return;
    setLoading(true); setError("");
    const start = calendarMonth+"-01";
    const [e,a,p] = await Promise.all([
      supabase.from("employees").select("id,full_name,employee_code,status").order("full_name"),
      supabase.from("attendance").select("id,employee_id,attendance_date,check_in,check_out,status").gte("attendance_date",start).lte("attendance_date",calendarMonth+"-"+String(new Date(Number(calendarMonth.slice(0,4)),Number(calendarMonth.slice(5,7)),0).getDate()).padStart(2,"0")),
      supabase.from("user_profiles").select("employee_id,login_email,is_active")
    ]);
    if(e.error) setError(e.error.message); else setEmployees((e.data??[]) as EmployeeRow[]);
    if(a.error) setError(a.error.message); else setRecords((a.data??[]) as AttendanceRow[]);
    if(p.error) setError(p.error.message); else setProfiles((p.data??[]) as ProfileRow[]);
    setLoading(false);
  }
  useEffect(()=>{void load();},[calendarMonth]);
  function shiftMonth(delta:number) {
    const [y,m]=calendarMonth.split("-").map(Number);
    setCalendarMonth(monthKey(new Date(y,m-1+delta,1)));
  }
  function openTime(employee:EmployeeRow,kind:"check_in"|"check_out") {
    setError("");setNotice("");setTime(nowBaghdad());setTimeDialog({employee,kind});
  }
  async function saveTime() {
    if(!supabase||!timeDialog)return;
    setBusy(true);setError("");setNotice("");
    const old=recordMap.get(`${timeDialog.employee.id}|${selectedDate}`);
    const value=stamp(selectedDate,time);
    const result=timeDialog.kind==="check_in"
      ? old ? await supabase.from("attendance").update({check_in:value,status:"present"}).eq("id",old.id) : await supabase.from("attendance").insert({employee_id:timeDialog.employee.id,attendance_date:selectedDate,check_in:value,status:"present"})
      : old ? await supabase.from("attendance").update({check_out:value,status:"present"}).eq("id",old.id) : await supabase.from("attendance").insert({employee_id:timeDialog.employee.id,attendance_date:selectedDate,check_out:value,status:"present"});
    if(result.error)setError(result.error.message);else{setTimeDialog(null);setNotice(ar?"تم حفظ وقت الدوام.":"Time record saved.");await load();}
    setBusy(false);
  }
  async function dayOff(employee:EmployeeRow) {
    if(!supabase)return;
    setBusy(true);setError("");setNotice("");
    const old=recordMap.get(`${employee.id}|${selectedDate}`);
    const payload={check_in:null,check_out:null,status:"day_off"};
    const result=old?await supabase.from("attendance").update(payload).eq("id",old.id):await supabase.from("attendance").insert({employee_id:employee.id,attendance_date:selectedDate,...payload});
    if(result.error)setError(result.error.message);else{setNotice(ar?"تم تسجيل يوم الإجازة.":"Day off recorded.");await load();}
    setBusy(false);
  }
  const monthTitle = new Date(Number(calendarMonth.slice(0,4)),Number(calendarMonth.slice(5,7))-1,1).toLocaleDateString(ar?"ar-IQ":"en-US",{month:"long",year:"numeric"});
  const weekdayNames = ar ? ["ح","ن","ث","ر","خ","ج","س"] : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const label = (en:string,arabic:string)=>ar?arabic:en;

  return <section className="att-screen" dir={ar?"rtl":"ltr"}>
    <style>{`
      .att-screen{color:#e6edf7}.att-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:22px 24px;border:1px solid #35516d;border-radius:12px;background:linear-gradient(120deg,#1b2a3d,#1d3045);margin-bottom:14px}.att-head h2{margin:4px 0 6px;font-size:22px}.att-head p{margin:0;color:#a9b9ca;font-size:13px}.att-kicker{font-size:10px;letter-spacing:1.3px;color:#9cc7f3;font-weight:800}.att-refresh,.att-nav,.att-action{border:1px solid #344b63;background:#142235;color:#dce8f5;border-radius:7px;padding:9px 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.att-refresh:hover,.att-nav:hover{background:#203751}.att-panel{border:1px solid #344b63;background:#1b2939;border-radius:11px;overflow:hidden}.att-panel-title{padding:17px 20px;border-bottom:1px solid #34475c}.att-panel-title h3{margin:0 0 5px;font-size:15px}.att-panel-title p{margin:0;color:#a8b8ca;font-size:12px}.att-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;padding:0 15px 15px}.att-main{min-width:0}.att-datebar{padding:12px 0 10px;display:flex;align-items:center;justify-content:space-between;gap:10px}.att-datebar strong{font-size:14px}.att-datebar span{font-size:11px;color:#a8b8ca}.att-datebar input,.att-calendar select{background:#142235;color:#e5edf8;border:1px solid #354b62;border-radius:7px;padding:8px}.att-table-wrap{overflow:auto;border:1px solid #34475c;border-radius:8px}.att-table{width:100%;border-collapse:collapse;min-width:680px}.att-table th{background:#1b2a3c;color:#93a6bc;text-transform:uppercase;font-size:10px;letter-spacing:.7px;text-align:left;padding:13px 12px;border-bottom:1px solid #3b5066}.att-table td{padding:12px;border-bottom:1px solid #2d4054;font-size:12px;color:#dbe5f1}.att-table tr:last-child td{border-bottom:0}.att-person{font-weight:700;color:#f0f5fb}.att-sub{display:block;color:#8297ae;font-size:10px;margin-top:4px}.att-time{font-variant-numeric:tabular-nums;color:#c5d4e5}.att-pill{display:inline-flex;padding:5px 8px;border-radius:20px;font-size:10px;font-weight:700}.att-pill.present{background:#123e36;color:#70d6b5}.att-pill.off{background:#4a3c16;color:#f4d36e}.att-pill.absent{background:#3b2a30;color:#e9a2a9}.att-actions{display:flex;gap:5px}.att-action{font-size:10px;padding:7px 8px;white-space:nowrap}.att-action.in{color:#78d8b5;border-color:#28634f}.att-action.out{color:#9bc5ff;border-color:#315c8d}.att-action.off{color:#f3d36d;border-color:#80692c}.att-calendar{border:1px solid #344b63;border-radius:9px;background:#172536;padding:12px;align-self:start;margin-top:0}.att-calendar label{display:block;color:#9fb2c7;font-size:10px;margin-bottom:6px}.att-calendar select{width:100%;font-size:11px;margin-bottom:9px}.att-cal-nav{display:flex;justify-content:space-between;align-items:center;margin:0 0 12px}.att-cal-nav strong{font-size:12px}.att-week,.att-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}.att-week span{font-size:9px;color:#8ea5bf;padding:6px 0}.att-day{aspect-ratio:1;border:1px solid transparent;border-radius:5px;background:transparent;color:#dce8f5;font-size:10px;cursor:pointer}.att-day:hover{background:#243d59}.att-day.selected{background:#1d3d61;border-color:#4b8dd0;color:#b9d9ff}.att-day.off{background:#66521c;color:#ffe28b;border-color:#a18435}.att-day.today{box-shadow:inset 0 0 0 1px #5a91c7}.att-legend{display:flex;gap:7px;align-items:center;margin-top:12px;color:#91a8c0;font-size:9px}.att-legend i{width:8px;height:8px;border-radius:2px;background:#f4d36d;display:inline-block}.att-summary{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.att-chip{font-size:10px;color:#b6c7d9;background:#142235;border:1px solid #31475e;border-radius:6px;padding:6px 9px}.att-empty{padding:28px;text-align:center;color:#a7b8ca;font-size:12px}.att-alert{margin:10px 15px;padding:9px 12px;border-radius:7px;background:#173c34;color:#8de0bf;font-size:12px}.att-error{background:#492b32;color:#ffc0c7}.att-modal-bg{position:fixed;inset:0;background:#07111dcc;display:grid;place-items:center;z-index:1000;padding:16px}.att-modal{width:min(390px,100%);background:#1b2939;border:1px solid #405a75;border-radius:12px;padding:20px;box-shadow:0 20px 60px #0008}.att-modal h3{margin:0 0 5px}.att-modal p{color:#9eb1c6;font-size:12px;margin:0 0 16px}.att-modal label{display:block;font-size:12px;color:#c6d4e4}.att-modal input{display:block;width:100%;margin-top:7px;padding:10px;background:#101e2e;border:1px solid #3b526b;border-radius:7px;color:white}.att-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.att-modal-actions button{border-radius:7px;padding:9px 13px;cursor:pointer}.att-save{background:#347fc4;color:white;border:0}.att-cancel{background:#24364a;color:#dce8f5;border:1px solid #42566c}@media(max-width:900px){.att-layout{grid-template-columns:1fr}.att-calendar{grid-row:1}.att-head{padding:18px}.att-table{min-width:700px}}@media print{.att-head button,.att-calendar,.att-actions,.att-datebar input{display:none!important}.att-screen,.att-panel{background:white!important;color:#111!important}.att-table td,.att-table th{color:#111!important;background:white!important}}
    `}</style>
    <div className="att-head"><div><span className="att-kicker">PEOPLE OPERATIONS</span><h2>{label("Attendance","الحضور والانصراف")}</h2><p>{label("Select a date, enter the times if needed, and record check-in, check-out, or a day off for each active employee.","اختر التاريخ وسجّل وقت الدخول أو الخروج أو يوم الإجازة لكل موظف.")}</p></div><button className="att-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>{label("Refresh","تحديث")}</button></div>
    <div className="att-panel">
      <div className="att-panel-title"><h3>{label("Attendance for","سجلات الحضور ليوم")} {selectedDate}</h3><p>{label("Times can be entered manually for any date.","يمكن إدخال الأوقات يدوياً لأي تاريخ.")}</p></div>
      {error&&<div className="att-alert att-error">{error}</div>}{notice&&<div className="att-alert">{notice}</div>}
      <div className="att-layout">
        <div className="att-main">
          <div className="att-datebar"><div><strong>{label("Daily attendance","الحضور اليومي")}</strong><div className="att-summary"><span className="att-chip">{label("Present","حاضر")}: {presentCount}</span><span className="att-chip">{label("Day off","إجازة")}: {offCount}</span><span className="att-chip">{label("No record","بدون تسجيل")}: {absentCount}</span></div></div><span>{selectedDate}</span></div>
          <div className="att-table-wrap"><table className="att-table"><thead><tr><th>{label("Employee","الموظف")}</th><th>{label("Application user","حساب التطبيق")}</th><th>{label("Department","القسم")}</th><th>{label("Time record","أوقات الدوام")}</th><th>{label("Status","الحالة")}</th><th>{label("Actions","الإجراءات")}</th></tr></thead>
          <tbody>{loading?<tr><td colSpan={6} className="att-empty">{label("Loading employees...","جارٍ تحميل الموظفين...")}</td></tr>:rows.length===0?<tr><td colSpan={6} className="att-empty">{label("No active employees to mark.","لا يوجد موظفون نشطون لتسجيل حضورهم.")}</td></tr>:dayRecords.map(({employee,record})=>{const off=["day_off","day-off","leave"].includes(record?.status??"");const present=Boolean(record?.check_in)||record?.status==="present";const profile=profileMap.get(employee.id);return <tr key={employee.id}><td><span className="att-person">{employee.full_name}</span><span className="att-sub">{employee.employee_code??"—"}</span></td><td>{profile?.is_active?profile.login_email??"—":label("Not linked","غير مرتبط")}</td><td>—</td><td><span className="att-time">{timeText(record?.check_in??null)} / {timeText(record?.check_out??null)}</span></td><td><span className={`att-pill ${off?"off":present?"present":"absent"}`}>{off?label("Day off","إجازة"):present?label("Present","حاضر"):label("Not marked","غير مسجل")}</span></td><td><div className="att-actions"><button className="att-action in" disabled={busy} onClick={()=>openTime(employee,"check_in")}><Check size={12}/>{label("IN","دخول")}</button><button className="att-action out" disabled={busy} onClick={()=>openTime(employee,"check_out")}><LogOut size={12}/>{label("OUT","خروج")}</button><button className="att-action off" disabled={busy} onClick={()=>void dayOff(employee)}><Palmtree size={12}/>{label("OFF","إجازة")}</button></div></td></tr>})}</tbody></table></div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><button className="att-refresh" onClick={()=>window.print()}><Printer size={14}/>{label("Print attendance","طباعة الحضور")}</button></div>
        </div>
        <aside className="att-calendar"><label>{label("Employee calendar","تقويم الموظف")}</label><select value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)}><option value="all">{label("All employees","كل الموظفين")}</option>{activeEmployees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
          <div className="att-cal-nav"><button className="att-nav" onClick={()=>shiftMonth(-1)}><ChevronLeft size={15}/></button><strong>{monthTitle}</strong><button className="att-nav" onClick={()=>shiftMonth(1)}><ChevronRight size={15}/></button></div>
          <div className="att-week">{weekdayNames.map((d,i)=><span key={i}>{d}</span>)}</div>
          <div className="att-days">{Array.from({length:monthDays.offset},(_,i)=><span key={"blank"+i}/>)}{monthDays.days.map(date=><button key={date} className={`att-day ${selectedDate===date?"selected":""} ${dayOffDates.has(date)?"off":""} ${todayBaghdad()===date?"today":""}`} onClick={()=>setSelectedDate(date)} title={dayOffDates.has(date)?label("At least one employee is off","موظف واحد على الأقل في إجازة"):date}>{Number(date.slice(-2))}</button>)}</div>
          <div className="att-legend"><i/> {label("Yellow dates have at least one employee marked Day off.","التواريخ الصفراء تعني وجود موظف واحد على الأقل في إجازة.")}</div>
        </aside>
      </div>
    </div>
    {timeDialog&&<div className="att-modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)setTimeDialog(null)}}><div className="att-modal" role="dialog" aria-modal="true"><h3>{timeDialog.kind==="check_in"?label("Check-in time","وقت تسجيل الدخول"):label("Check-out time","وقت تسجيل الخروج")}</h3><p>{timeDialog.employee.full_name} · {selectedDate}</p><label>{label("Choose time","حدد الوقت")}<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><div className="att-modal-actions"><button className="att-cancel" onClick={()=>setTimeDialog(null)}>{label("Cancel","إلغاء")}</button><button className="att-save" disabled={busy} onClick={()=>void saveTime()}>{busy?label("Saving...","جارٍ الحفظ..."):label("Save time","حفظ الوقت")}</button></div></div></div>}
  </section>;
}
