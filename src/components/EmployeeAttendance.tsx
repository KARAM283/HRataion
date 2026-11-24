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
  function getCurrentLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(ar ? "متصفحك لا يدعم تحديد الموقع." : "Your browser does not support location services."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        (geoError) => {
          const message = geoError.code === geoError.PERMISSION_DENIED
            ? (ar ? "فعّل صلاحية الموقع للمتصفح حتى تسجل الحضور." : "Allow location access in your browser to record attendance.")
            : geoError.code === geoError.TIMEOUT
              ? (ar ? "تعذر تحديد موقعك. حاول مرة ثانية." : "Location timed out. Please try again.")
              : (ar ? "تعذر تحديد موقعك. تأكد من تشغيل GPS." : "Unable to get your location. Make sure GPS is enabled.");
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }
  async function submitAttendance(action: "check_in" | "check_out") {
    if (!supabase || (action === "check_out" && !record)) return;
    setBusy(true); setError("");
    try {
      const position = await getCurrentLocation();
      const { latitude, longitude, accuracy } = position.coords;
      const { error: err } = await supabase.rpc(
        action === "check_in" ? "employee_check_in" : "employee_check_out",
        { p_latitude: latitude, p_longitude: longitude, p_accuracy: accuracy }
      );
      if (err) setError(err.message);
      else await refresh();
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : (ar ? "تعذر التحقق من الموقع." : "Unable to verify your location."));
    } finally {
      setBusy(false);
    }
  }
  async function checkIn() { await submitAttendance("check_in"); }
  async function checkOut() {
    const confirmed = window.confirm(ar ? "هل أنت متأكد أنك تريد تسجيل الانصراف؟" : "Are you sure you want to check out?");
    if (!confirmed) return;
    await submitAttendance("check_out");
  }
  return <div className={`login-screen employee-portal ${theme==="dark"?"theme-dark":""}`} dir={ar ? "rtl" : "ltr"}>
    <GlassCard className="employee-clock-panel" style={{ width: "min(100%, 480px)", padding: 28 }}>
      <div className="panel-heading"><div><img className="hrration-logo employee-logo" src="/hrration-logo.svg" alt="HRration"/><h3 style={{ fontSize: 22, marginTop: 8 }}>{ar ? "الحضور والانصراف" : "Attendance"}</h3><p>{new Date().toLocaleDateString(ar ? "ar-IQ" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p></div><div className="employee-portal-actions"><button className="icon-button" onClick={onThemeToggle} title={theme==="light"?"Dark mode":"Light mode"}>{theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button><button className="icon-button" onClick={onSignOut} title={ar ? "تسجيل الخروج" : "Sign out"}><LogOut size={18}/></button></div></div>
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
