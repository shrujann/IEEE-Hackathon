
function getSelectedText() {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : "";
}

function getPageText() {
  const main =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.body;

  let text = main?.innerText || "";
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/* ---------- PAGE TYPOGRAPHY (NEW) ---------- */
const STYLE_ID = "study-helper-page-typography";

function applyPageTypography(settings) {
  const fontFamily = settings?.fontFamily || "";
  const fontSize = Number(settings?.fontSize || 16); // px
  const lineHeight = Number(settings?.lineHeight || 1.4);

  let styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.documentElement.appendChild(styleEl);
  }

  styleEl.textContent = `
    html { font-size: ${fontSize}px !important; }

    body {
      line-height: ${lineHeight} !important;
      ${fontFamily ? `font-family: ${fontFamily} !important;` : ""}
    }

    p, li, div, span, article, main, section {
      line-height: ${lineHeight} !important;
    }

    code, pre, kbd, samp {
      line-height: normal !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    }
  `;
}

function resetPageTypography() {
  const styleEl = document.getElementById(STYLE_ID);
  if (styleEl) styleEl.remove();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GET_TEXT") {
    const mode = msg.mode || "selection";
    const selected = getSelectedText();
    const text = mode === "selection" ? (selected || getPageText()) : getPageText();
    sendResponse({ ok: true, text });
    return true;
  }

  if (msg?.type === "APPLY_PAGE_TYPO") {
    applyPageTypography(msg.settings || {});
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "RESET_PAGE_TYPO") {
    resetPageTypography();
    sendResponse({ ok: true });
    return true;
  }
});
