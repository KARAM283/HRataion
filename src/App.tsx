import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import type { FormEvent } from "react";
import { Activity, BriefcaseBusiness, CalendarCheck, ChartNoAxesCombined, ChevronDown, CircleHelp, Globe2, LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck, Users, X, UserCog, Trash2, Moon, Sun } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import AccountManagement from "./components/AccountManagement";
import EmployeeAttendance from "./components/EmployeeAttendance";
import AttendanceManagement from "./components/AttendanceManagement";
import { HRModules } from "./components/HRModules";
import CVBank from "./components/CVBank";
import AdminPasswordChange from "./components/AdminPasswordChange";

type Employee = { id: string; employee_code: string | null; full_name: string; email: string | null; phone: string | null; position: string | null; status: string | null; hire_date: string | null; salary: number | null; department_id: string | null };
type Department = { id:string; name:string };
type Texts = typeof copy.en | typeof copy.ar;
type Section = "dashboard" | "employees" | "departments" | "attendance" | "cvbank" | "reports" | "settings" | "accounts";
const copy = {
  en: { dashboard:"Dashboard", employees:"Employees", departments:"Departments", attendance:"Attendance", cvbank:"CV Bank", reports:"Reports", settings:"Settings", accounts:"Accounts", overview:"Overview", welcome:"Welcome back", subtitle:"Here’s what’s happening across your workforce.", totalEmployees:"Total employees", presentToday:"Present today", onLeave:"On leave", monthlyPayroll:"Monthly payroll", quickActions:"Quick actions", addEmployee:"Add employee", recordAttendance:"Record attendance", reviewLeaves:"", recentEmployees:"Recent employees", viewAll:"View all", search:"Search employees...", name:"Full name", code:"Employee ID", email:"Email address", phone:"Phone number", position:"Job title", hireDate:"Hire date", salary:"Monthly salary", save:"Save employee", cancel:"Cancel", noEmployees:"No employees yet", noEmployeesHint:"Add your first employee to start building your HR workspace.", signIn:"Sign in to HRration", signInHint:"Use your HRration account to continue.", password:"Password", signInButton:"Sign in", configTitle:"Connect your Supabase project", configHint:"Add your Supabase Project URL and publishable key in Cloudflare Pages environment variables, or create a local .env file using .env.example.", configured:"Supabase connection detected", notConfigured:"Supabase is not configured", loading:"Loading...", logout:"Sign out", language:"Language", admin:"Administrator", active:"Active", inactive:"Inactive", error:"Something went wrong", empty:"No records to display yet", nav:"Workspace", company:"HRration", allEmployees:"All employees", addNew:"Add new", currency:"IQD" },
  ar: { dashboard:"لوحة التحكم", employees:"الموظفون", departments:"الأقسام", attendance:"الحضور والانصراف", cvbank:"بنك السير الذاتية", reports:"التقارير", settings:"الإعدادات", accounts:"إدارة الحسابات", overview:"نظرة عامة", welcome:"مرحباً بعودتك", subtitle:"إليك ملخصاً لما يحدث ضمن فريق العمل.", totalEmployees:"إجمالي الموظفين", presentToday:"الحاضرون اليوم", onLeave:"في إجازة", monthlyPayroll:"رواتب الشهر", quickActions:"إجراءات سريعة", addEmployee:"إضافة موظف", recordAttendance:"تسجيل الحضور", reviewLeaves:"", recentEmployees:"أحدث الموظفين", viewAll:"عرض الكل", search:"ابحث عن موظف...", name:"الاسم الكامل", code:"الرقم الوظيفي", email:"البريد الإلكتروني", phone:"رقم الهاتف", position:"المسمى الوظيفي", hireDate:"تاريخ التعيين", salary:"الراتب الشهري", save:"حفظ الموظف", cancel:"إلغاء", noEmployees:"لا يوجد موظفون بعد", noEmployeesHint:"أضف أول موظف لبدء بناء مساحة إدارة الموارد البشرية.", signIn:"تسجيل الدخول إلى HRration", signInHint:"استخدم حسابك الوظيفي للمتابعة.", password:"كلمة المرور", signInButton:"دخول", configTitle:"اربط مشروع Supabase", configHint:"أضف Project URL وPublishable Key ضمن متغيرات Cloudflare Pages أو أنشئ ملف .env محلياً بالاعتماد على .env.example.", configured:"تم اكتشاف إعدادات Supabase", notConfigured:"لم يتم إعداد Supabase", loading:"جارٍ التحميل...", logout:"تسجيل الخروج", language:"اللغة", admin:"المدير", active:"نشط", inactive:"غير نشط", error:"حدث خطأ", empty:"لا توجد سجلات لعرضها حالياً", nav:"مساحة العمل", company:"HRration", allEmployees:"كل الموظفين", addNew:"إضافة جديد", currency:"د.ع" }
};
const navItems: { id: Section; icon: typeof LayoutDashboard; key: keyof typeof copy.en }[] = [
  {id:"dashboard",icon:LayoutDashboard,key:"dashboard"},{id:"employees",icon:Users,key:"employees"},{id:"attendance",icon:CalendarCheck,key:"attendance"},{id:"cvbank",icon:BriefcaseBusiness,key:"cvbank"},{id:"reports",icon:ChartNoAxesCombined,key:"reports"},{id:"settings",icon:Settings,key:"settings"},{id:"accounts",icon:UserCog,key:"accounts"}
];

