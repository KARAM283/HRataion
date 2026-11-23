import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { MapPin, RefreshCw, ShieldAlert } from "lucide-react";

const OFFICE = { latitude: 36.36056931159832, longitude: 43.14616438172047, radius: 100 };

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function OfficeAccessGate({ children, lang }: { children: ReactNode; lang: "ar" | "en" }) {
  const [state, setState] = useState<"checking" | "allowed" | "blocked">("checking");
  const [message, setMessage] = useState("");

  const verifyLocation = useCallback(() => {
    setState("checking");
    setMessage("");
    if (!("geolocation" in navigator)) {
      setState("blocked");
      setMessage(lang === "ar" ? "المتصفح لا يدعم تحديد الموقع." : "This browser does not support location access.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (coords.accuracy > 100) {
          setState("blocked");
          setMessage(lang === "ar"
            ? "دقة الموقع غير كافية. فعّل الموقع الدقيق وحاول مرة أخرى."
            : "Location accuracy is insufficient. Enable precise location and try again.");
          return;
        }
        const distance = distanceMeters(coords.latitude, coords.longitude, OFFICE.latitude, OFFICE.longitude);
        if (distance <= OFFICE.radius) {
          setState("allowed");
          setMessage("");
        } else {
          setState("blocked");
          setMessage(lang === "ar"
            ? "هذا النظام متاح للموظفين من داخل مقر الشركة فقط."
            : "Employee access is available only from the company office.");
        }
      },
      (error) => {
        setState("blocked");
        setMessage(error.code === error.PERMISSION_DENIED
          ? (lang === "ar" ? "اسمح للمتصفح بالوصول إلى موقعك حتى تتمكن من فتح النظام." : "Allow location access to open the employee workspace.")
          : (lang === "ar" ? "تعذر تحديد موقعك. تحقق من إعدادات GPS وحاول مجدداً." : "Unable to verify your location. Check GPS and try again."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [lang]);

  useEffect(() => { verifyLocation(); }, [verifyLocation]);

  if (state === "allowed") return <>{children}</>;

  return (
    <main className="setup-screen" dir={lang === "ar" ? "rtl" : "ltr"}>
      <section className="setup-card" style={{ maxWidth: 460, textAlign: "center" }}>
        <div className="brand-mark" style={{ marginInline: "auto" }}>
          {state === "checking" ? <MapPin size={26} /> : <ShieldAlert size={26} />}
        </div>
        <span className="eyebrow">HRRATION · OFFICE ACCESS</span>
        <h1>{state === "checking"
          ? (lang === "ar" ? "جارٍ التحقق من موقعك" : "Verifying your location")
          : (lang === "ar" ? "الوصول من خارج المكتب غير مسموح" : "Office access required")}</h1>
        <p>{state === "checking"
          ? (lang === "ar" ? "يرجى الانتظار بينما نتحقق من وجودك داخل مقر الشركة." : "Please wait while we verify that you are at the company office.")
          : message}</p>
        {state === "blocked" && <button className="primary-button full-button" onClick={verifyLocation}>
          <RefreshCw size={16} /> {lang === "ar" ? "إعادة التحقق من الموقع" : "Check location again"}
        </button>}
      </section>
    </main>
  );
}
