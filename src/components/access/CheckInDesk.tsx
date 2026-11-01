"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, Loader2, ScanLine, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { refusalText } from "@/lib/lang";

/**
 * The front desk's check-in: scan a customer's booking QR (camera, where
 * the browser can read QR codes) or paste/type what the QR holds, see
 * the booking, and mark the customer arrived. Talks only to
 * POST /api/business/check-in, which decides everything again.
 *
 * The camera loop reads at most one frame every SCAN_INTERVAL_MS, stops
 * the moment a code is read, and is torn down when the component goes:
 * nothing keeps the camera on in the background. Each start is a new
 * scan session; a stream or loop from an older session (a double click,
 * a quick stop/start, leaving the page while the browser asks for the
 * camera) is stopped the moment it is noticed.
 *
 * "Check in" acts on the code whose booking is on screen, never on
 * whatever has since been typed into the field, and only the newest
 * request's answer is shown.
 */

type State = "valid" | "checked-in" | "completed" | "too-early" | "expired" | "cancelled" | "not-confirmed" | "no-show" | "not-found";

interface Result {
  state: State;
  booking?: {
    id: string; reference: string | null; customerName: string; serviceName: string; staffName: string | null;
    date: string; startTime: string; endTime: string | null; partySize: number | null; status: string;
  };
  opensAt?: string;
  checkedInAt?: string | null;
  canCheckIn?: boolean;
}

const WORDS: Record<State, { text: [ar: string, en: string]; good: boolean }> = {
  valid: { text: ["الكود سليم — تقدر تسجّل الوصول", "Valid code — you can check them in"], good: true },
  "checked-in": { text: ["اتسجّل وصوله قبل كده", "Already checked in"], good: true },
  completed: { text: ["الحجز ده خلص", "This booking is completed"], good: false },
  "too-early": { text: ["بدري — التسجيل بيفتح", "Too early — check-in opens at"], good: false },
  expired: { text: ["وقت الحجز عدّى", "The booking time has passed"], good: false },
  cancelled: { text: ["الحجز ده اتلغى", "This booking was cancelled"], good: false },
  "not-confirmed": { text: ["الحجز لسه مش متأكد", "This booking is not confirmed yet"], good: false },
  "no-show": { text: ["الحجز اتسجّل إنه محضرش", "This booking was marked as a no-show"], good: false },
  "not-found": { text: ["الكود مش معروف هنا — ممكن يكون لمكان تاني أو اتغيّر", "Code not recognised here — it may be for another place, or replaced"], good: false },
};

const SCAN_INTERVAL_MS = 300;
const field = "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm";

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

interface Answer {
  result: Result | null;
  error: string | null;
}