export default function App() {
  const [lang,setLang] = useState<"en"|"ar">("en");
  const [theme,setTheme] = useState<"light"|"dark">(() => window.localStorage.getItem("hrration-theme")==="dark"?"dark":"light");
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
  const [departments,setDepartments] = useState<Department[]>([]);
  const [metrics,setMetrics] = useState({present:0});
  const [loading,setLoading] = useState(false);
  const [query,setQuery] = useState("");
  const [employeeView,setEmployeeView] = useState<"list"|"kanban">("list");
  const [selectedEmployee,setSelectedEmployee] = useState<Employee|null>(null);
  const [modal,setModal] = useState(false);
  const [form,setForm] = useState({full_name:"",employee_code:"",email:"",phone:"",position:"",hire_date:"",salary:"",department_id:""});
  const t = copy[lang];
  const rtl = lang === "ar";
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; window.localStorage.setItem("hrration-theme",theme); }, [theme]);

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
    if (!supabase || !session || role !== "admin") return;
    setLoading(true);
    const [{data,error:err},{data:deptData,error:deptError}] = await Promise.all([supabase.from("employees").select("id,employee_code,full_name,email,phone,position,status,hire_date,salary,department_id").order("created_at",{ascending:false}),supabase.from("departments").select("*")]);
    if (err) setError(err.message); else setEmployees((data ?? []) as Employee[]);
    if (deptError) setError(deptError.message); else setDepartments((deptData??[]).map((d:any)=>({id:d.id,name:d.name??d.department_name??d.title??d.code??"Department"})));
    setLoading(false);
  }
  useEffect(() => { void loadEmployees(); void loadDashboardMetrics(); }, [session, role]);


  async function loadDashboardMetrics(){ if(!supabase||!session||role!=="admin")return; const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Baghdad",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); const a=await supabase.from("attendance").select("id",{count:"exact",head:true}).eq("attendance_date",today).eq("status","present"); setMetrics({present:a.count??0}); }

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
      hire_date:form.hire_date || null, salary:form.salary ? Number(form.salary) : 0, department_id:form.department_id || null
    });
    if (err) setError(err.message);
    else { setModal(false); setForm({full_name:"",employee_code:"",email:"",phone:"",position:"",hire_date:"",salary:"",department_id:""}); await loadEmployees(); }
    setBusy(false);
  }

  async function deleteEmployee(id:string) { if(!supabase || !window.confirm(rtl?"هل تريد حذف ملف الموظف؟":"Delete this employee profile?")) return; const {error:err}=await supabase.from("employees").delete().eq("id",id); if(err)setError(err.message); else await loadEmployees(); }
  const filtered = useMemo(() => employees.filter(x => [x.full_name,x.employee_code,x.email,x.position].some(v => (v ?? "").toLowerCase().includes(query.toLowerCase()))),[employees,query]);

  if (!isSupabaseConfigured) return <div className="setup-screen" dir={rtl?"rtl":"ltr"}><div className="setup-card"><div className="brand-mark"><ShieldCheck size={26}/></div><span className="eyebrow">HRRATION · PEOPLE OPERATIONS</span><h1>{t.configTitle}</h1><p>{t.configHint}</p><div className="setup-note"><Activity size={18}/><span>{t.notConfigured}</span></div><button className="language-button" onClick={()=>setLang(rtl?"en":"ar")}><Globe2 size={16}/>{rtl?"English":"العربية"}</button></div></div>;

  if (session && !roleReady) return <div className="setup-screen"><div className="setup-card">{t.loading}</div></div>;
  if (session && role === "employee" && employeeId) return <EmployeeAttendance employeeId={employeeId} lang={lang} theme={theme} onThemeToggle={()=>setTheme(theme==="light"?"dark":"light")} onSignOut={signOut}/>;
  if (session && role !== "admin") return <div className="setup-screen"><div className="setup-card"><h1>Access unavailable</h1><p>{error || "This account does not have an active HR role."}</p><button className="primary-button" onClick={signOut}>{t.logout}</button></div></div>;

  if (!session) return <div className={`login-screen ${theme==="dark"?"theme-dark":""}`} dir={rtl?"rtl":"ltr"}><MotionConfig reducedMotion="user"><motion.div className="login-stage" initial={{opacity:0,y:18,scale:.985}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.55,ease:[.22,1,.36,1]}}><div className="login-stage-pattern"/><div className="login-top-brand"><img className="hrration-logo login-logo" src="/hrration-logo.svg" alt="HRration"/></div><div className="login-center"><div className="login-message"><span className="eyebrow">{rtl?"إدارة الأشخاص · تنظيم العمل · نمو الفريق":"PEOPLE · CULTURE · GROWTH"}</span><h2>{rtl?"كل فريق قوي يبدأ بإدارة أفضل.":"Your people. Your rhythm."}</h2><p>{rtl?"مساحة متكاملة لإدارة الموظفين والحضور وعمليات الموارد البشرية، بتجربة واحدة واضحة.":"A thoughtful workspace for your people, attendance and everyday HR operations."}</p></div><form className="login-form" onSubmit={signIn}><div className="login-form-heading"><span className="eyebrow">{rtl?"مساحة آمنة":"SECURE WORKSPACE"}</span><h1>{rtl?"مرحباً بعودتك":"Welcome back"}</h1><p>{rtl?"سجّل الدخول للمتابعة إلى مساحة العمل.":"Sign in to continue to your workspace."}</p></div><label>{rtl?"البريد الإلكتروني":"Email address"}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="username@blueline.local"/></label><label>{t.password}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••••"/></label>{error&&<div className="error-box">{error}</div>}<button className="primary-button full-button" disabled={busy}>{busy?t.loading:t.signInButton}</button><div className="secure-note"><ShieldCheck size={15}/>{rtl?"دخول آمن إلى حسابك":"Secure access to your HRration workspace"}</div></form></div><div className="login-stage-foot">HRRATION · PEOPLE OPERATIONS</div><div className="login-tools"><button className="language-button top-language" onClick={()=>setTheme(theme==="light"?"dark":"light")} title={theme==="light"?"Dark mode":"Light mode"}>{theme==="light"?<Moon size={16}/>:<Sun size={16}/>}</button><button className="language-button top-language" onClick={()=>setLang(rtl?"en":"ar")}><Globe2 size={16}/>{rtl?"English":"العربية"}</button></div></motion.div></MotionConfig></div>;

  return <div className={`app-shell ${theme==="dark"?"theme-dark":""}`} dir={rtl?"rtl":"ltr"}><aside className="sidebar"><div className="sidebar-brand"><img className="hrration-logo sidebar-logo" src="/hrration-logo.svg" alt="HRration"/></div><div className="nav-caption">{t.nav}</div><nav>{navItems.filter(item => item.id !== "accounts" || role === "admin").map(item=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?"nav-item selected":"nav-item"} onClick={()=>setSection(item.id)}><Icon size={18}/><span>{t[item.key]}</span>{section===item.id&&<i/>}</button>})}</nav><div className="sidebar-bottom"><div className="admin-card"><div className="avatar">A</div><div><strong>{t.admin}</strong><small>{email||"admin"}</small></div><button title={t.logout} onClick={signOut}><LogOut size={16}/></button></div></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumb"><span>{t.company}</span><span>/</span><strong>{t[section]}</strong></div><nav className="top-nav">{navItems.filter(item=>item.id!=="settings"&&item.id!=="accounts").map(item=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?"top-nav-item active":"top-nav-item"} onClick={()=>{setSection(item.id);setSelectedEmployee(null)}}><Icon size={15}/><span>{t[item.key]}</span></button>})}</nav><div className="top-actions"><button className="icon-button" title="Help"><CircleHelp size={18}/></button><button className="icon-button theme-toggle" title={theme==="light"?"Dark mode":"Light mode"} aria-label={theme==="light"?"Enable dark mode":"Enable light mode"} onClick={()=>setTheme(theme==="light"?"dark":"light")}>{theme==="light"?<Moon size={17}/>:<Sun size={17}/>}</button><button className="language-button" onClick={()=>setLang(rtl?"en":"ar")}><Globe2 size={16}/>{rtl?"English":"العربية"}</button><div className="top-avatar">A</div></div></header><MotionConfig reducedMotion="user"><AnimatePresence mode="wait" initial={false}><motion.div key={selectedEmployee?.id ? `employee-${selectedEmployee.id}` : section} className="page-content" initial={{opacity:0,y:12,filter:"blur(5px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} exit={{opacity:0,y:-8,filter:"blur(4px)"}} transition={{duration:.24,ease:[.22,1,.36,1]}}><div className="page-heading"><div><span className="eyebrow">{t.overview} · {new Date().toLocaleDateString(rtl?"ar-IQ":"en-US",{month:"long",day:"numeric",year:"numeric"})}</span><h1>{section==="dashboard"?t.welcome:t[section]}</h1><p>{section==="dashboard"?t.subtitle:t[section]}</p></div>{section==="employees"&&<button className="primary-button" onClick={()=>setModal(true)}><Plus size={17}/>{t.addEmployee}</button>}</div>
{section==="dashboard"&&<><div className="stats-grid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}><div className="stat-card"><div className="stat-icon blue"><Users size={19}/></div><span>{t.totalEmployees}</span><strong>{String(employees.length).padStart(2,"0")}</strong></div><div className="stat-card"><div className="stat-icon green"><CalendarCheck size={19}/></div><span>{t.presentToday}</span><strong>{String(metrics.present)}</strong></div></div><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>{t.recentEmployees}</h3><p>{t.allEmployees}</p></div><button className="text-button" onClick={()=>setSection("employees")}>{t.viewAll} <ChevronDown size={15}/></button></div><EmployeeTable rows={employees.slice(0,5)} t={t} rtl={rtl} loading={loading} departments={departments} onDelete={deleteEmployee} onSelect={e=>{setSelectedEmployee(e);setSection("employees")}}/></section><section className="panel quick-panel"><div className="panel-heading"><div><h3>{t.quickActions}</h3><p>Shortcuts</p></div></div><button className="quick-action" onClick={()=>{setSection("employees");setModal(true)}}><span className="quick-icon blue"><Users size={18}/></span><span><b>{t.addEmployee}</b><small>People directory</small></span><Plus size={17}/></button><button className="quick-action" onClick={()=>setSection("attendance")}><span className="quick-icon green"><CalendarCheck size={18}/></span><span><b>{t.recordAttendance}</b><small>Daily time tracking</small></span><Plus size={17}/></button></section></div></>}
{section==="accounts"&&<AccountManagement lang={lang}/>}
{section==="settings"&&role==="admin"&&<AdminPasswordChange lang={lang}/>}
{section==="attendance"&&<AttendanceManagement lang={lang}/>}
{section==="reports"&&<HRModules section={section} lang={lang}/>}
{section==="cvbank"&&<CVBank lang={lang}/>}
{section==="employees"&&selectedEmployee&&employees.some(e=>e.id===selectedEmployee.id)?<EmployeeProfile employee={employees.find(e=>e.id===selectedEmployee.id)!} departments={departments} rtl={rtl} onBack={()=>setSelectedEmployee(null)} onSaved={async()=>{await loadEmployees();setSelectedEmployee(null)}}/>:section==="employees"&&<section className="panel directory-panel"><div className="directory-toolbar"><div><h3>{t.allEmployees}</h3><p>{employees.length} {t.employees.toLowerCase()}</p></div><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><button className="secondary-button" onClick={()=>setEmployeeView("list")}>☷ {rtl?"قائمة":"List"}</button><button className="secondary-button" onClick={()=>setEmployeeView("kanban")}>▦ Kanban</button><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search}/></div></div></div>{employeeView==="list"?<EmployeeTable rows={filtered} t={t} rtl={rtl} loading={loading} departments={departments} onDelete={deleteEmployee} onSelect={setSelectedEmployee}/>:<EmployeeKanban employees={filtered} departments={departments} rtl={rtl} onSelect={setSelectedEmployee} onMove={async(id,department_id)=>{if(!supabase)return;const {error:e}=await supabase.from("employees").update({department_id}).eq("id",id);if(e)setError(e.message);else await loadEmployees()}}/>}</section>}
{!["dashboard","employees","accounts","attendance","cvbank","reports","settings"].includes(section)&&<section className="panel empty-panel"><div className="empty-icon"><BriefcaseBusiness size={25}/></div><h3>{t[section]}</h3><p>{t.empty}</p><span className="coming-soon">MODULE · IN DEVELOPMENT</span></section>}
{error&&<div className="error-box page-error">{error}</div>}</motion.div></AnimatePresence></MotionConfig></main>
{modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="employee-modal" onSubmit={addEmployee}><div className="modal-heading"><div><span className="eyebrow">PEOPLE DIRECTORY</span><h2>{t.addEmployee}</h2></div><button type="button" className="icon-button" onClick={()=>setModal(false)}><X size={20}/></button></div><div className="form-grid"><label className="wide">{t.name}<input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>{t.code}<input value={form.employee_code} onChange={e=>setForm({...form,employee_code:e.target.value})}/></label><label>{t.position}<input value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label><label>{rtl?"القسم":"Department"}<select value={form.department_id} onChange={e=>setForm({...form,department_id:e.target.value})}><option value="">—</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>{t.email}<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>{t.phone}<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>{t.hireDate}<input type="date" value={form.hire_date} onChange={e=>setForm({...form,hire_date:e.target.value})}/></label><label>{t.salary}<input type="number" min="0" value={form.salary} onChange={e=>setForm({...form,salary:e.target.value})}/></label></div>{error&&<div className="error-box">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setModal(false)}>{t.cancel}</button><button className="primary-button" disabled={busy}>{busy?t.loading:t.save}</button></div></form></div>}</div>;
}

