function getSelectedText() {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : "";
}

function getPageText() {
  // Try to avoid nav/footer noise a bit
  const main =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.body;

  let text = main.innerText || "";
  // Light cleanup
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GET_TEXT") {
    const mode = msg.mode || "selection";
    const selected = getSelectedText();

    const text =
      mode === "selection"
        ? (selected || getPageText())
        : getPageText();

    sendResponse({ ok: true, text });
  }
});
