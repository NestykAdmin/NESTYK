import React, { useRef, useState } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import { interpolate } from "@nestyk/feature-listing";
import type { SelfOwnerContract } from "../../lib/self-owner-contracts";
import { ContractSignaturePad, type ContractSignaturePadHandle } from "../ContractSignaturePad";
import { contractDetailView, contractSigningView } from "./contract-detail-rows";
import { SelfOwnerSignerList } from "./SelfOwnerContractSigning.web";
import { SelfOwnerContractDocument } from "./SelfOwnerContractDocument.web";
import { selfOwnerDocumentOf } from "./demo-documents";
import { FadeIn } from "./FadeIn.web";
import { useStepSlide } from "./useStepSlide";

export type SelfOwnerSignStep = "review" | "sign" | "done";

/**
 * The separate sign page on the web (Jom 25 Nov 2026, option B, demo): step 1 the contract file, read to its last page
 * before the owner can tick that they read it (the summary when there is no file), step 2 the existing signature pad,
 * then what happened.
 */
export function SelfOwnerContractSignFlow({
  contract,
  all,
  fmt,
  today,
  onSign,
  onDone,
  initialStep = "review",
  initialAccepted = false,
  initialReachedEnd = false,
}: {
  /** The contract as the page has it now (signed once `onSign` went through). */
  contract: SelfOwnerContract;
  all: SelfOwnerContract[];
  fmt: { money: (amount: number) => string; day: (ymd: string) => string };
  today: string;
  onSign: (contractId: string) => void;
  /** Back to the contract detail. */
  onDone: () => void;
  initialStep?: SelfOwnerSignStep;
  initialAccepted?: boolean;
  /** The owner has turned to the file's last page (tests). */
  initialReachedEnd?: boolean;
}) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  const [step, setStep] = useState<SelfOwnerSignStep>(initialStep);
  const [accepted, setAccepted] = useState(initialAccepted);
  const [error, setError] = useState("");
  const file = selfOwnerDocumentOf(contract.id);
  // With a file, the tick waits until the owner turned to its last page (Jom 25 Nov 2026).
  const [reachedEnd, setReachedEnd] = useState(initialReachedEnd || file === undefined);
  const pad = useRef<ContractSignaturePadHandle>(null);
  const signing = contractSigningView(contract, so, fmt.day);
  const view = contractDetailView(contract, all, so, fmt, today);
  // Signed already (or never signable): only the outcome.
  const shown: SelfOwnerSignStep = signing.canSign ? step : "done";
  const stepLabel = (n: number, name: string) => interpolate(so.signStep, { n, total: 2, name });
  // Each step fades in (Jom 25 Nov 2026).
  const slide = useStepSlide(["review", "sign", "done"].indexOf(shown));

  return (
    <FadeIn key={shown} active={slide !== null}>
      <div className="soc-sign-flow" data-testid="soc-sign-flow">
        {shown === "review" ? (
          <>
            <p className="soc-step">{stepLabel(1, so.signStepReview)}</p>
            {file !== undefined ? (
              <>
                <div className="soc-doc-head">
                  <span className="soc-kind">{so.kind[contract.kind]}</span>
                  <strong>{view.period}</strong>
                  <small>{view.room}</small>
                </div>
                <p className="soc-pad-demo" role="note">
                  <MobileIcon name="info" size={14} color="currentColor" />
                  {so.sampleDocument}
                </p>
                <SelfOwnerContractDocument source={file} onReachedEnd={() => setReachedEnd(true)} />
                <p className={`soc-read${reachedEnd ? " is-done" : ""}`} aria-live="polite">
                  {reachedEnd ? <MobileIcon name="check" size={14} color="currentColor" /> : null}
                  {reachedEnd ? so.readDone : so.readToEnd}
                </p>
              </>
            ) : (
            <div className="soc-doc">
              <p className="soc-doc-nofile">
                <MobileIcon name="file-text" size={16} color="currentColor" />
                {so.noFileSummary}
              </p>
              <div className="soc-doc-head">
                <span className="soc-kind">{so.kind[contract.kind]}</span>
                <strong>{view.period}</strong>
                <small>{view.room}</small>
              </div>
              <dl className="soc-extra">
                <div>
                  <dt>{view.party.role}</dt>
                  <dd>{view.party.name}</dd>
                </div>
                {view.tiles.map((tile) => (
                  <div key={tile.label}>
                    <dt>{tile.label}</dt>
                    <dd>{tile.value}</dd>
                  </div>
                ))}
                {view.extra.map(([term, value]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="soc-signing-title">{so.signing}</h3>
              <SelfOwnerSignerList view={signing} />
            </div>
            )}
            <label className={`soc-accept${reachedEnd ? "" : " is-off"}`}>
              <input
                type="checkbox"
                data-testid="soc-sign-accept"
                checked={accepted}
                disabled={!reachedEnd}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>{so.acceptTerms}</span>
            </label>
            <div className="soc-pad-actions">
              <button type="button" className="awu-btn" data-testid="soc-sign-cancel" onClick={onDone}>
                {so.cancelSigning}
              </button>
              <button type="button" className="awu-btn awu-btn-primary" data-testid="soc-sign-next" disabled={!accepted || !reachedEnd} onClick={() => setStep("sign")}>
                {so.nextStep}
              </button>
            </div>
          </>
        ) : shown === "sign" ? (
          <div className="soc-pad">
            <p className="soc-step">{stepLabel(2, so.signStepSign)}</p>
            <p className="soc-pad-hint">{so.signHint}</p>
            <p className="soc-pad-demo" role="note">
              <MobileIcon name="info" size={14} color="currentColor" />
              {so.demoSignNote}
            </p>
            {error ? (
              <p className="soc-pad-error" role="alert">
                {error}
              </p>
            ) : null}
            <ContractSignaturePad
              ref={pad}
              onOK={() => {
                setError("");
                setStep("done");
                onSign(contract.id);
              }}
              onEmpty={() => setError(so.signEmpty)}
            />
            <div className="soc-pad-actions">
              <button
                type="button"
                className="awu-btn"
                data-testid="soc-sign-previous"
                onClick={() => {
                  setError("");
                  setStep("review");
                }}
              >
                {so.previousStep}
              </button>
              <button type="button" className="awu-btn" data-testid="soc-sign-clear" onClick={() => pad.current?.clearSignature()}>
                {so.clearSignature}
              </button>
              <button type="button" className="awu-btn awu-btn-primary" data-testid="soc-sign-confirm" onClick={() => pad.current?.readSignature()}>
                {so.confirmSignature}
              </button>
            </div>
          </div>
        ) : (
          <div className="soc-sign-done" role="status">
            <span className="soc-sign-done-mark" aria-hidden="true">
              <MobileIcon name="check" size={22} color="currentColor" />
            </span>
            <strong>{so.signedTitle}</strong>
            <p>{signing.waiting ? so.waitingOthers : so.signedAll}</p>
            <SelfOwnerSignerList view={signing} />
            <button type="button" className="awu-btn awu-btn-primary" data-testid="soc-sign-done" onClick={onDone}>
              {so.backToContract}
            </button>
          </div>
        )}
      </div>
    </FadeIn>
  );
}
