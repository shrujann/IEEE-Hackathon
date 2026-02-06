// ===== ELEMENT REFERENCES (REFACTORED) =====
const output = document.getElementById("output");
const modeEl = document.getElementById("mode");
const voiceEl = document.getElementById("voice");
const rateEl = document.getElementById("rate");
const rateVal = document.getElementById("rateVal");
const styleEl = document.getElementById("summaryStyle");
const fontFamilyEl = document.getElementById("fontFamily");
const fontSizeEl = document.getElementById("fontSize");
const fontSizeValEl = document.getElementById("fontSizeVal");
const lineHeightEl = document.getElementById("lineHeight");
const lineHeightValEl = document.getElementById("lineHeightVal");

// NO PREVIEW OR STATUS ELEMENTS!

// ===== HELPER FUNCTIONS =====
function setOutput(text) {
  output.value = text;
}

rateEl.addEventListener("input", () => {
  rateVal.textContent = Number(rateEl.value).toFixed(1);
});

// ===== TAB HELPERS =====
async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// ===== TEXT EXTRACTION =====
async function requestText(mode) {
  const tabId = await getActiveTabId();
  if (!tabId) throw new Error("No active tab found.");
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "GET_TEXT", mode });
    if (!resp?.ok) throw new Error("Could not extract text.");
    return resp.text || "";
  } catch (e) {
    throw new Error("Could not reach page content. Refresh the page and try again (not on chrome:// pages).");
  }
}

// ===== APPLY TYPOGRAPHY TO WEBPAGE =====
async function applyPageTypographyToTab(settings) {
  const tabId = await getActiveTabId();
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "APPLY_PAGE_TYPO", settings });
  } catch {
    // ignore on restricted pages
  }
}

// ===== LOCAL SUMMARIZER (FALLBACK) =====
function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function scoreSentence(sentence) {
  const lengthScore = Math.min(sentence.length / 120, 1);
  const keywordBonus = /(important|key|because|therefore|however|result|impact|effect)/i.test(sentence) ? 0.3 : 0;
  return lengthScore + keywordBonus;
}

function summarizeLocal(text, style) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "No meaningful text found.";
  const ranked = sentences
    .map(s => ({ s, score: scoreSentence(s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, style === "study" ? 6 : 5)
    .map(o => o.s);
  if (style === "bullets") return ranked.map(s => "• " + s).join("\n");
  if (style === "study") return ranked.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return ranked.join(" ");
}

// ===== AI SUMMARY (BACKEND ON LOCALHOST) =====
async function summarizeWithAI(text, style) {
  const res = await fetch("http://localhost:3000/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style })
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "AI summary failed");
  }
  const data = await res.json();
  return data.summary || "No summary returned.";
}

// ===== TYPOGRAPHY SETTINGS (REFACTORED - NO PREVIEW!) =====
function applyTypographySettings(settings) {
  const fontFamily = settings.fontFamily || fontFamilyEl.value;
  const fontSize = Number(settings.fontSize || fontSizeEl.value);
  const lineHeight = Number(settings.lineHeight || lineHeightEl.value);
  const fontWeight = settings.fontWeight || "400";
  const fontStyle = settings.fontStyle || "normal";
  
  // Apply ONLY to output textarea
  output.style.fontFamily = fontFamily;
  output.style.fontSize = `${fontSize}px`;
  output.style.lineHeight = String(lineHeight);
  output.style.fontWeight = fontWeight;
  output.style.fontStyle = fontStyle;
  
  // Update UI value displays
  fontFamilyEl.value = fontFamily;
  fontSizeEl.value = String(fontSize);
  lineHeightEl.value = String(lineHeight);
  fontSizeValEl.textContent = String(fontSize);
  lineHeightValEl.textContent = Number(lineHeight).toFixed(1);
}

function saveTypographySettings() {
  const settings = {
    fontFamily: fontFamilyEl.value,
    fontSize: Number(fontSizeEl.value),
    lineHeight: Number(lineHeightEl.value),
    fontWeight: "400",
    fontStyle: "normal"
  };
  chrome.storage.local.set({ typography: settings });
  // KEY: Apply to webpage
  applyPageTypographyToTab(settings);
}

function hookTypographyUI() {
  const onChange = () => {
    applyTypographySettings({});
    saveTypographySettings();
  };
  
  fontFamilyEl.addEventListener("change", onChange);
  fontSizeEl.addEventListener("input", () => {
    fontSizeValEl.textContent = String(fontSizeEl.value);
    onChange();
  });
  lineHeightEl.addEventListener("input", () => {
    lineHeightValEl.textContent = Number(lineHeightEl.value).toFixed(1);
    onChange();
  });
}

function loadTypographySettings() {
  chrome.storage.local.get(["typography"], (res) => {
    const settings = res.typography || {};
    applyTypographySettings(settings);
    // Also apply to webpage
    applyPageTypographyToTab({
      fontFamily: settings.fontFamily || fontFamilyEl.value,
      fontSize: Number(settings.fontSize || fontSizeEl.value),
      lineHeight: Number(settings.lineHeight || lineHeightEl.value),
      fontWeight: "400",
      fontStyle: "normal"
    });
  });
}

// ===== BUTTON ACTIONS =====
document.getElementById("btnTranscript").addEventListener("click", async () => {
  try {
    const text = await requestText(modeEl.value);
    setOutput(text);
  } catch (err) {
    setOutput(String(err.message || err));
  }
});

document.getElementById("btnSummary").addEventListener("click", async () => {
  try {
    const text = await requestText(modeEl.value);
    if (!text.trim()) {
      setOutput("No text found to summarize.");
      return;
    }
    try {
      const ai = await summarizeWithAI(text, styleEl.value);
      setOutput(ai);
    } catch (aiErr) {
      const local = summarizeLocal(text, styleEl.value);
      setOutput(local + "\n\n[AI failed: " + String(aiErr.message || aiErr) + "]");
    }
  } catch (err) {
    setOutput(String(err.message || err));
  }
});

document.getElementById("btnSpeak").addEventListener("click", () => {
  const text = output.value.trim();
  if (!text) {
    setOutput("Nothing to read yet. Click Transcript or Summary first.");
    return;
  }
  chrome.runtime.sendMessage({
    type: "SPEAK",
    text,
    voiceName: voiceEl.value,
    rate: Number(rateEl.value)
  });
});

document.getElementById("btnStop").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP" });
});

document.getElementById("btnCopy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.value);
    setTimeout(() => {}, 800);
  } catch {
    output.select();
    document.execCommand("copy");
  }
});

// ===== VOICES =====
function loadVoices() {
  chrome.tts.getVoices((voices) => {
    voiceEl.innerHTML = "";
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "Default";
    voiceEl.appendChild(def);
    voices.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.voiceName;
      opt.textContent = `${v.voiceName}${v.lang ? ` (${v.lang})` : ""}`;
      voiceEl.appendChild(opt);
    });
  });
}

// ===== INITIALIZATION =====
loadVoices();
hookTypographyUI();
loadTypographySettings();
