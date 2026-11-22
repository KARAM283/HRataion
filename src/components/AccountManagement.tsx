import { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, UserPlus, Users } from "lucide-react";
import { supabase } from "../lib/supabase";

type Employee = { id: string; full_name: string; email: string | null; status: string | null };
type Profile = { user_id: string; employee_id: string | null; role: string; is_active: boolean };

export default function AccountManagement({ lang }: { lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const linkedIds = useMemo(() => new Set(profiles.filter(p => p.role === "employee" && p.is_active).map(p => p.employee_id)), [profiles]);
  const available = employees.filter(e => !linkedIds.has(e.id));

  async function load() {
    if (!supabase) return;
    const [e, p] = await Promise.all([
      supabase.from("employees").select("id,full_name,email,status").order("full_name"),
      supabase.from("user_profiles").select("user_id,employee_id,role,is_active").eq("role", "employee"),
    ]);
    if (e.error) setError(e.error.message);
    else setEmployees((e.data ?? []) as Employee[]);
    if (p.error) setError(p.error.message);
    else setProfiles((p.data ?? []) as Profile[]);
  }
  useEffect(() => { void load(); }, []);

  function chooseEmployee(id: string) {
    setEmployeeId(id);
    const employee = employees.find(e => e.id === id);
    const suggested = (employee?.full_name ?? "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
    setUsername(suggested);
    setPassword(suggested ? suggested + suggested + "1221" : "");
    setCreated(null);
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !employeeId) return;
    setBusy(true); setError(""); setCreated(null);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-create-employee", {
      body: { employee_id: employeeId, username, password },
    });
    if (invokeError) {
      const detail = invokeError.context && typeof invokeError.context.json === "function"
        ? await invokeError.context.json().catch(() => null) : null;
      setError(detail?.error || invokeError.message);
    } else if (data?.error) setError(data.error);
    else {
      setCreated({ email: data.email, password });
      setEmployeeId(""); setUsername(""); setPassword("");
      await load();
    }
    setBusy(false);
  }

  return <section style={{ display: "grid", gap: 18 }}>
    <div className="panel">
      <div className="panel-heading">
        <div><h3>{ar ? "إنشاء حساب موظف" : "Create employee account"}</h3><p>{ar ? "اربط حساب الدخول بملف موظف موجود" : "Link a login to an existing employee profile"}</p></div>
        <span className="quick-icon blue"><UserPlus size={18}/></span>
      </div>
      <form onSubmit={createAccount} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, alignItems: "end" }}>
        <label>{ar ? "الموظف" : "Employee"}
          <select required value={employeeId} onChange={e => chooseEmployee(e.target.value)} style={fieldStyle}>
            <option value="">{ar ? "اختر موظفاً" : "Select employee"}</option>
            {available.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </label>
        <label>{ar ? "اسم المستخدم" : "Username"}
          <input required minLength={3} maxLength={32} value={username} onChange={e => { setUsername(e.target.value.toLowerCase()); setCreated(null); }} style={fieldStyle} />
        </label>
        <label>{ar ? "كلمة المرور المؤقتة" : "Temporary password"}
          <input required minLength={10} type="text" value={password} onChange={e => setPassword(e.target.value)} style={fieldStyle} />
        </label>
        <button className="primary-button" disabled={busy || !employeeId}><KeyRound size={16}/>{busy ? (ar ? "جارٍ الإنشاء..." : "Creating...") : (ar ? "إنشاء الحساب" : "Create account")}</button>
      </form>
      <p style={{ color: "#8995a6", fontSize: 11, margin: "12px 0 0" }}>{ar ? "البريد الداخلي يُنشأ تلقائياً بصيغة username@blueline.local. كلمة المرور تظهر لك بعد الإنشاء لمرة واحدة." : "An internal email is generated as username@blueline.local. The temporary password is shown once after creation."}</p>
      {error && <div className="error-box">{error}</div>}
      {created && <div className="setup-note" style={{ display: "block", marginTop: 16 }}>
        <strong>{ar ? "تم إنشاء الحساب" : "Account created"}</strong>
        <div style={{ marginTop: 8 }}>{created.email}</div>
        <div>{ar ? "كلمة المرور المؤقتة:" : "Temporary password:"} <strong>{created.password}</strong></div>
        <small>{ar ? "سلّم بيانات الدخول للموظف عبر قناة آمنة، واطلب منه تغيير كلمة المرور." : "Share these credentials privately and ask the employee to change the password."}</small>
      </div>}
    </div>
    <div className="panel">
      <div className="panel-heading">
        <div><h3>{ar ? "حالة حسابات الموظفين" : "Employee account status"}</h3><p>{ar ? "الحسابات المرتبطة بملفات الموظفين" : "Accounts linked to employee records"}</p></div>
        <button className="icon-button" onClick={() => void load()} title={ar ? "تحديث" : "Refresh"}><RefreshCw size={17}/></button>
      </div>
      <div className="table-wrap"><table><thead><tr><th>{ar ? "الموظف" : "Employee"}</th><th>{ar ? "البريد الداخلي" : "Internal email"}</th><th>{ar ? "الحالة" : "Status"}</th></tr></thead><tbody>
        {profiles.length === 0 ? <tr><td colSpan={3} className="empty-cell">{ar ? "لا توجد حسابات موظفين بعد" : "No employee accounts yet"}</td></tr> : profiles.map(p => {
          const employee = employees.find(e => e.id === p.employee_id);
          return <tr key={p.user_id}><td>{employee?.full_name ?? "—"}</td><td>{employee?.email ?? "—"}</td><td><span className={p.is_active ? "status active" : "status inactive"}>{p.is_active ? (ar ? "نشط" : "Active") : (ar ? "معطّل" : "Inactive")}</span></td></tr>;
        })}
      </tbody></table></div>
    </div>
  </section>;
}

const fieldStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", marginTop: 7, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#26354b", font: "inherit", fontSize: 12 };
