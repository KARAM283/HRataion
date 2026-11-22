import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Activity, BriefcaseBusiness, CalendarCheck, CalendarDays, ChartNoAxesCombined, ChevronDown, CircleHelp, FileText, Globe2, LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck, Users, Wallet, X, UserCog } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import AccountManagement from "./components/AccountManagement";
import EmployeeAttendance from "./components/EmployeeAttendance";

type Employee = { id: string; employee_code: string | null; full_name: string; email: string | null; phone: string | null; position: string | null; status: string | null; hire_date: string | null; salary: number | null };
type Texts = typeof copy.en | typeof copy.ar;
type Section = "dashboard" | "employees" | "attendance" | "leaves" | "payroll" | "documents" | "reports" | "settings" | "accounts";
const copy = {
  en: { dashboard:"Dashboard", employees:"Employees", attendance:"Attendance", leaves:"Leave management", payroll:"Payroll", documents:"Documents", reports:"Reports", settings:"Settings", accounts:"Accounts", overview:"Overview", welcome:"Welcome back", subtitle:"Here’s what’s happening across your workforce.", totalEmployees:"Total employees", presentToday:"Present today", onLeave:"On leave", monthlyPayroll:"Monthly payroll", quickActions:"Quick actions", addEmployee:"Add employee", recordAttendance:"Record attendance", reviewLeaves:"Review leave requests", recentEmployees:"Recent employees", viewAll:"View all", search:"Search employees...", name:"Full name", code:"Employee ID", email:"Email address", phone:"Phone number", position:"Job title", hireDate:"Hire date", salary:"Monthly salary", save:"Save employee", cancel:"Cancel", noEmployees:"No employees yet", noEmployeesHint:"Add your first employee to start building your HR workspace.", signIn:"Sign in to HRataion", signInHint:"Use your administrator account to continue.", password:"Password", signInButton:"Sign in", configTitle:"Connect your Supabase project", configHint:"Add your Supabase Project URL and publishable key in Cloudflare Pages environment variables, or create a local .env file using .env.example.", configured:"Supabase connection detected", notConfigured:"Supabase is not configured", loading:"Loading...", logout:"Sign out", language:"Language", admin:"Administrator", active:"Active", inactive:"Inactive", error:"Something went wrong", empty:"No records to display yet", nav:"Workspace", company:"HRataion", allEmployees:"All employees", addNew:"Add new", currency:"IQD" },
  ar: { dashboard:"لوحة التحكم", employees:"الموظفون", attendance:"الحضور والانصراف", leaves:"إدارة الإجازات", payroll:"الرواتب", documents:"المستندات", reports:"التقارير", settings:"الإعدادات", accounts:"إدارة الحسابات", overview:"نظرة عامة", welcome:"مرحباً بعودتك", subtitle:"إليك ملخصاً لما يحدث ضمن فريق العمل.", totalEmployees:"إجمالي الموظفين", presentToday:"الحاضرون اليوم", onLeave:"في إجازة", monthlyPayroll:"رواتب الشهر", quickActions:"إجراءات سريعة", addEmployee:"إضافة موظف", recordAttendance:"تسجيل الحضور", reviewLeaves:"مراجعة طلبات الإجازة", recentEmployees:"أحدث الموظفين", viewAll:"عرض الكل", search:"ابحث عن موظف...", name:"الاسم الكامل", code:"الرقم الوظيفي", email:"البريد الإلكتروني", phone:"رقم الهاتف", position:"المسمى الوظيفي", hireDate:"تاريخ التعيين", salary:"الراتب الشهري", save:"حفظ الموظف", cancel:"إلغاء", noEmployees:"لا يوجد موظفون بعد", noEmployeesHint:"أضف أول موظف لبدء بناء مساحة إدارة الموارد البشرية.", signIn:"تسجيل الدخول إلى HRataion", signInHint:"استخدم حساب المدير للمتابعة.", password:"كلمة المرور", signInButton:"دخول", configTitle:"اربط مشروع Supabase", configHint:"أضف Project URL وPublishable Key ضمن متغيرات Cloudflare Pages أو أنشئ ملف .env محلياً بالاعتماد على .env.example.", configured:"تم اكتشاف إعدادات Supabase", notConfigured:"لم يتم إعداد Supabase", loading:"جارٍ التحميل...", logout:"تسجيل الخروج", language:"اللغة", admin:"المدير", active:"نشط", inactive:"غير نشط", error:"حدث خطأ", empty:"لا توجد سجلات لعرضها حالياً", nav:"مساحة العمل", company:"HRataion", allEmployees:"كل الموظفين", addNew:"إضافة جديد", currency:"د.ع" }
};
const navItems: { id: Section; icon: typeof LayoutDashboard; key: keyof typeof copy.en }[] = [
  {id:"dashboard",icon:LayoutDashboard,key:"dashboard"},{id:"employees",icon:Users,key:"employees"},{id:"attendance",icon:CalendarCheck,key:"attendance"},{id:"leaves",icon:CalendarDays,key:"leaves"},{id:"payroll",icon:Wallet,key:"payroll"},{id:"documents",icon:FileText,key:"documents"},{id:"reports",icon:ChartNoAxesCombined,key:"reports"},{id:"settings",icon:Settings,key:"settings"},{id:"accounts",icon:UserCog,key:"accounts"}
];

