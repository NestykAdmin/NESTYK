// Continuous mode of the in-app PDF viewer (Jom 25 Nov 2026, self owner sign page): every page one under another,
// scrolled like a long document, instead of one page at a time. Opt in with `continuous: true` in the viewer config;
// the one-page mode (the default) is unchanged.
//
// Only the pages near the view are drawn; pages far away give their canvas back, so a 10-page contract zoomed in does
// not hold every page in memory. Messages out (native WebView and the web iframe's parent): "pdf-ready",
// "pdf-error", "pdf-page:N/M" when the page in view changes, "pdf-end" once the reader reaches the end.
const NEAR = 1.5; // draw pages within 1.5 screens of the view
const FAR = 3; // give back canvases more than 3 screens away
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2.5;

function notify(message) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
  else if (window.parent !== window) window.parent.postMessage(message, "*");
}

export function startContinuous({ getDocument, config, view }) {
  const { scroller, status, retry, previous, next, smaller, larger, counter, template } = view;
  template?.remove();
  let documentPdf;
  let loadingTask;
  let sizes = []; // each page at scale 1
  let slots = []; // { box, canvas, busy }
  let zoom = 1;
  let generation = 0;
  let current = 0;
  let ended = false;
  let frame = 0;

  const total = () => (documentPdf ? documentPdf.numPages : 0);
  function buttons() {
    previous.disabled = !documentPdf || current <= 1;
    next.disabled = !documentPdf || current >= total();
    smaller.disabled = !documentPdf || zoom <= ZOOM_MIN;
    larger.disabled = !documentPdf || zoom >= ZOOM_MAX;
  }
  function failed() {
    status.textContent = "ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง";
    status.hidden = false;
    retry.hidden = false;
    notify("pdf-error");
  }
  function release(slot) {
    if (!slot.canvas) return;
    slot.canvas.width = 0;
    slot.canvas.height = 0;
    slot.canvas.remove();
    slot.canvas = null;
  }
  async function draw(index) {
    const slot = slots[index];
    if (!slot || slot.canvas || slot.busy) return;
    slot.busy = true;
    const mine = generation;
    try {
      const page = await documentPdf.getPage(index + 1);
      const width = slot.box.clientWidth;
      const viewport = page.getViewport({ scale: width / sizes[index].width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.setAttribute("aria-label", `หน้า ${index + 1}`);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport, transform: [ratio, 0, 0, ratio, 0, 0] }).promise;
      if (mine !== generation) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      slot.box.appendChild(canvas);
      slot.canvas = canvas;
    } catch {
      // A page that fails to draw stays blank; the others still show.
    } finally {
      slot.busy = false;
    }
  }
  function update() {
    frame = 0;
    if (!documentPdf) return;
    const top = scroller.scrollTop;
    const height = scroller.clientHeight;
    let inView = 1;
    slots.forEach((slot, index) => {
      const start = slot.box.offsetTop;
      const end = start + slot.box.offsetHeight;
      if (start <= top + height / 3) inView = index + 1;
      if (end >= top - height * NEAR && start <= top + height * (1 + NEAR)) void draw(index);
      else if (end < top - height * FAR || start > top + height * (1 + FAR)) release(slot);
    });
    if (inView !== current) {
      current = inView;
      counter.textContent = `${current} / ${total()}`;
      notify(`pdf-page:${current}/${total()}`);
    }
    if (!ended && top + height >= scroller.scrollHeight - 4) {
      ended = true;
      notify("pdf-end");
    }
    buttons();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function layout() {
    generation += 1;
    const width = Math.max(240, scroller.clientWidth - 24) * zoom;
    slots.forEach((slot, index) => {
      release(slot);
      slot.box.style.width = `${width}px`;
      slot.box.style.height = `${(width * sizes[index].height) / sizes[index].width}px`;
    });
    update();
  }
  function goTo(page) {
    const slot = slots[page - 1];
    if (slot) scroller.scrollTo({ top: slot.box.offsetTop - 12, behavior: "smooth" });
  }
  function rezoom(next) {
    const share = scroller.scrollHeight ? scroller.scrollTop / scroller.scrollHeight : 0;
    zoom = next;
    layout();
    scroller.scrollTop = share * scroller.scrollHeight;
    update();
  }
  async function load() {
    retry.hidden = true;
    status.hidden = false;
    status.textContent = "กำลังโหลดเอกสาร…";
    try {
      if (loadingTask) await loadingTask.destroy();
      loadingTask = getDocument({ url: config.url, isEvalSupported: false });
      documentPdf = await loadingTask.promise;
      const pages = await Promise.all(Array.from({ length: documentPdf.numPages }, (_, i) => documentPdf.getPage(i + 1)));
      sizes = pages.map((page) => page.getViewport({ scale: 1 }));
      scroller.replaceChildren();
      slots = sizes.map((_, index) => {
        const box = document.createElement("div");
        box.className = "pdf-page";
        box.setAttribute("aria-label", `หน้า ${index + 1} จาก ${sizes.length}`);
        scroller.appendChild(box);
        return { box, canvas: null, busy: false };
      });
      current = 0;
      ended = false;
      layout();
      status.hidden = true;
      notify("pdf-ready");
    } catch {
      failed();
    }
  }

  previous.onclick = () => goTo(current - 1);
  next.onclick = () => goTo(current + 1);
  smaller.onclick = () => rezoom(Math.max(ZOOM_MIN, zoom - 0.25));
  larger.onclick = () => rezoom(Math.min(ZOOM_MAX, zoom + 0.25));
  retry.onclick = () => void load();
  scroller.addEventListener("scroll", schedule, { passive: true });
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => documentPdf && layout(), 150);
  });
  buttons();
  void load();
}
