import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Badge, Button, Card, ConfirmDialog, Icon, Text, TextField, colors, radius, spacing, useLocale, useToast } from "@/design";
import { shareLink } from "@/lib/share";
import { config } from "@/lib/config";
import { messageFor } from "@/lib/api/errors";
import type { AccessPayload, PassView } from "@/types/access";
import { canAskForPass, guestLink, isWaiting, PASS_STATE, showsCode } from "./logic";
import {
  useAddGuest,
  useBookingAccess,
  useNewCheckInCode,
  useRemoveGuest,
  useRequestPass,
  useRetryPass,
} from "./queries";

/**
 * A booking's "getting in": the check-in QR for the business's front desk,
 * and — where the venue offers them — visitor passes for its gates. Two
 * different codes, labelled so nobody shows one where the other is wanted.
 *
 * Everything is the server's: the same endpoint and states as the website
 * (src/app/booking/[token]/_components/AccessPanel.tsx). A pass shows a
 * code only once the venue's access system confirmed it; a sandbox pass
 * says it opens no real gate.
 */
export function AccessSection({ token, customerName }: { token: string; customerName: string }) {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const access = useBookingAccess(token, lang);
  const data = access.data;

  if (access.isLoading) return null;
  if (!data) {
    return access.error ? (
      <Card>
        <Text variant="caption" tone="muted">{T("مقدرناش نحمّل كود الوصول.", "We couldn't load your check-in code.")}</Text>
        <Button label={T("جرّب تاني", "Try again")} variant="outline" size="sm" onPress={() => access.refetch()} />
      </Card>
    ) : null;
  }
  const stale = access.isError && access.data;
  return (
    <View style={styles.stack} accessibilityLabel={T("الدخول", "Getting in")}>
      {stale ? (
        <Text variant="caption" tone="warn" accessibilityLiveRegion="polite">
          {T("مفيش اتصال — ده آخر كود اتحمّل. الاستقبال بيتأكد منه لما يقروه.", "No connection — this is the last code loaded. Reception checks it when they scan it.")}
        </Text>
      ) : null}
      <CheckInCard token={token} data={data} customerName={customerName} onChanged={access.resetPolls} />
      {data.visitorAccess.offered ? (
        <PassesCard token={token} data={data} customerName={customerName} onChanged={access.resetPolls} exhausted={isWaiting(data) && !access.isFetching && access.pollsExhausted} refetch={() => { access.resetPolls(); void access.refetch(); }} />
      ) : null}
    </View>
  );
}

function CheckInCard({ token, data, customerName, onChanged }: { token: string; data: AccessPayload; customerName: string; onChanged: () => void }) {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const c = data.checkIn;
  const newCode = useNewCheckInCode(token, lang);
  const [confirm, setConfirm] = useState(false);
  if (c.display === "unavailable") return null;
  return (
    <Card>
      <View style={styles.row}>
        <Icon name="qr-code-outline" size={18} color={colors.ink} />
        <Text variant="label" accessibilityRole="header">{T("كود تسجيل الوصول", "Check-in code")}</Text>
      </View>
      {c.display === "checked-in" ? (
        <Text variant="body" tone="ok">{T("اتسجّل وصولك.", "You're checked in.")}</Text>
      ) : (
        <>
          <Text variant="caption" tone="muted">
            {T(
              "اعرضه على الاستقبال لما توصل عشان يسجّلوا وصولك. ده كود الحجز بس — مش تصريح دخول للمول أو الكمبوند.",
              "Show it at reception when you arrive so they can check you in. This is your booking code only — not an entry pass for the mall or compound.",
            )}
          </Text>
          {c.qrSvg ? (
            <View
              style={styles.qr}
              accessible
              accessibilityRole="image"
              accessibilityLabel={T("كود QR لتسجيل وصولك للحجز. اعرضه على الاستقبال.", "QR code to check in for your booking. Show it at reception.")}
            >
              <SvgXml xml={c.qrSvg} width="100%" height="100%" />
            </View>
          ) : null}
          {c.opensAt && c.closesAt ? (
            <Text variant="caption" align="center">
              {c.display === "not-yet" ? T("الكود بيشتغل ", "The code works ") : T("شغّال ", "Works ")}
              {`${c.opensAt} – ${c.closesAt}`}
            </Text>
          ) : null}
          <Text variant="tiny" tone="muted">
            {T(`لو الكود مش بيتقري، قول اسمك (${customerName}) ورقم الحجز للاستقبال.`, `If the code won't scan, give reception your name (${customerName}) and booking number.`)}
          </Text>
          <Button
            label={T("حد تاني شاف الكود؟ اعمل كود جديد", "Someone else saw the code? Make a new one")}
            variant="ghost"
            size="sm"
            icon="refresh-outline"
            disabled={newCode.isPending}
            onPress={() => setConfirm(true)}
          />
          {newCode.isError ? <Text variant="caption" tone="danger">{messageFor(newCode.error, lang)}</Text> : null}
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title={T("تعمل كود جديد؟", "Make a new code?")}
        body={T("الكود الحالي هيبطل يشتغل خالص.", "Your current code will stop working for good.")}
        confirmLabel={T("أيوه، اعمل كود جديد", "Yes, make a new code")}
        destructive
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          newCode.mutate(undefined, { onSuccess: onChanged });
        }}
      />
    </Card>
  );
}

