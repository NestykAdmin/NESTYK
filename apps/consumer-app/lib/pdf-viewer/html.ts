import { pdfViewerScript } from "./bundle";

export function isPdfDocumentUrl(url: string) {
  return url.split(/[?#]/)[0].toLowerCase().endsWith(".pdf");
}

/** `continuous`: every page one under another (Jom 25 Nov 2026, self owner sign page); one page at a time otherwise. */
export function pdfViewerHtml(url: string, options: { continuous?: boolean } = {}) {
  const config = JSON.stringify(options.continuous ? { url, continuous: true } : { url }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;background:#eef2f5;color:#243b45;font:14px system-ui,sans-serif}header{height:52px;display:flex;align-items:center;justify-content:center;gap:10px;background:white;border-bottom:1px solid #dce3e8;position:fixed;inset:0 0 auto;z-index:2}button{height:36px;min-width:40px;border:1px solid #d4dfe3;border-radius:9px;background:white;color:#243b45;font-size:17px}button:disabled{opacity:.35}#pages{position:absolute;inset:52px 0 0;overflow:auto;padding:12px;overscroll-behavior:contain}canvas{display:block;margin:auto;background:white;box-shadow:0 2px 12px #23374218}#status{position:fixed;top:62px;left:50%;transform:translateX(-50%);z-index:3;background:white;padding:12px 18px;border-radius:12px;text-align:center;max-width:95%;width:max-content}#retry{position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:3;font-size:14px;padding:0 18px}#counter{min-width:58px;text-align:center}.pdf-page{position:relative;margin:0 auto 12px;background:white;box-shadow:0 2px 12px #23374218}.pdf-page canvas{position:absolute;inset:0;width:100%;height:100%;box-shadow:none}
  </style></head><body><header aria-label="เครื่องมือเอกสาร"><button id="previous" aria-label="หน้าก่อนหน้า">‹</button><span id="counter" aria-live="polite">- / -</span><button id="next" aria-label="หน้าถัดไป">›</button><button id="smaller" aria-label="ย่อ">−</button><button id="larger" aria-label="ขยาย">+</button></header><div id="status" role="status">กำลังโหลดเอกสาร…</div><button id="retry" hidden>ลองอีกครั้ง</button><main id="pages"><canvas aria-label="หน้าเอกสาร PDF"></canvas></main><script>window.__PDF_CONFIG__=${config};</script><script>${pdfViewerScript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
