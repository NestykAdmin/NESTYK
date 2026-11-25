import React, { useEffect, useMemo, useRef, useState } from "react";
import { Asset } from "expo-asset";
import { useLocale } from "@nestyk/i18n";
import { loadPdfDataUrl, parsePdfMessage, selfOwnerPdfHtml } from "../../lib/self-owner-pdf";

const assetUrl = (source: number | string) => (typeof source === "string" ? source : Asset.fromModule(source).uri);
/** Line widths of the skeleton page: a title, then text (Jom 25 Nov 2026). */
const SKELETON_LINES = ["45%", "30%", "92%", "88%", "95%", "70%", "90%", "84%", "60%"];

/**
 * A self owner contract file on the web (Jom 25 Nov 2026, option B): the shared PDF viewer, continuous mode, in a
 * sandboxed frame fed the file as a data URL; `onReachedEnd` fires once the owner has scrolled to the end. One
 * page-shaped skeleton covers both loads (the file, then the viewer) until the viewer says it is ready.
 */
export function SelfOwnerContractDocument({ source, onReachedEnd, fill = false }: { source: number | string; onReachedEnd?: () => void; /** Fill the space left (the phone layout on the web). */ fill?: boolean }) {
  const { t } = useLocale();
  const so = t.selfOwnerContracts;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const endHandler = useRef(onReachedEnd);
  endHandler.current = onReachedEnd;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setReady(false);
    loadPdfDataUrl(source, assetUrl)
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [source, attempt]);

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = parsePdfMessage(event.data);
      // A viewer error shows the viewer's own retry, so the skeleton steps aside then too.
      if (message?.type === "ready" || message?.type === "error") setReady(true);
      if (message?.type === "end") endHandler.current?.();
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);

  const html = useMemo(() => (dataUrl ? selfOwnerPdfHtml(dataUrl) : null), [dataUrl]);
  return (
    <div className={`soc-pdf${fill ? " is-fill" : ""}`} data-testid="soc-pdf" aria-busy={!ready && !failed}>
      {html ? (
        <iframe
          ref={frame}
          className={ready ? "is-ready" : undefined}
          srcDoc={html}
          title={so.viewDocument}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
        />
      ) : null}
      {failed ? (
        <p className="soc-pdf-state" role="alert">
          {so.documentFailed}{" "}
          <button type="button" className="awu-btn" onClick={() => setAttempt((n) => n + 1)}>
            {t.agent.dashboard.webStates.retry}
          </button>
        </p>
      ) : !ready ? (
        <div className="soc-pdf-skeleton" role="status" aria-label={so.documentLoading} data-testid="soc-pdf-skeleton">
          <div className="soc-pdf-sheet" aria-hidden="true">
            {SKELETON_LINES.map((width, line) => (
              <span key={line} className="awu-skeleton-bar" style={{ width }} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