function EmployeeKanban({employees,departments,rtl,onMove,onSelect}:{employees:Employee[];departments:Department[];rtl:boolean;onMove:(id:string,department_id:string|null)=>void;onSelect:(employee:Employee)=>void}){
 const [dragged,setDragged]=useState<string|null>(null);
 const cols=[...departments,{id:"__unassigned",name:rtl?"بدون قسم":"Unassigned"}];
 return <div style={{display:"flex",flexDirection:"column",gap:16,width:"100%"}}>{cols.map(d=><section key={d.id} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragged){onMove(dragged,d.id==="__unassigned"?null:d.id);setDragged(null)}}} style={{background:"#f7f9fc",border:"1px solid #e4eaf2",borderRadius:13,padding:14,width:"100%",boxSizing:"border-box"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 4px 13px",borderBottom:"1px solid #e7edf4",marginBottom:13}}><strong style={{fontSize:15,color:"#344861"}}>{d.name}</strong><span style={{fontSize:12,color:"#6f829a",background:"#eaf0f7",borderRadius:20,padding:"4px 10px"}}>{employees.filter(e=>(e.department_id??"__unassigned")===d.id).length}</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>{employees.filter(e=>(e.department_id??"__unassigned")===d.id).map(e=><article key={e.id} draggable onDragStart={()=>setDragged(e.id)} onClick={()=>onSelect(e)} title={rtl?"فتح ملف الموظف":"Open employee profile"} style={{background:"#fff",border:"1px solid #e5ebf2",borderRadius:11,padding:14,cursor:"pointer",boxShadow:"0 2px 7px #23334a0a",minHeight:82}}><strong style={{fontSize:14,color:"#30445d"}}>{e.full_name}</strong><div style={{fontSize:12,color:"#8090a4",marginTop:6}}>{e.position||"—"}</div><div style={{fontSize:11,color:"#9aa6b5",marginTop:7}}>{e.employee_code||""}</div></article>)}</div></section>)}</div>
}

function EmployeeTable({rows,t,rtl,loading,departments,onDelete,onSelect}:{rows:Employee[];t:Texts;rtl:boolean;loading:boolean;departments:Department[];onDelete:(id:string)=>void;onSelect:(employee:Employee)=>void}) {
 return <div className="table-wrap" dir={rtl?"rtl":"ltr"}><table><thead><tr><th>{t.name}</th><th>{t.code}</th><th>{t.position}</th><th>{rtl?"القسم":"Department"}</th><th>{t.email}</th><th>{t.hireDate}</th><th>{t.active}</th><th>{rtl?"الإجراءات":"Actions"}</th></tr></thead><tbody>{loading?<tr><td colSpan={8} className="empty-cell">{t.loading}</td></tr>:rows.length===0?<tr><td colSpan={8} className="empty-cell">{t.noEmployees}</td></tr>:rows.map(e=><tr key={e.id}><td><div className="person-cell"><div className="person-avatar">{e.full_name.charAt(0).toUpperCase()}</div><strong onClick={()=>onSelect(e)} style={{cursor:"pointer",color:"#2866b4"}} title={rtl?"فتح ملف الموظف":"Open employee profile"}>{e.full_name}</strong></div></td><td className="muted-cell">{e.employee_code||"—"}</td><td>{e.position||"—"}</td><td>{departments.find(d=>d.id===e.department_id)?.name||"—"}</td><td className="muted-cell">{e.email||"—"}</td><td className="muted-cell">{e.hire_date||"—"}</td><td><span className={e.status==="inactive"?"status inactive":"status active"}>{e.status==="inactive"?t.inactive:t.active}</span></td><td><button className="icon-button" title={rtl?"حذف":"Delete"} onClick={()=>onDelete(e.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>;
}
function EmployeeProfile({employee,departments,rtl,onBack,onSaved}:{employee:Employee;departments:Department[];rtl:boolean;onBack:()=>void;onSaved:()=>Promise<void>}){
 const [attendance,setAttendance]=useState<{id:string;attendance_date:string;check_in:string|null;check_out:string|null;status:string|null}[]>([]);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [editing,setEditing]=useState(false);const [saving,setSaving]=useState(false);const [form,setForm]=useState({full_name:employee.full_name,employee_code:employee.employee_code??"",position:employee.position??"",department_id:employee.department_id??"",phone:employee.phone??"",email:employee.email??"",hire_date:employee.hire_date??"",salary:employee.salary==null?"":String(employee.salary),status:employee.status??"active"});
 useEffect(()=>{let active=true;async function load(){if(!supabase){setLoading(false);return;}const {data,error:e}=await supabase.from("attendance").select("id,attendance_date,check_in,check_out,status").eq("employee_id",employee.id).order("attendance_date",{ascending:false}).limit(12);if(!active)return;if(e)setError(e.message);else setAttendance(data??[]);setLoading(false);}void load();return()=>{active=false}},[employee.id]);
 const label=(en:string,ar:string)=>rtl?ar:en;const department=departments.find(d=>d.id===employee.department_id)?.name??"—";
  async function saveProfile(event:FormEvent){event.preventDefault();if(!supabase)return;setSaving(true);setError("");const {error:dbError}=await supabase.from("employees").update({full_name:form.full_name.trim(),employee_code:form.employee_code||null,position:form.position||null,department_id:form.department_id||null,phone:form.phone||null,email:form.email||null,hire_date:form.hire_date||null,salary:form.salary?Number(form.salary):0,status:form.status}).eq("id",employee.id);if(dbError){setError(dbError.message);setSaving(false)}else{await onSaved();setSaving(false);setEditing(false)}}
 return <section className="panel" dir={rtl?"rtl":"ltr"} style={{display:"grid",gap:20}}><div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}><button className="secondary-button" onClick={onBack}>← {label("Back to employees","العودة إلى الموظفين")}</button><button className="primary-button" style={{marginInlineStart:"auto"}} onClick={()=>setEditing(v=>!v)}><Settings size={16}/>{label("Edit employee","تعديل بيانات الموظف")}</button><div style={{marginInlineStart:8}}><span className="eyebrow">{label("EMPLOYEE PROFILE","الملف الشخصي للموظف")}</span><h2 style={{margin:"5px 0",color:"#263b55"}}>{employee.full_name}</h2><span style={{color:"#8090a4",fontSize:13}}>{employee.position||label("No job title","لا يوجد مسمى وظيفي")}</span></div></div>
 {editing&&<form onSubmit={saveProfile} style={{display:"grid",gap:12,padding:18,border:"1px solid #dce5ef",borderRadius:12}}><h3>{label("Edit employee details","تعديل بيانات الموظف")}</h3><div className="form-grid">
<label>{label("Full name","الاسم الكامل")}<input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label>
<label>{label("Employee ID","الرقم الوظيفي")}<input value={form.employee_code} onChange={e=>setForm({...form,employee_code:e.target.value})}/></label>
<label>{label("Job title","المسمى الوظيفي")}<input value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label>
<label>{label("Department","القسم")}<select value={form.department_id} onChange={e=>setForm({...form,department_id:e.target.value})}><option value="">—</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
<label>{label("Phone","رقم الهاتف")}<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
<label>{label("Email","البريد الإلكتروني")}<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
<label>{label("Hire date","تاريخ التعيين")}<input type="date" value={form.hire_date} onChange={e=>setForm({...form,hire_date:e.target.value})}/></label>
<label>{label("Monthly salary","الراتب الشهري")}<input type="number" min="0" value={form.salary} onChange={e=>setForm({...form,salary:e.target.value})}/></label>
<label>{label("Status","الحالة")}<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">{label("Active","نشط")}</option><option value="inactive">{label("Inactive","غير نشط")}</option></select></label>
</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setEditing(false)}>{label("Cancel","إلغاء")}</button><button className="primary-button" disabled={saving}>{saving?label("Saving...","جارٍ الحفظ..."):label("Save changes","حفظ التعديلات")}</button></div></form>}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>{[[label("Employee ID","الرقم الوظيفي"),employee.employee_code],[label("Department","القسم"),department],[label("Job title","المسمى الوظيفي"),employee.position],[label("Phone","رقم الهاتف"),employee.phone],[label("Email","البريد الإلكتروني"),employee.email],[label("Hire date","تاريخ التعيين"),employee.hire_date],[label("Monthly salary","الراتب الشهري"),employee.salary==null?null:Number(employee.salary).toLocaleString()+" IQD"],[label("Status","الحالة"),employee.status??"active"]].map(([k,v])=><div key={String(k)} style={{background:"#f6f8fb",border:"1px solid #e8edf3",borderRadius:11,padding:15}}><div style={{fontSize:12,color:"#8190a3",marginBottom:7}}>{k}</div><strong style={{fontSize:15,color:"#354a63"}}>{v||"—"}</strong></div>)}</div>
 <div><h3 style={{margin:"0 0 12px",color:"#354a63"}}>{label("Recent attendance","سجل الحضور الأخير")}</h3>{error&&<div className="error-box">{error}</div>}<div className="table-wrap"><table><thead><tr><th>{label("Date","التاريخ")}</th><th>{label("Check in","وقت الدخول")}</th><th>{label("Check out","وقت الخروج")}</th><th>{label("Status","الحالة")}</th></tr></thead><tbody>{loading?<tr><td colSpan={4} className="empty-cell">{label("Loading...","جارٍ التحميل...")}</td></tr>:attendance.length===0?<tr><td colSpan={4} className="empty-cell">{label("No attendance records yet","لا توجد سجلات حضور بعد")}</td></tr>:attendance.map(a=><tr key={a.id}><td>{a.attendance_date}</td><td>{a.check_in?new Date(a.check_in).toLocaleTimeString(rtl?"ar-IQ":"en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Baghdad"}):"—"}</td><td>{a.check_out?new Date(a.check_out).toLocaleTimeString(rtl?"ar-IQ":"en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Baghdad"}):"—"}</td><td>{a.status??"—"}</td></tr>)}</tbody></table></div></div></section>
}