import React, { useEffect, useId, useRef, useState } from "react";
import { localizedError, useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import type { AgentTenant, TenantLeadOption, TenantRoomOption } from "@nestyk/types";
import { createAgentTenant, tenantLeadOptions, tenantRoomOptions } from "../../lib/agent-tenants-api";
import {
  TENANT_PROFILE_MAX,
  tenantProfileBody,
  tenantProfileFromLead,
  tenantProfileIssues,
  type TenantProfileField,
  type TenantProfileForm,
  type TenantProfileIssue,
} from "../../lib/tenant-profile";
import { nextIdentityNumberDraft } from "../../lib/identity-number";
import { DealOfferSection } from "../DealOfferSection";
import { StatusBadge, WebState } from "./ui";
import type { AgentTenantCreatePageProps } from "./AgentTenantCreatePage.types";
import "./agent-tenant-create.css";

const EMPTY_FORM: TenantProfileForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  identityNumber: "",
  nationality: "",
  note: "",
};

/**
 * W4 (Mos 13–17 Nov 2026, layout ก): create tenant as a full page wizard. Steps rail on the left; a click on a
 * lead opens its rooms and a click on a room opens "Confirm booking" on the page, as taps do in the app.
 * Same API, profile rules, offer section and words as the app's TenantForm + ReserveRoomSheet.
 */
