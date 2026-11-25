import React from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import type { SelfOwnerContract } from "../../lib/self-owner-contracts";
import { contractSigningView, type ContractSigningView } from "./contract-detail-rows";

/** Who signs a contract and when; the detail and the sign page show it (Jom 25 Nov 2026). */
export function SelfOwnerSignerList({ view }: { view: ContractSigningView }) {
  return (
    <ul className="soc-signers">
      {view.rows.map((row) => (
        <li key={row.signer} className={row.signed ? "is-signed" : undefined} data-testid={`soc-signer-${row.signer}`}>
          <span className="soc-signer-who">
            <strong>{row.label}</strong>
            {row.name ? <small>{row.name}</small> : null}
          </span>
          <span className="soc-signer-status">
            {row.signed ? <MobileIcon name="check" size={14} color="currentColor" /> : null}
            {row.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "การลงนาม" at the end of the self owner contract detail on the web (Jom 25 Nov 2026, demo): who signs and when; while
 * the contract awaits the owner, "ลงนามสัญญา" opens the separate sign page (option B).
 */
export function SelfOwnerContractSigning({ contract, day, onStart }: { contract: SelfOwnerContract; day: (ymd: string) => string; onStart: () => void }) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  const view = contractSigningView(contract, so, day);
  return (
    <section className="soc-signing" aria-label={so.signing}>
      <h3 className="soc-signing-title">{so.signing}</h3>
      <SelfOwnerSignerList view={view} />
      {view.waiting ? <p className="soc-note">{so.waitingOthers}</p> : null}
      {view.canSign ? (
        <button type="button" className="awu-btn awu-btn-primary soc-sign" data-testid="soc-sign" onClick={onStart}>
          <MobileIcon name="pencil" size={16} color="currentColor" />
          {so.signAction}
        </button>
      ) : null}
    </section>
  );
}