export default function App() {
  const [lang,setLang] = useState<"en"|"ar">("en");
  const [section,setSection] = useState<Section>("dashboard");
  const [session,setSession] = useState<boolean>(false);
  const [role,setRole] = useState<"admin"|"employee"|null>(null);
  const [employeeId,setEmployeeId] = useState<string|null>(null);
  const [roleReady,setRoleReady] = useState(false);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [employees,setEmployees] = useState<Employee[]>([]);
  const [loading,setLoading] = useState(false);
  const [query,setQuery] = useState("");
  const [modal,setModal] = useState(false);
  const [form,setForm] = useState({full_name:"",employee_code:"",email:"",phone:"",position:"",hire_date:"",salary:""});
  const t = copy[lang];
  const rtl = lang === "ar";

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setSession(Boolean(data.session)));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s) => setSession(Boolean(s)));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadRole() {
      if (!supabase || !session) { setRole(null); setEmployeeId(null); setRoleReady(true); return; }
      setRoleReady(false);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { if (alive) { setRole(null); setEmployeeId(null); setRoleReady(true); } return; }
      const { data, error: profileError } = await supabase.from("user_profiles").select("role,employee_id,is_active").eq("user_id", userData.user.id).maybeSingle();
      if (!alive) return;
      if (profileError || !data || !data.is_active) {
        setRole(null); setEmployeeId(null); setError(profileError?.message || "This account is not active or has no HR profile.");
      } else {
        setRole(data.role === "admin" ? "admin" : "employee");
        setEmployeeId(data.employee_id ?? null);
      }
      setRoleReady(true);
    }
    void loadRole();
    return () => { alive = false; };
  }, [session]);

  async function loadEmployees() {
    if (!supabase || !session) return;
    setLoading(true);
    const {data,error:err} = await supabase.from("employees").select("id,employee_code,full_name,email,phone,position,status,hire_date,salary").order("created_at",{ascending:false});
    if (err) setError(err.message); else setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  }
  useEffect(() => { void loadEmployees(); }, [session]);

  async function signIn(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setError("");
    const {error:err} = await supabase.auth.signInWithPassword({email,password});
    if (err) setError(err.message);
    setBusy(false);
  }
  async function signOut() { await supabase?.auth.signOut(); setSession(false); }
  async function addEmployee(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setError("");
    const {error:err} = await supabase.from("employees").insert({
      full_name:form.full_name.trim(), employee_code:form.employee_code || null,
      email:form.email || null, phone:form.phone || null, position:form.position || null,
      hire_date:form.hire_date || null, salary:form.salary ? Number(form.salary) : 0
    });
    if (err) setError(err.message);
    else { setModal(false); setForm({full_name:"",employee_code:"",email:"",phone:"",position:"",hire_date:"",salary:""}); await loadEmployees(); }
    setBusy(false);
  }
  const filtered = useMemo(() => employees.filter(x => [x.full_name,x.employee_code,x.email,x.position].some(v => (v ?? "").toLowerCase().includes(query.toLowerCase()))),[employees,query]);

  if (!isSupabaseConfigured) return <div className="setup-screen" dir={rtl?"rtl":"ltr"}><div className="setup-card"><div className="brand-mark"><ShieldCheck size={26}/></div><span className="eyebrow">HRATAION · HR MANAGEMENT</span><h1>{t.configTitle}</h1><p>{t.configHint}</p><div className="setup-note"><Activity size={18}/><span>{t.notConfigured}</span></div><button className="language-button" onClick={()=>setLang(rtl?"en":"ar")}><Globe2 size={16}/>{rtl?"English":"العربية"}</button></div></div>;

  if (session && !roleReady) return <div className="setup-screen"><div className="setup-card">{t.loading}</div></div>;
  if (session && role === "employee" && employeeId) return <EmployeeAttendance employeeId={employeeId} lang={lang} onSignOut={signOut}/>;
  if (session && role !== "admin") return <div className="setup-screen"><div className="setup-card"><h1>Access unavailable</h1><p>{error || "This account does not have an active HR role."}</p><button className="primary-button" onClick={signOut}>{t.logout}</button></div></div>;

  if (!session) return <div className="login-screen" dir={rtl?"rtl":"ltr"}><div className="login-decoration"><div className="orb orb-one"/><div className="orb orb-two"/><div className="login-brand"><div className="brand-mark"><ShieldCheck size={26}/></div><span>HRATAION</span></div><div className="login-message"><span className="eyebrow">PEOPLE · PROCESS · PERFORMANCE</span><h2>{rtl?"إدارة مواردك البشرية، بصورة أوضح.":"People management, made clearer."}</h2><p>{rtl?"مساحة عمل موحدة لإدارة فريقك ومتابعة عمليات الموارد البشرية.":"A unified workspace to manage your people and everyday HR operations."}</p></div><div className="login-foot">HRataion · Human Resources Workspace</div></div><div className="login-panel"><button className="language-button top-language" onClick={()=>setLang(rtl?"en":"ar")}><Globe2 size={16}/>{rtl?"English":"العربية"}</button><form className="login-form" onSubmit={signIn}><span className="eyebrow">{t.admin} ACCESS</span><h1>{t.signIn}</h1><p>{t.signInHint}</p><label>{t.email}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="admin@company.com"/></label><label>{t.password}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••••"/></label>{error&&<div className="error-box">{error}</div>}<button className="primary-button full-button" disabled={busy}>{busy?t.loading:t.signInButton}</button><div className="secure-note"><ShieldCheck size={15}/> Secure administrator access</div></form></div></div>;

  return <div className="app-shell" dir={rtl?"rtl":"ltr"}><aside className="sidebar"><div className="sidebar-brand"><div className="brand-mark"><ShieldCheck size={22}/></div><div><strong>HRATAION</strong><small>HR MANAGEMENT</small></div></div><div className="nav-caption">{t.nav}</div><nav>{navItems.filter(item => item.id !== "accounts" || role === "admin").map(item=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?"nav-item selected":"nav-item"} onClick={()=>setSection(item.id)}><Icon size={18}/><span>{t[item.key]}</span>{section===item.id&&<i/>}</button>})}</nav><div className="sidebar-bottom"><div className="admin-card"><div className="avatar">A</div><div><strong>{t.admin}</strong><small>{email||"admin"}</small></div><button title={t.logout} onClick={signOut}><LogOut size={16}/></button></div></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumb"><span>{t.company}</span><span>/</span><strong>{t[section]}</strong></div><div className="top-actions"><button className="icon-button" title="Help"><CircleHelp size={18}/></button><button className="language-button" onClick={()=>setLang(rtl?"en":"ar")}><Globe2 size={16}/>{rtl?"English":"العربية"}</button><div className="top-avatar">A</div></div></header><div className="page-content"><div className="page-heading"><div><span className="eyebrow">{t.overview} · {new Date().toLocaleDateString(rtl?"ar-IQ":"en-US",{month:"long",day:"numeric",year:"numeric"})}</span><h1>{section==="dashboard"?t.welcome:t[section]}</h1><p>{section==="dashboard"?t.subtitle:t[section]}</p></div>{section==="employees"&&<button className="primary-button" onClick={()=>setModal(true)}><Plus size={17}/>{t.addEmployee}</button>}</div>
{section==="dashboard"&&<><div className="stats-grid"><Stat icon={Users} label={t.totalEmployees} value={String(employees.length).padStart(2,"0")} tone="blue"/><Stat icon={CalendarCheck} label={t.presentToday} value="—" tone="green"/><Stat icon={CalendarDays} label={t.onLeave} value="—" tone="amber"/><Stat icon={Wallet} label={t.monthlyPayroll} value="—" tone="violet"/></div><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>{t.recentEmployees}</h3><p>{t.allEmployees}</p></div><button className="text-button" onClick={()=>setSection("employees")}>{t.viewAll} <ChevronDown size={15}/></button></div><EmployeeTable rows={employees.slice(0,5)} t={t} rtl={rtl} loading={loading}/></section><section className="panel quick-panel"><div className="panel-heading"><div><h3>{t.quickActions}</h3><p>Shortcuts</p></div></div><button className="quick-action" onClick={()=>{setSection("employees");setModal(true)}}><span className="quick-icon blue"><Users size={18}/></span><span><b>{t.addEmployee}</b><small>People directory</small></span><Plus size={17}/></button><button className="quick-action" onClick={()=>setSection("attendance")}><span className="quick-icon green"><CalendarCheck size={18}/></span><span><b>{t.recordAttendance}</b><small>Daily time tracking</small></span><Plus size={17}/></button><button className="quick-action" onClick={()=>setSection("leaves")}><span className="quick-icon amber"><CalendarDays size={18}/></span><span><b>{t.reviewLeaves}</b><small>Requests and approvals</small></span><Plus size={17}/></button></section></div></>}
{section==="accounts"&&<AccountManagement lang={lang}/>}
{section==="employees"&&<section className="panel directory-panel"><div className="directory-toolbar"><div><h3>{t.allEmployees}</h3><p>{employees.length} {t.employees.toLowerCase()}</p></div><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div></div><EmployeeTable rows={filtered} t={t} rtl={rtl} loading={loading}/></section>}
{!["dashboard","employees"].includes(section)&&<section className="panel empty-panel"><div className="empty-icon"><BriefcaseBusiness size={25}/></div><h3>{t[section]}</h3><p>{t.empty}</p><span className="coming-soon">MODULE · IN DEVELOPMENT</span></section>}
{error&&<div className="error-box page-error">{error}</div>}</div></main>
{modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="employee-modal" onSubmit={addEmployee}><div className="modal-heading"><div><span className="eyebrow">PEOPLE DIRECTORY</span><h2>{t.addEmployee}</h2></div><button type="button" className="icon-button" onClick={()=>setModal(false)}><X size={20}/></button></div><div className="form-grid"><label className="wide">{t.name}<input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>{t.code}<input value={form.employee_code} onChange={e=>setForm({...form,employee_code:e.target.value})}/></label><label>{t.position}<input value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label><label>{t.email}<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>{t.phone}<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>{t.hireDate}<input type="date" value={form.hire_date} onChange={e=>setForm({...form,hire_date:e.target.value})}/></label><label>{t.salary}<input type="number" min="0" value={form.salary} onChange={e=>setForm({...form,salary:e.target.value})}/></label></div>{error&&<div className="error-box">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setModal(false)}>{t.cancel}</button><button className="primary-button" disabled={busy}>{busy?t.loading:t.save}</button></div></form></div>}</div>;
}