export function AgentTenantCreatePage({ onBusy, backRef, onCreated, onDone }: AgentTenantCreatePageProps) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const web = c.webCreate;
  const viewing = t.agent.leads.viewing;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [lead, setLead] = useState<TenantLeadOption | null>(null);
  const [room, setRoom] = useState<TenantRoomOption | null>(null);
  const [leads, setLeads] = useState<TenantLeadOption[]>([]);
  const [rooms, setRooms] = useState<TenantRoomOption[]>([]);
  const [search, setSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<TenantProfileForm>(EMPTY_FORM);
  const [issues, setIssues] = useState<Partial<Record<TenantProfileField, TenantProfileIssue>>>({});
  const [editing, setEditing] = useState(false);
  const [offerConfirmed, setOfferConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<AgentTenant | null>(null);
  const [focusBad, setFocusBad] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const uid = useId();
  const leadId = lead?.id ?? null;
  const roomId = room?.id ?? null;

  // Lists, as in TenantForm: leads on step 1, rooms (this lead's viewings first) on step 2.
  useEffect(() => {
    if (step === 3) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const timer = setTimeout(async () => {
      try {
        if (step === 1) {
          const data = await tenantLeadOptions(search);
          if (!cancelled) setLeads(data);
        } else {
          const data = await tenantRoomOptions(roomSearch, { leadId: leadId ?? undefined });
          if (!cancelled) setRooms(data);
        }
      } catch (e) {
        if (!cancelled) setLoadError(localizedError(e, "", locale));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, search, roomSearch, retry, leadId, locale]);

  // Step 3 reads the room again (number and booking state may have changed), like the sheet does.
  useEffect(() => {
    if (step !== 3 || !leadId || !roomId) return;
    let active = true;
    tenantRoomOptions("", { leadId, roomId })
      .then((rows) => {
        const found = rows.find((row) => row.id === roomId);
        if (active && found) setRoom(found);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [step, leadId, roomId]);

  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);

  useEffect(() => {
    if (!backRef) return;
    backRef.current = () => {
      // The tenant exists already: back closes the "Booked" dialog like "Later" (R1, review 17 Nov).
      if (booked) {
        onDone(booked, "list");
        return true;
      }
      if (step <= 1) return false;
      setStep(step === 3 ? 2 : 1);
      return true;
    };
    return () => {
      backRef.current = null;
    };
  }, [backRef, step, booked, onDone]);

  // After a failed check, go to the first field with a problem (the sheet does the same).
  useEffect(() => {
    if (!focusBad) return;
    const field = rootRef.current?.querySelector<HTMLElement>('.awtc-confirm [aria-invalid="true"]');
    field?.focus();
    field?.scrollIntoView?.({ block: "center" });
  }, [focusBad]);

  // "Booked" dialog: Escape = "Later", Tab stays inside the dialog.
  useEffect(() => {
    if (!booked || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDone(booked, "list");
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button") ?? []);
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const inside = dialogRef.current?.contains(document.activeElement) ?? false;
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [booked, onDone]);

  function pickLead(next: TenantLeadOption) {
    if (lead?.id !== next.id) {
      setLead(next);
      setRoom(null);
      setRooms([]);
      setRoomSearch("");
    }
    setStep(2);
  }
  function pickRoom(next: TenantRoomOption) {
    if (next.bookedBy) return;
    if (!lead) return;
    setRoom(next);
    setForm(tenantProfileFromLead(lead));
    setIssues({});
    setEditing(false);
    setError(null);
    setOfferConfirmed(false);
    setStep(3);
  }

  const issueText: Record<TenantProfileIssue, string> = {
    required: c.errorRequired,
    phone: c.errorPhone,
    email: c.errorEmail,
    identity: c.errorIdentity,
    thai_id: c.errorThaiId,
  };
  const fieldError = (key: TenantProfileField) => (issues[key] ? issueText[issues[key]!] : undefined);
  const setField = (key: TenantProfileField, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setIssues((current) => {
      const clearsIdentity = key === "nationality" && current.identityNumber === "thai_id";
      if (!current[key] && !clearsIdentity) return current;
      const next = { ...current };
      delete next[key];
      if (clearsIdentity) delete next.identityNumber;
      return next;
    });
    setError(null);
  };

  const roomLabel = (r: TenantRoomOption) => (r.room ? viewing.roomNumber.replace("{number}", r.room) : c.roomNoNumber);
  const roomLine = room ? [room.property, roomLabel(room)].filter(Boolean).join(" · ") : "";
  const takenBy = room?.bookedBy ?? null;
  const customerLine = [
    [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ") || lead?.name || "",
    form.phone.trim(),
    form.nationality.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  const confirm = async () => {
    if (saving.current || !lead || !room || takenBy || !offerConfirmed) return;
    const found = tenantProfileIssues(form, lead.nationality);
    setIssues(found);
    if (Object.keys(found).length) {
      // Name, phone and nationality sit behind "edit": open it so the message shows.
      if (found.firstName || found.phone || found.identityNumber === "thai_id") setEditing(true);
      setFocusBad((n) => n + 1);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const tenant = await createAgentTenant({ leadId: lead.id, rentRoomId: room.id, ...tenantProfileBody(form) });
      // Tell the list and the shell now (lead is booked), as the app sheet's onReserved; the dialog only picks where to go.
      onCreated(tenant);
      setBooked(tenant);
    } catch (err) {
      const code = (err as { code?: unknown } | null)?.code;
      setError(code === "OFFER_NOT_CONFIRMED" ? t.contracts.offer.needConfirmed : localizedError(err, t.common.errorGeneric, locale));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const stepItem = (n: 1 | 2 | 3, label: string, sub: string, value: string | null, go: () => void) => {
    const done = step > n && value;
    const current = step === n;
    return (
      <li className={done ? "is-done" : undefined} key={n}>
        {done ? (
          <button type="button" className="awtc-step awtc-step-done" onClick={go} disabled={busy} data-testid={`tenantCreate.step${n}`}>
            <span className="awtc-step-n" aria-hidden="true">
              <MobileIcon name="check" size={15} color="currentColor" />
            </span>
            <span className="awtc-step-v">
              <small>{label}</small>
              <b>{value}</b>
            </span>
            <span className="awtc-step-change">{web.change}</span>
          </button>
        ) : (
          <span className={`awtc-step${current ? " is-current" : ""}`} aria-current={current ? "step" : undefined}>
            <span className="awtc-step-n" aria-hidden="true">{n}</span>
            <span className="awtc-step-v">
              <span>{label}</span>
              <small>{sub}</small>
            </span>
          </span>
        )}
      </li>
    );
  };

  const listState = (items: unknown[], empty: string, noMatch: string, query: string) => {
    if (loadError !== null)
      return <WebState kind="error" compact title={c.loadError} description={loadError || undefined} onRetry={() => setRetry((n) => n + 1)} />;
    if (loading && !items.length) return <p className="awtc-hint">{t.common.loading}</p>;
    if (!items.length) return <WebState kind={query ? "filtered" : "empty"} compact title={query ? noMatch : empty} />;
    return null;
  };

  return (
    <div className="awtc-page" ref={rootRef} data-testid="tenantCreate.page">
      <div className="awtc-layout" inert={!!booked}>
        <aside className="awtc-rail" aria-label={web.stepsLabel}>
          <div className="awtc-progress">
            <span className="awtc-progress-text">
              <b>{c.create}</b>
              <span>{web.stepOf.replace("{step}", String(step)).replace("{total}", "3")}</span>
            </span>
            <span
              role="progressbar"
              aria-label={web.stepOf.replace("{step}", String(step)).replace("{total}", "3")}
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={step}
              aria-valuetext={web.stepOf.replace("{step}", String(step)).replace("{total}", "3")}
              className="awtc-bar"
            >
              <span style={{ width: `${Math.round((step / 3) * 100)}%` }} />
            </span>
          </div>
          <ol className="awtc-steps">
            {stepItem(1, c.stepLead, web.leadSub, lead?.name ?? null, () => setStep(1))}
            {stepItem(2, c.stepRoom, web.roomSub, room ? roomLine : null, () => setStep(2))}
            {stepItem(3, c.reserveTitle, web.confirmSub, null, () => undefined)}
          </ol>
        </aside>

        <div className="awtc-main">
          {step === 1 ? (
            <section className="awtc-list" aria-label={c.stepLead}>
              <label className="awtc-search">
                <MobileIcon name="search" size={18} color="currentColor" />
                <input
                  className="awtc-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={c.leadSearch}
                  aria-label={c.leadSearch}
                  data-testid="tenantCreate.leadSearch"
                />
              </label>
              <p className="awtc-hint">{c.leadListHint}</p>
              {listState(leads, c.leadEmpty, c.leadNoMatch, search) ??
                leads.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`awtc-pick${l.id === leadId ? " is-on" : ""}`}
                    aria-pressed={l.id === leadId}
                    onClick={() => pickLead(l)}
                    data-testid={`tenantCreate.lead.${l.id}`}
                  >
                    <span className="awtc-avatar" aria-hidden="true">
                      {l.name.trim().slice(0, 2)}
                    </span>
                    <span className="awtc-pick-v">
                      <b>{l.name}</b>
                      <small>{[l.phone, l.email].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span className="awtc-go" aria-hidden="true">
                      <MobileIcon name="chevron-right" size={18} color="currentColor" />
                    </span>
                  </button>
                ))}
              <div className="awtc-bar-row">
                <span className="awtc-hint">{web.pickLeadHint}</span>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="awtc-list" aria-label={c.stepRoom}>
              <label className="awtc-search">
                <MobileIcon name="search" size={18} color="currentColor" />
                <input
                  className="awtc-input"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder={c.roomSearch}
                  aria-label={c.roomSearch}
                  data-testid="tenantCreate.roomSearch"
                />
              </label>
              <p className="awtc-hint">{c.roomListHint}</p>
              {listState(rooms, c.roomEmpty, c.roomEmpty, roomSearch) ??
                rooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`awtc-pick${r.id === roomId ? " is-on" : ""}`}
                    aria-pressed={r.id === roomId}
                    disabled={!!r.bookedBy}
                    onClick={() => pickRoom(r)}
                    data-testid={`tenantCreate.room.${r.id}`}
                  >
                    <span className="awtc-thumb" aria-hidden="true">
                      <MobileIcon name="buildings" size={22} color="currentColor" />
                    </span>
                    <span className="awtc-pick-v">
                      <b>{r.property}</b>
                      <small>{roomLabel(r)}</small>
                    </span>
                    {r.viewed ? <StatusBadge label={c.roomViewed} intent="attn" /> : null}
                    {r.bookedBy ? <StatusBadge label={c.roomBookedBy.replace("{name}", r.bookedBy)} intent="neutral" /> : null}
                    {!r.bookedBy ? (
                      <span className="awtc-go" aria-hidden="true">
                        <MobileIcon name="chevron-right" size={18} color="currentColor" />
                      </span>
                    ) : null}
                  </button>
                ))}
              <div className="awtc-bar-row">
                <button type="button" className="awu-btn" onClick={() => setStep(1)}>
                  {c.back}
                </button>
                <span className="awtc-hint">{web.pickRoomHint}</span>
              </div>
            </section>
          ) : null}

          {step === 3 && lead && room ? (
            <section className="awtc-confirm" aria-label={c.reserveTitle}>
              {takenBy ? (
                <p className="awtc-notice is-danger" role="alert">
                  {c.reserveTaken.replace("{name}", takenBy)}
                </p>
              ) : (
                <div className="awtc-card awtc-offer">
                  {/* D2: the terms the landlord confirms before the room can be booked (same section as the app sheet). */}
                  <DealOfferSection key={`${lead.id}:${room.id}`} leadId={lead.id} roomId={room.id} disabled={busy} onConfirmedChange={setOfferConfirmed} />
                </div>
              )}

              <div className="awtc-card">
                <div className="awtc-card-head">
                  <span className="awtc-icon" aria-hidden="true">
                    <MobileIcon name="file-text" size={18} color="currentColor" />
                  </span>
                  <span className="awtc-card-titles">
                    <h2>{web.docTitle}</h2>
                    <small>{web.docHint}</small>
                  </span>
                </div>
                <div className="awtc-grid">
                  <div className="awtc-field">
                    <label htmlFor={`${uid}-email`}>{c.reserveEmail}</label>
                    <input
                      id={`${uid}-email`}
                      className={`awtc-input${fieldError("email") ? " is-bad" : ""}`}
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      maxLength={TENANT_PROFILE_MAX.email}
                      disabled={busy}
                      placeholder="name@example.com"
                      aria-invalid={!!fieldError("email")}
                      aria-describedby={`${uid}-email-help`}
                      onChange={(e) => setField("email", e.target.value)}
                      data-testid="reserve.email"
                    />
                    <small id={`${uid}-email-help`} className={fieldError("email") ? "awtc-err" : "awtc-hint"}>
                      {fieldError("email") ?? (form.email.trim() ? c.reserveEmailHint : c.reserveEmailMissing)}
                    </small>
                  </div>
                  <div className="awtc-field">
                    <label htmlFor={`${uid}-identity`}>{c.reserveIdentity}</label>
                    <input
                      id={`${uid}-identity`}
                      className={`awtc-input${fieldError("identityNumber") ? " is-bad" : ""}`}
                      value={form.identityNumber}
                      maxLength={TENANT_PROFILE_MAX.identityNumber}
                      disabled={busy}
                      placeholder={c.reserveIdentityPlaceholder}
                      autoCapitalize="characters"
                      aria-invalid={!!fieldError("identityNumber")}
                      aria-describedby={fieldError("identityNumber") ? `${uid}-identity-help` : undefined}
                      onChange={(e) => setField("identityNumber", nextIdentityNumberDraft(e.target.value))}
                      data-testid="reserve.identity"
                    />
                    {fieldError("identityNumber") ? (
                      <small id={`${uid}-identity-help`} className="awtc-err">
                        {fieldError("identityNumber")}
                      </small>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={`awtc-card${fieldError("firstName") || fieldError("phone") ? " is-bad" : ""}`}>
                <div className="awtc-card-head">
                  <span className="awtc-icon" aria-hidden="true">
                    <MobileIcon name="user" size={18} color="currentColor" />
                  </span>
                  <span className="awtc-card-titles">
                    <h2>{web.customerTitle}</h2>
                    <small>{fieldError("firstName") || fieldError("phone") ? c.reserveProfileIssue : customerLine || web.customerHint}</small>
                  </span>
                  <button
                    type="button"
                    className="awu-btn awtc-edit"
                    aria-expanded={editing}
                    disabled={busy}
                    onClick={() => setEditing((open) => !open)}
                    data-testid="reserve.editProfile"
                  >
                    {editing ? web.hideCustomer : web.editCustomer}
                  </button>
                </div>
                {editing ? (
                  <div className="awtc-grid awtc-grid-sep">
                    {(
                      [
                        ["firstName", c.fieldFirstName, true, "given-name"],
                        ["lastName", c.fieldLastName, false, "family-name"],
                        ["phone", c.fieldPhone, true, "tel"],
                        ["nationality", c.fieldNationality, false, undefined],
                      ] as const
                    ).map(([key, label, required, auto]) => (
                      <div className="awtc-field" key={key}>
                        <label htmlFor={`${uid}-${key}`}>
                          {label}
                          {required ? <span className="awtc-req"> *</span> : null}
                        </label>
                        <input
                          id={`${uid}-${key}`}
                          className={`awtc-input${fieldError(key) ? " is-bad" : ""}`}
                          value={form[key]}
                          maxLength={TENANT_PROFILE_MAX[key]}
                          disabled={busy}
                          autoComplete={auto}
                          inputMode={key === "phone" ? "tel" : undefined}
                          aria-invalid={!!fieldError(key)}
                          aria-describedby={fieldError(key) ? `${uid}-${key}-help` : undefined}
                          onChange={(e) => setField(key, e.target.value)}
                          data-testid={`reserve.${key}`}
                        />
                        {fieldError(key) ? (
                          <small id={`${uid}-${key}-help`} className="awtc-err">
                            {fieldError(key)}
                          </small>
                        ) : null}
                      </div>
                    ))}
                    <div className="awtc-field awtc-span2">
                      <label htmlFor={`${uid}-note`}>{c.fieldNote}</label>
                      <textarea
                        id={`${uid}-note`}
                        className="awtc-input"
                        value={form.note}
                        maxLength={TENANT_PROFILE_MAX.note}
                        disabled={busy}
                        onChange={(e) => setField("note", e.target.value)}
                        data-testid="reserve.note"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {!takenBy ? (
                <p className="awtc-notice" data-testid="reserve.info">
                  {c.reserveInfo}
                </p>
              ) : null}

              <div className="awtc-bar-row">
                <button type="button" className="awu-btn" disabled={busy} onClick={() => setStep(2)}>
                  {c.back}
                </button>
                <span className="awtc-confirm-side">
                  {error ? (
                    <span className="awtc-err" role="alert">
                      {error}
                    </span>
                  ) : !takenBy && !offerConfirmed ? (
                    <span className="awtc-hint" id="awtc-why">
                      {t.contracts.offer.needConfirmed}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="awu-btn awu-btn-primary awtc-cta"
                    disabled={busy || !!takenBy || !offerConfirmed}
                    aria-describedby={!takenBy && !offerConfirmed ? "awtc-why" : undefined}
                    onClick={() => void confirm()}
                    data-testid="reserve.confirm"
                  >
                    {busy ? t.common.loading : c.reserveConfirm}
                  </button>
                </span>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {booked ? (
        <div className="awtc-scrim" role="presentation">
          <section
            ref={dialogRef}
            className="awtc-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="awtc-booked-title"
            aria-describedby="awtc-booked-body"
            data-testid="reserve.booked"
          >
            <span className="awtc-done-icon" aria-hidden="true">
              <MobileIcon name="check" size={26} color="currentColor" />
            </span>
            <h2 id="awtc-booked-title">{c.reservedTitle}</h2>
            <p className="awtc-muted">{[booked.name, roomLine].filter(Boolean).join(" · ")}</p>
            <div id="awtc-booked-body">
              {booked.email && booked.identityNumber ? (
                <p className="awtc-muted">{c.reservedNext}</p>
              ) : (
                <p className="awtc-notice" role="status">
                  {booked.email ? c.reservedNeedsIdentity : c.reservedNeedsEmail}
                </p>
              )}
            </div>
            <span className="awtc-dialog-actions">
              <button type="button" className="awu-btn" onClick={() => onDone(booked, "list")} data-testid="reserve.later">
                {c.later}
              </button>
              <button
                type="button"
                className="awu-btn awu-btn-primary"
                autoFocus
                onClick={() => onDone(booked, booked.email && booked.identityNumber ? "reservation" : "tenant")}
                data-testid="reserve.next"
              >
                {booked.email && booked.identityNumber ? c.continueToLetter : c.openTenant}
              </button>
            </span>
          </section>
        </div>
      ) : null}
    </div>
  );
}
