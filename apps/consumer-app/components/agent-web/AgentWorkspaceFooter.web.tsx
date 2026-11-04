import React, { useEffect, useState } from "react";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { SUPPORT_EMAIL, SUPPORT_LINE_OA, buildBadge, legalHref, lineOaUrl, supportMailto } from "../../lib/legal-footer";
import { WebMenu } from "./ui";
import "./agent-workspace-footer.css";

export interface AgentWorkspaceFooterProps {
  /** Current path, added to the copied build info so a bug report says where it happened. */
  page?: string;
}

/**
 * F1 workspace footer (nestyk-web-footer-plan.md, board W19 in design-drafts/v5): end of the page content, not
 * fixed, same grey as the page. Left: © · privacy · terms · help menu. Right: env + build badge on every env
 * except production (F-Q2); a click copies it for a bug report.
 * Leave it out on full-page forms with a fixed action bar (add room, add lead, edit room) and in dialogs.
 * Wiring into AgentWorkspacePage waits for the C1 shell work to be committed.
 */
export function AgentWorkspaceFooter({ page }: AgentWorkspaceFooterProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.legal.footer;
  const badge = buildBadge(process.env.EXPO_PUBLIC_APP_ENV, process.env.EXPO_PUBLIC_BUILD_SHA, page);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyBuild = () => {
    if (!badge || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(badge.copyText).then(() => setCopied(true), () => undefined);
  };

  return (
    <footer className="awf-footer" aria-label={copy.label} data-testid="shell.footer">
      <div className="awf-links">
        <span className="awf-item">{fillTemplate(copy.copyright, { year: new Date().getFullYear() })}</span>
        {/* Each "· link" stays together so a wrapped line never ends with a lone dot. */}
        <span className="awf-item">
          <span aria-hidden className="awf-dot">·</span>
          <a href={legalHref("privacy")} target="_blank" rel="noopener" data-testid="shell.footer.privacy">
            {copy.privacy}
          </a>
        </span>
        <span className="awf-item">
          <span aria-hidden className="awf-dot">·</span>
          <a href={legalHref("terms")} target="_blank" rel="noopener" data-testid="shell.footer.terms">
            {copy.terms}
          </a>
        </span>
        <span className="awf-item">
          <span aria-hidden className="awf-dot">·</span>
          <WebMenu
            label={copy.help}
            testID="shell.footer.help"
            align="start"
            triggerClassName="awf-help"
            trigger={
              <>
                <span>{copy.help}</span>
                <MobileIcon name="chevron-down" size={12} color={theme.textSecondary} />
              </>
            }
            items={[
              {
                key: "email",
                icon: "envelope",
                label: fillTemplate(copy.helpEmail, { email: SUPPORT_EMAIL }),
                onSelect: () => window.location.assign(supportMailto("NESTYK")),
              },
              {
                key: "line",
                label: fillTemplate(copy.helpLine, { id: SUPPORT_LINE_OA }),
                onSelect: () => window.open(lineOaUrl(), "_blank", "noopener"),
              },
              { key: "guide", label: copy.helpGuide, badge: copy.comingSoon, disabled: true },
            ]}
          />
        </span>
      </div>
      {badge ? (
        <button
          type="button"
          className="awf-build"
          onClick={copyBuild}
          title={copy.buildCopy}
          aria-label={`${copy.buildCopy}: ${badge.label}`}
          data-testid="shell.footer.build"
        >
          {copied ? copy.buildCopied : badge.label}
        </button>
      ) : null}
    </footer>
  );
}
