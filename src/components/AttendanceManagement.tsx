import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { supabase } from "../lib/supabase";

type AttendanceRow = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
};
type EmployeeRow = { id: string; full_name: string; employee_code: string | null; department: string | null };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function timeLabel(value: string | null, ar: boolean) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(ar ? "ar-IQ" : "en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad"
  });
}
function dateLabel(value: string, ar: boolean) {
  return new Date(value + "T12:00:00").toLocaleDateString(ar ? "ar-IQ" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

export default function AttendanceManagement({ lang }: { lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const start = month + "-01";
    const [year, mon] = month.split("-").map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    const [attendanceResult, employeeResult] = await Promise.all([
      supabase.from("attendance")
        .select("id,employee_id,attendance_date,check_in,check_out,status")
        .gte("attendance_date", start)
        .lte("attendance_date", end)
        .order("attendance_date", { ascending: false }),
      supabase.from("employees")
        .select("id,full_name,employee_code,department")
        .order("full_name", { ascending: true })
    ]);
    if (attendanceResult.error) setError(attendanceResult.error.message);
    else setRecords((attendanceResult.data ?? []) as AttendanceRow[]);
    if (employeeResult.error) setError(employeeResult.error.message);
    else setEmployees((employeeResult.data ?? []) as EmployeeRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [month]);

  const employeeById = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const filtered = useMemo(() => records.filter(record => {
    const employee = employeeById.get(record.employee_id);
    return (employee?.full_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (employee?.employee_code ?? "").toLowerCase().includes(query.toLowerCase());
  }), [records, employeeById, query]);

  const presentCount = records.filter(r => r.status === "present" || Boolean(r.check_in)).length;
  const completedCount = records.filter(r => Boolean(r.check_in && r.check_out)).length;
  function moveMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return <section style={{ display: "grid", gap: 18 }}>
    <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
      <div className="stat-card"><div className="stat-icon blue"><CalendarDays size={18}/></div><span>{ar ? "سجلات هذا الشهر" : "Records this month"}</span><strong>{records.length}</strong></div>
      <div className="stat-card"><div className="stat-icon green"><CalendarDays size={18}/></div><span>{ar ? "سجلات حضور" : "Present records"}</span><strong>{presentCount}</strong></div>
      <div className="stat-card"><div className="stat-icon violet"><CalendarDays size={18}/></div><span>{ar ? "دخول وخروج مكتمل" : "Completed check-outs"}</span><strong>{completedCount}</strong></div>
    </div>
    <div className="panel">
      <div className="directory-toolbar" style={{ flexWrap: "wrap" }}>
        <div><h3>{ar ? "سجل الحضور والانصراف" : "Attendance records"}</h3><p>{ar ? "السجلات المحفوظة فعلياً في قاعدة البيانات" : "Records saved in the live database"}</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="icon-button" onClick={() => moveMonth(-1)} title={ar ? "الشهر السابق" : "Previous month"}><ChevronLeft size={18}/></button>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ border: "1px solid #e5eaf1", borderRadius: 8, padding: "9px 10px", color: "#536176", font: "inherit", fontSize: 11 }}/>
          <button className="icon-button" onClick={() => moveMonth(1)} title={ar ? "الشهر التالي" : "Next month"}><ChevronRight size={18}/></button>
          <button className="icon-button" onClick={() => void load()} title={ar ? "تحديث" : "Refresh"}><RefreshCw size={17}/></button>
        </div>
      </div>
      <div className="search-box" style={{ marginBottom: 16 }}><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? "ابحث باسم الموظف أو رقمه..." : "Search employee or ID..."}/></div>
      {error && <div className="error-box">{error}</div>}
      <div className="table-wrap">
        <table dir={ar ? "rtl" : "ltr"}>
          <thead><tr>
            <th>{ar ? "الموظف" : "Employee"}</th>
            <th>{ar ? "التاريخ" : "Date"}</th>
            <th>{ar ? "وقت الدخول" : "Check in"}</th>
            <th>{ar ? "وقت الخروج" : "Check out"}</th>
            <th>{ar ? "الحالة" : "Status"}</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="empty-cell">{ar ? "جارٍ تحميل السجلات..." : "Loading records..."}</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={5} className="empty-cell">{ar ? "لا توجد سجلات لهذا الشهر" : "No attendance records for this month"}</td></tr>
            : filtered.map(record => {
              const employee = employeeById.get(record.employee_id);
              return <tr key={record.id}>
                <td><div className="person-cell"><div className="person-avatar">{(employee?.full_name ?? "?").charAt(0)}</div><strong>{employee?.full_name ?? (ar ? "موظف غير معروف" : "Unknown employee")}</strong></div></td>
                <td>{dateLabel(record.attendance_date, ar)}</td>
                <td>{timeLabel(record.check_in, ar)}</td>
                <td>{timeLabel(record.check_out, ar)}</td>
                <td><span className={record.status === "present" ? "status active" : "status inactive"}>{record.status === "present" ? (ar ? "حاضر" : "Present") : (record.status ?? "—")}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
}
