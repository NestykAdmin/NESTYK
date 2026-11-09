import React, { useCallback, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import { leadFormReadiness, type LeadFormDraft, type LeadFormTabKey, type ReadinessKey } from "../../lib/lead-form-readiness";
import { StatusBadge } from "./ui";
import type { AgentLeadFormPageProps } from "./AgentLeadFormPage.types";
import "./agent-lead-form.css";

const EMPTY: LeadFormDraft = { firstName: "", phoneOk: false, budgetMax: "", pinCount: 0, tab: "profile" };

/**
 * Agent web add/edit lead (W17 option A, Mos 6 Nov 2026): the app's `CreateLeadForm` in a 720px column and a
 * "room matching readiness" panel (320px, sticky). Under 1280px the panel sits above the form and folds.
 * The panel only reads what the form reports (`onDraftChange`) and can open a tab (`requestedTab`);
 * saving, validation and the API stay in the form.
 */
export function AgentLeadFormPage({ mode, children }: AgentLeadFormPageProps) {
  const { t } = useLocale();
  const copy = t.agent.leads.webForm;
  const [draft, setDraft] = useState<LeadFormDraft>(EMPTY);
  const [request, setRequest] = useState<{ tab: LeadFormTabKey; nonce: number } | undefined>(undefined);
  const [open, setOpen] = useState(false);
  // Stable: the form lists it in an effect's dependencies.
  const onDraftChange = useCallback((next: LeadFormDraft) => setDraft(next), []);
  const readiness = leadFormReadiness(draft);
  const label: Record<ReadinessKey, string> = {
    firstName: copy.itemFirstName,
    phone: copy.itemPhone,
    budgetMax: copy.itemBudgetMax,
    pins: copy.itemPins,
  };
  const note = !readiness.canSave ? copy.noteNeedContact : readiness.matchReady ? copy.noteReady : copy.noteSaveFirst;
  const groups: Array<{ title: string; keys: ReadinessKey[] }> = [
    { title: copy.requiredForSave, keys: ["firstName", "phone"] },
    { title: copy.usedForMatch, keys: ["budgetMax", "pins"] },
  ];

  return (
    <div className="awlf-page" data-testid="leadForm.page">
      <p className="awlf-hint">{mode === "create" ? copy.createHint : copy.editHint}</p>
      <div className="awlf-layout">
        <aside className="awlf-panel" aria-labelledby="awlf-panel-title" data-testid="leadForm.readiness">
          <div className="awlf-panel-head">
            <span className={`awlf-panel-icon${readiness.matchReady ? " is-ready" : ""}`} aria-hidden="true">
              <MobileIcon name={readiness.matchReady ? "check" : "info"} size={18} color="currentColor" />
            </span>
            <span className="awlf-panel-titles">
              <h2 id="awlf-panel-title">{copy.readinessTitle}</h2>
              <span className="awlf-muted" aria-live="polite">
                {readiness.matchReady ? copy.matchReady : copy.matchMissing}
              </span>
            </span>
            <button
              type="button"
              className="awlf-toggle"
              aria-expanded={open}
              aria-controls="awlf-panel-body"
              onClick={() => setOpen((value) => !value)}
              data-testid="leadForm.readiness.toggle"
            >
              {open ? copy.hidePanel : copy.showPanel}
            </button>
          </div>
          <div id="awlf-panel-body" className={`awlf-panel-body${open ? "" : " is-folded"}`}>
            {groups.map((group) => (
              <div key={group.title} className="awlf-group">
                <p className="awlf-group-title">{group.title}</p>
                {group.keys.map((key) => {
                  const item = readiness.items.find((row) => row.key === key)!;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`awlf-item${item.done ? " is-done" : ""}${draft.tab === item.tab ? " is-current" : ""}`}
                      aria-label={`${label[key]}: ${item.done ? copy.itemDone : copy.itemMissing}`}
                      onClick={() => setRequest((last) => ({ tab: item.tab, nonce: (last?.nonce ?? 0) + 1 }))}
                      data-done={item.done ? "true" : "false"}
                      data-testid={`leadForm.readiness.${key}`}
                    >
                      <span className="awlf-mark" aria-hidden="true">
                        {item.done ? <MobileIcon name="check" size={14} color="currentColor" /> : null}
                      </span>
                      {label[key]}
                    </button>
                  );
                })}
              </div>
            ))}
            <p className="awlf-note">{note}</p>
            {mode === "create" ? (
              <div className="awlf-status">
                <span className="awlf-muted">{copy.statusOnSave}</span>
                <StatusBadge label={copy.newTag} intent="attn" />
              </div>
            ) : null}
          </div>
        </aside>
        <div className="awlf-form">{children({ onDraftChange, requestedTab: request })}</div>
      </div>
    </div>
  );
}