function Stat({icon:Icon,label,value,tone}:{icon:typeof Users;label:string;value:string;tone:string}) { return <div className="stat-card"><div className={"stat-icon "+tone}><Icon size={19}/></div><span>{label}</span><strong>{value}</strong><small>HR WORKSPACE</small></div>; }
function EmployeeTable({rows,t,rtl,loading}:{rows:Employee[];t:Texts;rtl:boolean;loading:boolean}) {
 return <div className="table-wrap" dir={rtl?"rtl":"ltr"}><table><thead><tr><th>{t.name}</th><th>{t.code}</th><th>{t.position}</th><th>{t.email}</th><th>{t.hireDate}</th><th>{t.active}</th></tr></thead><tbody>{loading?<tr><td colSpan={6} className="empty-cell">{t.loading}</td></tr>:rows.length===0?<tr><td colSpan={6} className="empty-cell">{t.noEmployees}</td></tr>:rows.map(e=><tr key={e.id}><td><div className="person-cell"><div className="person-avatar">{e.full_name.charAt(0).toUpperCase()}</div><strong>{e.full_name}</strong></div></td><td className="muted-cell">{e.employee_code||"—"}</td><td>{e.position||"—"}</td><td className="muted-cell">{e.email||"—"}</td><td className="muted-cell">{e.hire_date||"—"}</td><td><span className={e.status==="inactive"?"status inactive":"status active"}>{e.status==="inactive"?t.inactive:t.active}</span></td></tr>)}</tbody></table></div>;
}