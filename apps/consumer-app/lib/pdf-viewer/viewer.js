import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { startContinuous } from "./continuous.js";
// An in-process worker keeps the viewer self-contained in native WebViews.
globalThis.pdfjsWorker = { WorkerMessageHandler };
const config = window.__PDF_CONFIG__;
const canvas = document.querySelector("canvas");
const status = document.getElementById("status");
const retry = document.getElementById("retry");
const previous = document.getElementById("previous");
const next = document.getElementById("next");
const smaller = document.getElementById("smaller");
const larger = document.getElementById("larger");
const counter = document.getElementById("counter");
let documentPdf,
  loadingTask,
  pageNumber = 1,
  zoom = 1,
  rendering = false;
let renderAgain = false;
function buttons() {
  previous.disabled = rendering || !documentPdf || pageNumber <= 1;
  next.disabled =
    rendering || !documentPdf || pageNumber >= documentPdf.numPages;
  smaller.disabled = rendering || !documentPdf || zoom <= 0.75;
  larger.disabled = rendering || !documentPdf || zoom >= 2.5;
}
function failed() {
  status.textContent = "ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง";
  status.hidden = false;
  retry.hidden = false;
  window.ReactNativeWebView?.postMessage("pdf-error");
}
async function render() {
  if (!documentPdf) return;
  if (rendering) {
    renderAgain = true;
    return;
  }
  rendering = true;
  buttons();
  status.textContent = "กำลังโหลดเอกสาร…";
  status.hidden = false;
  try {
    const page = await documentPdf.getPage(pageNumber);
    const natural = page.getViewport({ scale: 1 });
    const width = Math.max(
      240,
      document.getElementById("pages").clientWidth - 24,
    );
    const viewport = page.getViewport({
      scale: (width / natural.width) * zoom,
    });
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      2,
      4096 / Math.max(viewport.width, viewport.height),
    );
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
      transform: [ratio, 0, 0, ratio, 0, 0],
    }).promise;
    counter.textContent = `${pageNumber} / ${documentPdf.numPages}`;
    status.hidden = true;
    retry.hidden = true;
    window.ReactNativeWebView?.postMessage("pdf-ready");
  } catch {
    failed();
  } finally {
    rendering = false;
    buttons();
    if (renderAgain) {
      renderAgain = false;
      void render();
    }
  }
}
async function load() {
  retry.hidden = true;
  status.hidden = false;
  status.textContent = "กำลังโหลดเอกสาร…";
  try {
    if (loadingTask) await loadingTask.destroy();
    loadingTask = getDocument({ url: config.url, isEvalSupported: false });
    documentPdf = await loadingTask.promise;
    pageNumber = 1;
    await render();
  } catch {
    failed();
  }
}
previous.onclick = () => {
  pageNumber--;
  void render();
};
next.onclick = () => {
  pageNumber++;
  void render();
};
smaller.onclick = () => {
  zoom = Math.max(0.75, zoom - 0.25);
  void render();
};
larger.onclick = () => {
  zoom = Math.min(2.5, zoom + 0.25);
  void render();
};
retry.onclick = () => void load();
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => void render(), 150);
});
// `continuous: true` (Jom 25 Nov 2026): every page one under another; otherwise one page at a time as before.
if (config.continuous) {
  startContinuous({
    getDocument,
    config,
    view: { scroller: document.getElementById("pages"), status, retry, previous, next, smaller, larger, counter, template: canvas },
  });
} else {
  buttons();
  void load();
}