function PassesCard({
  token, data, customerName, onChanged, exhausted, refetch,
}: {
  token: string;
  data: AccessPayload;
  customerName: string;
  onChanged: () => void;
  exhausted: boolean;
  refetch: () => void;
}) {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const va = data.visitorAccess;
  const toast = useToast();
  const request = useRequestPass(token, lang);
  const addGuest = useAddGuest(token, lang);
  const removeGuest = useRemoveGuest(token, lang);
  const retry = useRetryPass(token, lang);
  const busy = request.isPending || addGuest.isPending || removeGuest.isPending || retry.isPending;
  const error = request.error ?? addGuest.error ?? removeGuest.error ?? retry.error;
  const phoneNeeded = va.identityRequirement === "NAME_AND_PHONE";

  return (
    <Card>
      <View style={styles.row}>
        <Icon name="shield-checkmark-outline" size={18} color={colors.ink} />
        <Text variant="label" accessibilityRole="header">
          {T("تصريح زيارة", "Visitor pass")}
          {va.venue ? ` — ${va.venue.name}` : ""}
        </Text>
      </View>
      {va.sandbox ? (
        <Badge tone="warn" icon="flask-outline" label={T("تجريبي — مش شغّال على أي بوابة حقيقية", "Test pass — not valid at any real gate")} />
      ) : null}
      {va.venue?.instructions ? <Text variant="caption" tone="muted">{va.venue.instructions}</Text> : null}

      {va.holder ? (
        <PassCard v={va.holder} you onRetry={() => retry.mutate(va.holder!.guestId, { onSuccess: onChanged })} busy={busy} />
      ) : canAskForPass(data) ? (
        <VisitorForm
          initialName={customerName}
          phone={phoneNeeded ? "optional" : "none"}
          busy={busy}
          cta={T("اطلب تصريح زيارة", "Request a visitor pass")}
          onSubmit={(v) => request.mutateAsync(v, { onSuccess: onChanged })}
        />
      ) : (
        <Text variant="caption" tone="muted">{va.eligibility.reason ?? T("التصريح مش متاح للحجز ده دلوقتي.", "A pass is not available for this booking right now.")}</Text>
      )}

      {va.holder && va.guestLimit > 0 ? (
        <View style={styles.guests}>
          <Text variant="tiny">{T(`المرافقين (${va.guests.length} من ${va.guestLimit})`, `Guests (${va.guests.length} of ${va.guestLimit})`)}</Text>
          {va.guests.map((g) => (
            <View key={g.guestId} style={styles.stack}>
              <PassCard v={g} onRetry={() => retry.mutate(g.guestId, { onSuccess: onChanged })} busy={busy} />
              <View style={styles.row}>
                {g.inviteToken ? (
                  <Button
                    label={T("ابعت رابط التصريح", "Send pass link")}
                    icon="share-outline"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      const url = guestLink(config.apiUrl, g.inviteToken!);
                      void shareLink(
                        { url, title: T(`تصريح ${g.displayName}`, `${g.displayName}'s pass`), message: T(`تصريح زيارتك: ${url}`, `Your visitor pass: ${url}`) },
                        (message, tone) => toast({ message, tone }),
                        T("اتنسخ الرابط", "Link copied"),
                      );
                    }}
                  />
                ) : null}
                <Button
                  label={T(`شيل ${g.displayName}`, `Remove ${g.displayName}`)}
                  icon="trash-outline"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={() => removeGuest.mutate(g.guestId, { onSuccess: onChanged })}
                />
              </View>
            </View>
          ))}
          {/* As the server counts: every guest not removed (the list shows exactly those). */}
          {va.guests.length < va.guestLimit ? (
            <VisitorForm
              initialName=""
              phone={phoneNeeded ? "required" : "none"}
              busy={busy}
              cta={T("ضيف مرافق", "Add a guest")}
              onSubmit={(v) => addGuest.mutateAsync(v, { onSuccess: onChanged })}
            />
          ) : null}
        </View>
      ) : null}

      {exhausted ? <Button label={T("شوف الحالة تاني", "Check status again")} variant="outline" size="sm" onPress={refetch} /> : null}
      {error ? <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">{messageFor(error, lang)}</Text> : null}
    </Card>
  );
}

