chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SPEAK") {
    const { text, voiceName, rate } = msg;

    chrome.tts.stop();
    chrome.tts.speak(text, {
      voiceName: voiceName || undefined,
      rate: typeof rate === "number" ? rate : 1.0
    });

    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "STOP") {
    chrome.tts.stop();
    sendResponse({ ok: true });
    return true;
  }
});