async function post(value: string, action: "verify" | "check-in", en: boolean): Promise<Answer> {
  try {
    const res = await fetch(`/api/business/check-in${en ? "?lang=en" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value, action }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { result: null, error: res.status === 401 ? (en ? "Sign in first" : "سجّل دخولك الأول") : refusalText(res.status, j.error, en, "حصلت مشكلة") };
    }
    return { result: j as Result, error: null };
  } catch {
    return { result: null, error: en ? "Couldn't connect. Try again." : "تعذّر الاتصال، جرّب تاني" };
  }
}

export default function CheckInDesk({ initialCode }: { initialCode?: string }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, e: string) => (en ? e : ar);
  // The language requests ask for. A ref, so switching language does not
  // re-run the initial verify or replace what is on screen.
  const enRef = useRef(en);
  useEffect(() => {
    enRef.current = en;
  }, [en]);
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The code whose booking `result` describes: what "check in" acts on.
  const [shown, setShown] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "denied" | "unsupported">("off");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const session = useRef(0); // bumped on every camera start and stop
  const request = useRef(0); // only the newest request's answer is shown

  const show = useCallback((n: number, value: string, r: Answer) => {
    if (n !== request.current) return false; // a newer request owns the screen
    setResult(r.result);
    setShown(r.result ? value : null);
    setError(r.error);
    return true;
  }, []);

  const call = useCallback(async (value: string, action: "verify" | "check-in") => {
    const n = ++request.current;
    setBusy(true);
    setError(null);
    if (show(n, value, await post(value, action, enRef.current))) setBusy(false);
  }, [show]);

  useEffect(() => {
    if (!initialCode) return;
    let live = true;
    const n = ++request.current;
    void post(initialCode, "verify", enRef.current).then((r) => {
      if (live) show(n, initialCode, r);
    });
    return () => {
      live = false;
    };
  }, [initialCode, show]);

  const stopCamera = useCallback(() => {
    session.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera((c) => (c === "on" || c === "starting" ? "off" : c));
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    const mine = ++session.current;
    setCamera("starting");
    let stream: MediaStream | null = null;
    const release = () => stream?.getTracks().forEach((t) => t.stop());
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch (e) {
        if (mine !== session.current) return;
        // Refused by the person or the browser's settings: can be undone there, so the button stays.
        setCamera(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unsupported");
        return;
      }
      // Stopped, restarted or unmounted while the browser was asking.
      if (mine !== session.current || !videoRef.current) return release();
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      const detector = new Ctor({ formats: ["qr_code"] });
      if (mine !== session.current) return release();
      setCamera("on");
      const tick = async () => {
        if (mine !== session.current) return;
        try {
          const found = await detector.detect(video);
          if (mine !== session.current) return;
          if (found[0]?.rawValue) {
            stopCamera();
            setCode(found[0].rawValue);
            void call(found[0].rawValue, "verify");
            return;
          }
        } catch {
          // a frame that could not be read; try the next one
        }
        setTimeout(tick, SCAN_INTERVAL_MS);
      };
      void tick();
    } catch {
      release();
      if (streamRef.current === stream) streamRef.current = null;
      if (mine !== session.current) return;
      setCamera("unsupported");
    }
  }

  const words = result ? WORDS[result.state] : null;

  return (
    <div className="space-y-4 max-w-md">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void call(code.trim(), "verify");
        }}
      >
        <label className="text-sm font-semibold" htmlFor="checkin-code">{t("الكود أو الرابط اللي في الـQR", "The code or link in the QR")}</label>
        <input id="checkin-code" className={field} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary btn-sm flex-1" disabled={busy || !code.trim()}>
            <ScanLine size={14} aria-hidden="true" /> {t("اتحقق", "Verify")}
          </button>
          {camera === "starting" ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={stopCamera}>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> {t("بيفتح الكاميرا… إلغاء", "Opening camera… Cancel")}
            </button>
          ) : camera !== "on" ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void startCamera()} disabled={camera === "unsupported"}>
              <Camera size={14} aria-hidden="true" />{" "}
              {camera === "unsupported"
                ? t("الكاميرا مش متاحة هنا", "Camera not available here")
                : camera === "denied"
                  ? t("اسمح بالكاميرا وجرّب تاني", "Allow the camera and try again")
                  : t("امسح بالكاميرا", "Scan with camera")}
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" onClick={stopCamera}>{t("اقفل الكاميرا", "Close camera")}</button>
          )}
        </div>
      </form>

      <video ref={videoRef} className={camera === "on" ? "w-full rounded-[var(--radius-md)] bg-black" : "hidden"} muted playsInline aria-label={t("الكاميرا", "Camera")} />

      {busy && <Loader2 className="animate-spin" size={18} aria-label={t("بيتحقق", "Checking")} />}
      {error && <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>}

      {result && words && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4 space-y-2" role="status">
          <p className={`flex items-center gap-2 font-bold ${words.good ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>
            {words.good ? <CheckCircle size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
            {en ? words.text[1] : words.text[0]}
            {result.state === "too-early" && result.opensAt ? <span dir="ltr"> {result.opensAt}</span> : null}
          </p>
          {result.booking && (
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-[var(--color-muted)]">{t("العميل", "Customer")}</dt><dd>{result.booking.customerName}</dd>
              <dt className="text-[var(--color-muted)]">{t("الخدمة", "Service")}</dt><dd>{result.booking.serviceName}</dd>
              <dt className="text-[var(--color-muted)]">{t("الميعاد", "Time")}</dt><dd dir="ltr" className="text-end">{result.booking.date} {result.booking.startTime}</dd>
              {result.booking.staffName && (<><dt className="text-[var(--color-muted)]">{t("مع", "With")}</dt><dd>{result.booking.staffName}</dd></>)}
              {result.booking.partySize ? (<><dt className="text-[var(--color-muted)]">{t("عدد الأفراد", "Party size")}</dt><dd>{result.booking.partySize}</dd></>) : null}
              {result.booking.reference && (<><dt className="text-[var(--color-muted)]">{t("رقم الحجز", "Booking number")}</dt><dd dir="ltr" className="text-end">{result.booking.reference}</dd></>)}
            </dl>
          )}
          {result.state === "valid" && result.canCheckIn !== false && shown && (
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void call(shown, "check-in")}>
              {t("سجّل الوصول", "Check in")}
            </button>
          )}
          {result.state === "valid" && result.canCheckIn === false && (
            <p className="text-xs text-[var(--color-muted)]">{t("مش مسموح لحسابك يسجّل الوصول.", "Your account may not check customers in.")}</p>
          )}
        </div>
      )}
    </div>
  );
}
