"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, Loader2, ScanLine, XCircle } from "lucide-react";

/**
 * The front desk's check-in: scan a customer's booking QR (camera, where
 * the browser can read QR codes) or paste/type what the QR holds, see
 * the booking, and mark the customer arrived. Talks only to
 * POST /api/business/check-in, which decides everything again.
 *
 * The camera loop reads at most one frame every SCAN_INTERVAL_MS, stops
 * the moment a code is read, and is torn down when the component goes:
 * nothing keeps the camera on in the background.
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

const WORDS: Record<State, { text: string; good: boolean }> = {
  valid: { text: "الكود سليم — تقدر تسجّل الوصول", good: true },
  "checked-in": { text: "اتسجّل وصوله قبل كده", good: true },
  completed: { text: "الحجز ده خلص", good: false },
  "too-early": { text: "بدري — التسجيل بيفتح", good: false },
  expired: { text: "وقت الحجز عدّى", good: false },
  cancelled: { text: "الحجز ده اتلغى", good: false },
  "not-confirmed": { text: "الحجز لسه مش متأكد", good: false },
  "no-show": { text: "الحجز اتسجّل إنه محضرش", good: false },
  "not-found": { text: "الكود مش معروف هنا — ممكن يكون لمكان تاني أو اتغيّر", good: false },
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

async function post(value: string, action: "verify" | "check-in"): Promise<Answer> {
  try {
    const res = await fetch("/api/business/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value, action }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { result: null, error: res.status === 401 ? "سجّل دخولك الأول" : j.error ?? "حصلت مشكلة" };
    return { result: j as Result, error: null };
  } catch {
    return { result: null, error: "تعذّر الاتصال، جرّب تاني" };
  }
}

export default function CheckInDesk({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported">("off");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const show = useCallback((r: Answer) => {
    setResult(r.result);
    setError(r.error);
  }, []);

  const call = useCallback(async (value: string, action: "verify" | "check-in") => {
    setBusy(true);
    setError(null);
    show(await post(value, action));
    setBusy(false);
  }, [show]);

  useEffect(() => {
    if (!initialCode) return;
    let live = true;
    void post(initialCode, "verify").then((r) => {
      if (live) show(r);
    });
    return () => {
      live = false;
    };
  }, [initialCode, show]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera((c) => (c === "on" ? "off" : c));
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamera("on");
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const detector = new Ctor({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const found = await detector.detect(video);
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
        <label className="text-sm font-semibold" htmlFor="checkin-code">الكود أو الرابط اللي في الـQR</label>
        <input id="checkin-code" className={field} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary btn-sm flex-1" disabled={busy || !code.trim()}>
            <ScanLine size={14} aria-hidden="true" /> اتحقق
          </button>
          {camera !== "on" ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void startCamera()} disabled={camera === "unsupported"}>
              <Camera size={14} aria-hidden="true" /> {camera === "unsupported" ? "الكاميرا مش متاحة هنا" : "امسح بالكاميرا"}
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" onClick={stopCamera}>اقفل الكاميرا</button>
          )}
        </div>
      </form>

      <video ref={videoRef} className={camera === "on" ? "w-full rounded-[var(--radius-md)] bg-black" : "hidden"} muted playsInline aria-label="الكاميرا" />

      {busy && <Loader2 className="animate-spin" size={18} aria-label="بيتحقق" />}
      {error && <p className="text-sm text-[var(--color-danger)]" role="alert">{error}</p>}

      {result && words && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4 space-y-2" role="status">
          <p className={`flex items-center gap-2 font-bold ${words.good ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>
            {words.good ? <CheckCircle size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
            {words.text}
            {result.state === "too-early" && result.opensAt ? <span dir="ltr"> {result.opensAt}</span> : null}
          </p>
          {result.booking && (
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-[var(--color-muted)]">العميل</dt><dd>{result.booking.customerName}</dd>
              <dt className="text-[var(--color-muted)]">الخدمة</dt><dd>{result.booking.serviceName}</dd>
              <dt className="text-[var(--color-muted)]">الميعاد</dt><dd dir="ltr" className="text-end">{result.booking.date} {result.booking.startTime}</dd>
              {result.booking.staffName && (<><dt className="text-[var(--color-muted)]">مع</dt><dd>{result.booking.staffName}</dd></>)}
              {result.booking.partySize ? (<><dt className="text-[var(--color-muted)]">عدد الأفراد</dt><dd>{result.booking.partySize}</dd></>) : null}
              {result.booking.reference && (<><dt className="text-[var(--color-muted)]">رقم الحجز</dt><dd dir="ltr" className="text-end">{result.booking.reference}</dd></>)}
            </dl>
          )}
          {result.state === "valid" && result.canCheckIn !== false && (
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void call(code.trim(), "check-in")}>
              سجّل الوصول
            </button>
          )}
          {result.state === "valid" && result.canCheckIn === false && (
            <p className="text-xs text-[var(--color-muted)]">مش مسموح لحسابك يسجّل الوصول.</p>
          )}
        </div>
      )}
    </div>
  );
}
