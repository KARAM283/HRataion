import { useEffect, useState } from "react";
import { CalendarCheck, Clock3, LogOut, Moon, Sun } from "lucide-react";
import { GlassCard } from "./Glass";
import { supabase } from "../lib/supabase";

type RecordRow = { id: string; check_in: string | null; check_out: string | null; status: string | null };

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function localTime(value: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function EmployeeAttendance({ employeeId, lang, theme, onThemeToggle, onSignOut }: { employeeId: string; lang: "en" | "ar"; theme:"light"|"dark"; onThemeToggle:()=>void; onSignOut: () => void }) {
  const ar = lang === "ar";
  const [record, setRecord] = useState<RecordRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function refresh() {
    if (!supabase) return;
    const { data, error: err } = await supabase.from("attendance").select("id,check_in,check_out,status").eq("employee_id", employeeId).eq("attendance_date", localDate()).maybeSingle();
    if (err) setError(err.message); else setRecord(data as RecordRow | null);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, [employeeId]);
  async function checkIn() {
    if (!supabase) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.rpc("employee_check_in");
    if (err) setError(err.message); else await refresh();
    setBusy(false);
  }
  async function checkOut() {
    if (!supabase || !record) return;
    setBusy(true); setError("");
    const { error: err } = await supabase.rpc("employee_check_out");
    if (err) setError(err.message); else await refresh();
    setBusy(false);
  }
  return <div className={`login-screen employee-portal ${theme==="dark"?"theme-dark":""}`} dir={ar ? "rtl" : "ltr"}>
    <GlassCard className="employee-clock-panel" style={{ width: "min(100%, 480px)", padding: 28 }}>
      <div className="panel-heading"><div><span className="eyebrow">BLUE LINE · HR</span><h3 style={{ fontSize: 22, marginTop: 8 }}>{ar ? "الحضور والانصراف" : "Attendance"}</h3><p>{new Date().toLocaleDateString(ar ? "ar-IQ" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p></div><div className="employee-portal-actions"><button className="icon-button" onClick={onThemeToggle} title={theme==="light"?"Dark mode":"Light mode"}>{theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button><button className="icon-button" onClick={onSignOut} title={ar ? "تسجيل الخروج" : "Sign out"}><LogOut size={18}/></button></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "24px 0" }}>
        <div className="stat-card"><Clock3 size={19}/><span>{ar ? "وقت الدخول" : "Check in"}</span><strong style={{ fontSize: 23 }}>{localTime(record?.check_in ?? null)}</strong></div>
        <div className="stat-card"><CalendarCheck size={19}/><span>{ar ? "وقت الخروج" : "Check out"}</span><strong style={{ fontSize: 23 }}>{localTime(record?.check_out ?? null)}</strong></div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div style={{ display: "grid", gap: 10 }}>
        <button className="primary-button full-button" disabled={busy || loading || Boolean(record?.check_in)} onClick={checkIn}>{record?.check_in ? (ar ? "تم تسجيل الحضور ✓" : "Checked In ✓") : (ar ? "تسجيل الحضور" : "Check In")}</button>
        <button className="secondary-button" style={{ padding: 13 }} disabled={busy || loading || !record?.check_in || Boolean(record?.check_out)} onClick={checkOut}>{record?.check_out ? (ar ? "تم تسجيل الانصراف ✓" : "Checked Out ✓") : (ar ? "تسجيل الانصراف" : "Check Out")}</button>
      </div>
      <p style={{ color: "#8b97a8", fontSize: 11, textAlign: "center", marginTop: 18 }}>{loading ? (ar ? "جارٍ تحميل السجل..." : "Loading attendance...") : (ar ? "هذه الواجهة مخصصة لتسجيل حضورك وانصرافك فقط." : "This portal is only for your own attendance records.")}</p>
    </GlassCard>
  </div>;
}
