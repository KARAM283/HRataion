import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Printer, RefreshCw, Search, UserRound } from "lucide-react";
import { supabase } from "../lib/supabase";

type AttendanceRow = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
};
type EmployeeRow = { id: string; full_name: string; employee_code: string | null };
type ReportKind = "all" | "present" | "absence" | "leave" | "times";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function baghdadToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function baghdadTime() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
}
function timeLabel(value: string | null, ar: boolean) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(ar ? "ar-IQ" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" });
}
function dateLabel(value: string, ar: boolean, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  return new Date(value + "T12:00:00").toLocaleDateString(ar ? "ar-IQ" : "en-GB", options);
}
function monthLabel(value: string, ar: boolean) {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(ar ? "ar-IQ" : "en-US", { month: "long", year: "numeric" });
}
function monthDates(value: string) {
  const [y, m] = value.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${value}-${String(i + 1).padStart(2, "0")}`);
}
function localTimestamp(date: string, time: string) {
  // Baghdad is UTC+03:00. Store an explicit offset so manually entered times remain unambiguous.
  return new Date(`${date}T${time}:00+03:00`).toISOString();
}

export default function AttendanceManagement({ lang }: { lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedDate, setSelectedDate] = useState(baghdadToday());
  const [timeDialog, setTimeDialog] = useState<{ employee: EmployeeRow; kind: "check_in" | "check_out" } | null>(null);
  const [timeValue, setTimeValue] = useState(baghdadTime());
  const [report, setReport] = useState<ReportKind>("all");

  const dates = useMemo(() => monthDates(month), [month]);
  const selectedDay = dates.includes(selectedDate) ? selectedDate : dates[0];
  const employeeById = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const recordMap = useMemo(() => new Map(records.map(r => [`${r.employee_id}|${r.attendance_date}`, r])), [records]);
  const visibleEmployees = useMemo(() => employees.filter(e => {
    const matchesFilter = employeeFilter === "all" || e.id === employeeFilter;
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || e.full_name.toLowerCase().includes(term) || (e.employee_code ?? "").toLowerCase().includes(term);
    return matchesFilter && matchesQuery;
  }), [employees, employeeFilter, query]);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const start = month + "-01";
    const end = dates[dates.length - 1];
    const [attendanceResult, employeeResult] = await Promise.all([
      supabase.from("attendance").select("id,employee_id,attendance_date,check_in,check_out,status").gte("attendance_date", start).lte("attendance_date", end).order("attendance_date", { ascending: true }),
      supabase.from("employees").select("id,full_name,employee_code").order("full_name", { ascending: true })
    ]);
    if (attendanceResult.error) setError(attendanceResult.error.message);
    else setRecords((attendanceResult.data ?? []) as AttendanceRow[]);
    if (employeeResult.error) setError(employeeResult.error.message);
    else setEmployees((employeeResult.data ?? []) as EmployeeRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [month]);

  function moveMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function openTimeDialog(employee: EmployeeRow, kind: "check_in" | "check_out") {
    setTimeValue(baghdadTime());
    setError("");
    setNotice("");
    setTimeDialog({ employee, kind });
  }
  async function saveTime() {
    if (!supabase || !timeDialog) return;
    setBusy(true); setError(""); setNotice("");
    const timestamp = localTimestamp(selectedDay, timeValue);
    const existing = recordMap.get(`${timeDialog.employee.id}|${selectedDay}`);
    const result = timeDialog.kind === "check_in"
      ? existing
        ? await supabase.from("attendance").update({ check_in: timestamp, status: "present" }).eq("id", existing.id)
        : await supabase.from("attendance").insert({ employee_id: timeDialog.employee.id, attendance_date: selectedDay, check_in: timestamp, status: "present" })
      : existing
        ? await supabase.from("attendance").update({ check_out: timestamp, status: "present" }).eq("id", existing.id)
        : await supabase.from("attendance").insert({ employee_id: timeDialog.employee.id, attendance_date: selectedDay, check_out: timestamp, status: "present" });
    if (result.error) setError(result.error.message);
    else {
      setTimeDialog(null);
      setNotice(ar ? "تم حفظ وقت الحضور بنجاح." : "Attendance time saved.");
      await load();
    }
    setBusy(false);
  }
  async function markDayOff(employee: EmployeeRow) {
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const existing = recordMap.get(`${employee.id}|${selectedDay}`);
    const payload = { employee_id: employee.id, attendance_date: selectedDay, check_in: null, check_out: null, status: "day_off" };
    const result = existing
      ? await supabase.from("attendance").update(payload).eq("id", existing.id)
      : await supabase.from("attendance").insert(payload);
    if (result.error) setError(result.error.message);
    else { setNotice(ar ? "تم تسجيل يوم الإجازة." : "Day off recorded."); await load(); }
    setBusy(false);
  }
  function statusFor(employeeId: string, date: string) {
    const row = recordMap.get(`${employeeId}|${date}`);
    if (!row) return "absence";
    if (row.status === "day_off" || row.status === "day-off" || row.status === "leave") return "leave";
    return row.check_in || row.status === "present" ? "present" : "absence";
  }
  const selectedEmployee = employeeFilter === "all" ? null : employeeById.get(employeeFilter) ?? null;
  const reportRows = useMemo(() => {
    const rows: { employee: EmployeeRow; date: string; row: AttendanceRow | null; kind: string }[] = [];
    const today = baghdadToday();
    for (const employee of visibleEmployees) {
      for (const date of dates) {
        if (date > today) continue;
        const row = recordMap.get(`${employee.id}|${date}`) ?? null;
        const kind = !row ? "absence" : (row.status === "day_off" || row.status === "day-off" || row.status === "leave") ? "leave" : "present";
        if (report === "all" || (report === "times" && row && (row.check_in || row.check_out)) || (report === "present" && kind === "present") || (report === "absence" && kind === "absence") || (report === "leave" && kind === "leave")) {
          rows.push({ employee, date, row, kind });
        }
      }
    }
    return rows;
  }, [visibleEmployees, dates, recordMap, report]);

  const presentCount = records.filter(r => r.check_in || r.status === "present").length;
  const completedCount = records.filter(r => Boolean(r.check_in && r.check_out)).length;
  const absenceCount = visibleEmployees.reduce((sum, employee) => sum + dates.filter(d => d <= baghdadToday() && !recordMap.has(`${employee.id}|${d}`)).length, 0);
  const text = {
    records: ar ? "سجلات الشهر" : "Monthly records",
    present: ar ? "أيام الحضور" : "Present days",
    completed: ar ? "دخول وخروج مكتمل" : "Completed shifts",
    absence: ar ? "أيام بلا سجل" : "No-record days",
    employee: ar ? "الموظف" : "Employee",
    date: ar ? "التاريخ" : "Date",
    checkIn: ar ? "تسجيل دخول" : "Check In",
    checkOut: ar ? "تسجيل خروج" : "Check Out",
    dayOff: ar ? "يوم إجازة" : "Day Off",
    allEmployees: ar ? "كل الموظفين" : "All employees",
    calendar: ar ? "التقويم الشهري" : "Monthly calendar",
    individual: ar ? "تقويم الموظف" : "Employee calendar",
    selectedDay: ar ? "اليوم المحدد" : "Selected day",
    report: ar ? "التقارير" : "Reports",
    print: ar ? "طباعة التقرير" : "Print report",
    refresh: ar ? "تحديث" : "Refresh",
    noData: ar ? "لا توجد بيانات لهذا الشهر." : "No records for this month.",
    noEmployees: ar ? "لا يوجد موظفون لعرضهم." : "No employees to display.",
    saved: ar ? "تم الحفظ" : "Saved",
    in: ar ? "دخول" : "In",
    out: ar ? "خروج" : "Out",
    off: ar ? "إجازة" : "Day off",
    absent: ar ? "لا يوجد سجل" : "No record",
    status: ar ? "الحالة" : "Status",
    chooseTime: ar ? "حدد الوقت" : "Choose time",
    save: ar ? "حفظ الوقت" : "Save time",
    cancel: ar ? "إلغاء" : "Cancel",
    all: ar ? "كل السجلات" : "All records",
    presentOnly: ar ? "الحضور" : "Present",
    absenceOnly: ar ? "الغياب / بلا سجل" : "Absence / no record",
    leaveOnly: ar ? "الإجازات" : "Day off / leave",
    timesOnly: ar ? "أوقات الدخول والخروج" : "Check-in / check-out times"
  };

  return <section className="attendance-workspace" dir={ar ? "rtl" : "ltr"}>
    <div className="stats-grid attendance-stats">
      <div className="stat-card"><div className="stat-icon blue"><CalendarDays size={18}/></div><span>{text.records}</span><strong>{records.length}</strong></div>
      <div className="stat-card"><div className="stat-icon green"><UserRound size={18}/></div><span>{text.present}</span><strong>{presentCount}</strong></div>
      <div className="stat-card"><div className="stat-icon violet"><Clock3 size={18}/></div><span>{text.completed}</span><strong>{completedCount}</strong></div>
      <div className="stat-card"><div className="stat-icon amber"><CalendarDays size={18}/></div><span>{text.absence}</span><strong>{absenceCount}</strong></div>
    </div>

    <div className="panel attendance-controls">
      <div className="attendance-month">
        <button className="icon-button" onClick={() => moveMonth(-1)} title={ar ? "الشهر السابق" : "Previous month"}><ChevronLeft size={19}/></button>
        <strong>{monthLabel(month, ar)}</strong>
        <button className="icon-button" onClick={() => moveMonth(1)} title={ar ? "الشهر التالي" : "Next month"}><ChevronRight size={19}/></button>
      </div>
      <input aria-label="Month" type="month" value={month} onChange={e => setMonth(e.target.value)} />
      <label className="attendance-select-label">{ar ? "عرض الموظف" : "Employee view"}
        <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}>
          <option value="all">{text.allEmployees}</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </label>
      <div className="search-box attendance-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={ar ? "بحث باسم الموظف..." : "Search employee..."}/></div>
      <button className="icon-button" onClick={() => void load()} title={text.refresh}><RefreshCw size={17}/></button>
    </div>

    <div className="panel attendance-actionbar">
      <div><span className="eyebrow">{text.selectedDay}</span><strong>{dateLabel(selectedDay, ar, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong></div>
      <input type="date" value={selectedDay} min={month + "-01"} max={dates[dates.length - 1]} onChange={e => setSelectedDate(e.target.value)} />
      <span className="attendance-hint">{ar ? "اختر الموظف من الجدول لتنفيذ الإجراء على هذا التاريخ." : "Use the action buttons on each employee row for this date."}</span>
    </div>

    {error && <div className="error-box">{error}</div>}
    {notice && <div className="attendance-notice">{notice}</div>}

    {selectedEmployee ? <div className="panel">
      <div className="panel-heading"><div><h3>{text.individual}: {selectedEmployee.full_name}</h3><p>{monthLabel(month, ar)}</p></div></div>
      <div className="individual-calendar">
        {dates.map(date => {
          const row = recordMap.get(`${selectedEmployee.id}|${date}`);
          const kind = statusFor(selectedEmployee.id, date);
          return <button key={date} className={`attendance-day ${kind} ${date === selectedDay ? "selected" : ""}`} onClick={() => setSelectedDate(date)}>
            <span>{dateLabel(date, ar, { day: "2-digit", weekday: "short" })}</span>
            <strong>{kind === "leave" ? text.off : kind === "present" ? text.present : date <= baghdadToday() ? text.absent : "—"}</strong>
            <small>{row?.check_in ? `${text.in}: ${timeLabel(row.check_in, ar)}` : ""}</small>
            <small>{row?.check_out ? `${text.out}: ${timeLabel(row.check_out, ar)}` : ""}</small>
          </button>;
        })}
      </div>
      <div className="attendance-row-actions">
        <button className="attendance-action in" disabled={busy} onClick={() => openTimeDialog(selectedEmployee, "check_in")}>{text.checkIn}</button>
        <button className="attendance-action out" disabled={busy} onClick={() => openTimeDialog(selectedEmployee, "check_out")}>{text.checkOut}</button>
        <button className="attendance-action off" disabled={busy} onClick={() => void markDayOff(selectedEmployee)}>{text.dayOff}</button>
      </div>
    </div> : <div className="panel">
      <div className="panel-heading"><div><h3>{text.calendar}</h3><p>{ar ? "كل موظف في صف مستقل، مع حالة كل يوم من الشهر." : "One row per employee, with each day of the month."}</p></div></div>
      {loading ? <div className="empty-cell">{ar ? "جارٍ تحميل البيانات..." : "Loading attendance..."}</div> : visibleEmployees.length === 0 ? <div className="empty-cell">{text.noEmployees}</div> :
      <div className="table-wrap attendance-matrix-wrap"><table className="attendance-matrix">
        <thead><tr><th className="employee-sticky">{text.employee}</th>{dates.map(date => <th key={date} className={date === selectedDay ? "current-column" : ""}>{Number(date.slice(-2))}</th>)}<th>{text.selectedDay}</th></tr></thead>
        <tbody>{visibleEmployees.map(employee => <tr key={employee.id}>
          <td className="employee-sticky"><strong>{employee.full_name}</strong><small>{employee.employee_code ?? ""}</small></td>
          {dates.map(date => {
            const row = recordMap.get(`${employee.id}|${date}`);
            const kind = statusFor(employee.id, date);
            return <td key={date} className={`${kind === "leave" ? "day-off-cell" : ""} ${date === selectedDay ? "current-column" : ""}`} onClick={() => setSelectedDate(date)} title={row ? `${timeLabel(row.check_in, ar)} / ${timeLabel(row.check_out, ar)}` : date}>
              <span className={`day-mark ${kind}`}>{kind === "leave" ? "E" : kind === "present" ? "P" : date <= baghdadToday() ? "—" : ""}</span>
            </td>;
          })}
          <td><div className="matrix-actions">
            <button className="mini-action in" disabled={busy} onClick={() => openTimeDialog(employee, "check_in")} title={text.checkIn}>IN</button>
            <button className="mini-action out" disabled={busy} onClick={() => openTimeDialog(employee, "check_out")} title={text.checkOut}>OUT</button>
            <button className="mini-action off" disabled={busy} onClick={() => void markDayOff(employee)} title={text.dayOff}>OFF</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
      <div className="attendance-legend"><span><i className="legend-dot present"/> {ar ? "حضور" : "Present"}</span><span><i className="legend-dot leave"/> {ar ? "إجازة" : "Day off"}</span><span><i className="legend-dot absence"/> {ar ? "لا يوجد سجل" : "No record"}</span></div>
    </div>}

    <div className="panel attendance-reports">
      <div className="panel-heading"><div><h3>{text.report}</h3><p>{ar ? "تقرير قابل للطباعة حسب الموظف ونوع السجل." : "Printable report filtered by employee and record type."}</p></div><button className="primary-button" onClick={() => window.print()}><Printer size={16}/>{text.print}</button></div>
      <div className="report-filters">
        <select value={report} onChange={e => setReport(e.target.value as ReportKind)}>
          <option value="all">{text.all}</option><option value="present">{text.presentOnly}</option><option value="absence">{text.absenceOnly}</option><option value="leave">{text.leaveOnly}</option><option value="times">{text.timesOnly}</option>
        </select>
        <span>{monthLabel(month, ar)} · {reportRows.length} {ar ? "سجل" : "rows"}</span>
      </div>
      <div className="table-wrap"><table className="attendance-report-table">
        <thead><tr><th>{text.employee}</th><th>{text.date}</th><th>{text.checkIn}</th><th>{text.checkOut}</th><th>{text.status}</th></tr></thead>
        <tbody>{reportRows.length === 0 ? <tr><td colSpan={5} className="empty-cell">{text.noData}</td></tr> : reportRows.map((item, index) => <tr key={`${item.employee.id}-${item.date}-${index}`}>
          <td>{item.employee.full_name}</td><td>{dateLabel(item.date, ar, { day: "2-digit", month: "short", year: "numeric" })}</td>
          <td>{timeLabel(item.row?.check_in ?? null, ar)}</td><td>{timeLabel(item.row?.check_out ?? null, ar)}</td>
          <td><span className={`attendance-status ${item.kind}`}>{item.kind === "present" ? text.present : item.kind === "leave" ? text.off : text.absent}</span></td>
        </tr>)}</tbody>
      </table></div>
      <p className="attendance-report-note">{ar ? "ملاحظة: «لا يوجد سجل» تعني عدم وجود تسجيل حضور أو إجازة في ذلك التاريخ؛ يمكن ضبط أيام العمل والعطل الأسبوعية لاحقاً حتى لا تُحسب العطلة غياباً." : "Note: “No record” means no attendance or leave entry exists for that date. Workdays and weekly holidays can be configured later to avoid counting non-working days as absence."}</p>
    </div>

    {timeDialog && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setTimeDialog(null); }}>
      <div className="employee-modal attendance-time-modal" role="dialog" aria-modal="true">
        <div className="modal-heading"><div><span className="eyebrow">{timeDialog.kind === "check_in" ? text.checkIn : text.checkOut}</span><h2>{timeDialog.employee.full_name}</h2><p>{dateLabel(selectedDay, ar, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div><button className="icon-button" onClick={() => setTimeDialog(null)}>×</button></div>
        <label>{text.chooseTime}<input type="time" value={timeValue} onChange={e => setTimeValue(e.target.value)} required /></label>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setTimeDialog(null)}>{text.cancel}</button><button className="primary-button" disabled={busy || !timeValue} onClick={() => void saveTime()}>{busy ? (ar ? "جارٍ الحفظ..." : "Saving...") : text.save}</button></div>
      </div>
    </div>}
  </section>;
}
