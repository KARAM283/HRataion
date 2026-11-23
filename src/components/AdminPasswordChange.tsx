import { useEffect, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import { KeyRound, ShieldCheck, LockKeyhole } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function AdminPasswordChange({ lang }: { lang: "en" | "ar" }) {
  const ar = lang === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      if (!supabase) return;
      const { data, error: invokeError } = await supabase.functions.invoke("admin-change-own-password", {
        body: { action: "status" },
      });
      if (!active) return;
      if (invokeError) setError(invokeError.message);
      else if (data?.error) setError(data.error);
      else setAllowed(data?.allowed === true);
    }
    void loadStatus();
    return () => { active = false; };
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    setSuccess(false);
    if (password.length < 10) {
      setError(ar ? "كلمة المرور يجب أن تكون 10 أحرف على الأقل." : "Password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError(ar ? "كلمتا المرور غير متطابقتين." : "Passwords do not match.");
      return;
    }
    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-change-own-password", {
      body: { new_password: password },
    });
    if (invokeError) setError(invokeError.message);
    else if (data?.error) setError(data.error);
    else {
      setAllowed(false);
      setSuccess(true);
      setPassword("");
      setConfirm("");
    }
    setBusy(false);
  }

  return <section className="panel" style={{ maxWidth: 680, display: "grid", gap: 18 }}>
    <div className="panel-heading">
      <div>
        <h3>{ar ? "أمان الحساب" : "Account security"}</h3>
        <p>{ar ? "تغيير كلمة مرور الحساب الإداري لمرة واحدة فقط." : "Change this administrator account password once only."}</p>
      </div>
      <span className="quick-icon blue"><ShieldCheck size={19}/></span>
    </div>
    {allowed === null && !error && <p>{ar ? "جارٍ التحقق من حالة الحساب..." : "Checking account status..."}</p>}
    {allowed === false && <div className="setup-note" style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <LockKeyhole size={19}/>
      <span>{ar ? "تم استخدام فرصة تغيير كلمة المرور. لا يمكن تغييرها مرة ثانية من هنا." : "The one-time password change has been used. It cannot be changed again here."}</span>
    </div>}
    {allowed === true && <form onSubmit={changePassword} style={{ display: "grid", gap: 14 }}>
      <label>{ar ? "كلمة المرور الجديدة" : "New password"}
        <input type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} style={fieldStyle}/>
      </label>
      <label>{ar ? "تأكيد كلمة المرور" : "Confirm password"}
        <input type="password" autoComplete="new-password" minLength={10} maxLength={72} required value={confirm} onChange={e => setConfirm(e.target.value)} style={fieldStyle}/>
      </label>
      <p style={{ color: "#8995a6", fontSize: 12, margin: 0 }}>
        {ar ? "اختر كلمة مرور قوية واحفظها بمكان آمن. بعد نجاح التغيير لن يتاح تغييره مرة أخرى من التطبيق." : "Choose a strong password and store it safely. After a successful change, this option will be locked."}
      </p>
      <button className="primary-button" disabled={busy}><KeyRound size={16}/>{busy ? (ar ? "جارٍ التغيير..." : "Updating...") : (ar ? "تغيير كلمة المرور نهائياً" : "Change password")}</button>
    </form>}
    {error && <div className="error-box">{error}</div>}
    {success && <div className="setup-note">{ar ? "تم تغيير كلمة المرور بنجاح. استخدم كلمة المرور الجديدة في تسجيل الدخول القادم." : "Password updated successfully. Use your new password the next time you sign in."}</div>}
  </section>;
}

const fieldStyle: CSSProperties = { width: "100%", padding: "11px 12px", marginTop: 7, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#26354b", font: "inherit", fontSize: 13 };