function PassCard({ v, you, onRetry, busy }: { v: PassView; you?: boolean; onRetry: () => void; busy: boolean }) {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const s = PASS_STATE[v.state];
  const when = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: "Africa/Cairo", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : null;
  return (
    <View style={styles.pass}>
      <View style={styles.between}>
        <Text variant="label">{v.displayName}{you ? T(" (إنت)", " (you)") : ""}</Text>
        <Badge tone={s.tone} label={lang === "ar" ? s.label[0] : s.label[1]} />
      </View>
      {v.reason && v.state !== "active" ? <Text variant="caption" tone="muted">{v.reason}</Text> : null}
      {showsCode(v) ? (
        <>
          <View style={styles.qrSmall} accessible accessibilityRole="image" accessibilityLabel={T(`تصريح ${v.displayName} — اعرضه على البوابة`, `${v.displayName}'s pass — show it at the gate`)}>
            <SvgXml xml={v.qrSvg!} width="100%" height="100%" />
          </View>
          {v.validFrom && v.validUntil ? (
            <Text variant="caption" align="center">{`${when(v.validFrom)} – ${when(v.validUntil)}`}</Text>
          ) : null}
          {v.gates.length ? <Text variant="tiny" tone="muted" align="center">{T("البوابات: ", "Gates: ")}{v.gates.join(T("، ", ", "))}</Text> : null}
        </>
      ) : null}
      {v.canRetry ? <Button label={T("جرّب تاني", "Try again")} variant="outline" size="sm" disabled={busy} onPress={onRetry} /> : null}
    </View>
  );
}

function VisitorForm({
  initialName, phone: phoneMode, busy, cta, onSubmit,
}: {
  initialName: string;
  phone: "none" | "optional" | "required";
  busy: boolean;
  cta: string;
  onSubmit: (v: { displayName: string; phone?: string }) => Promise<unknown>;
}) {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const valid = name.trim().length >= 2 && (phoneMode !== "required" || phone.trim().length >= 8);
  return (
    <View style={styles.stack}>
      <TextField label={T("الاسم زي ما في البطاقة", "Name as on your ID")} value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
      {phoneMode !== "none" ? (
        <TextField
          label={phoneMode === "optional" ? T("رقم الموبايل (لو مختلف عن رقم الحجز)", "Mobile number (if not the booking's)") : T("رقم الموبايل", "Mobile number")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          ltr
          maxLength={20}
        />
      ) : null}
      <Button
        label={cta}
        icon="person-add-outline"
        disabled={!valid || busy}
        onPress={async () => {
          try {
            await onSubmit({ displayName: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) });
            if (!initialName) {
              setName("");
              setPhone("");
            }
          } catch {
            // Shown by the card from the mutation's error.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
  qr: {
    alignSelf: "center",
    width: 240,
    height: 240,
    maxWidth: "100%",
    padding: spacing.sm,
    backgroundColor: colors.qrPaper,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  qrSmall: { alignSelf: "center", width: 200, height: 200, padding: spacing.xs, backgroundColor: colors.qrPaper, borderRadius: radius.sm },
  pass: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  guests: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
