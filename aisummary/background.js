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

  // open a sidebar-like popup window on the right side
  if (msg?.type === 'OPEN_SIDEBAR') {
    // read saved width/height
    chrome.storage.local.get(['sideWidth', 'sideHeight', 'sideWindowId'], (res) => {
      const desiredWidth = Number(res.sideWidth) || 420;
      const desiredHeight = Number(res.sideHeight) || null; // we'll compute if null

      // If we have an existing window id, try to focus it
      if (res.sideWindowId) {
        chrome.windows.get(res.sideWindowId, (w) => {
          if (chrome.runtime.lastError || !w) {
            // create anew
            createSidebarWindow(desiredWidth, desiredHeight);
          } else {
            chrome.windows.update(res.sideWindowId, { focused: true }, () => {});
          }
        });
      } else {
        createSidebarWindow(desiredWidth, desiredHeight);
      }
    });

    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === 'RESIZE_SIDEBAR') {
    const targetWidth = Number(msg.width) || 420;
    chrome.storage.local.get(['sideWindowId'], (res) => {
      const winId = res.sideWindowId;
      if (!winId) {
        sendResponse({ ok: false, error: 'no-window' });
        return;
      }
      // reposition to keep it docked to right of last focused window
      chrome.windows.getLastFocused((focused) => {
        if (!focused) {
          chrome.windows.update(winId, { width: targetWidth }, () => sendResponse({ ok: true }));
          return;
        }
        const left = (focused.left || 0) + (focused.width || 0) - targetWidth;
        chrome.windows.update(winId, { width: targetWidth, left }, () => {
          chrome.storage.local.set({ sideWidth: targetWidth });
          sendResponse({ ok: true });
        });
      });
    });
    return true;
  }
});

function createSidebarWindow(width, height) {
  chrome.windows.getLastFocused((focused) => {
    const screenLeft = (focused && typeof focused.left === 'number') ? focused.left : 0;
    const screenTop = (focused && typeof focused.top === 'number') ? focused.top : 0;
    const screenWidth = (focused && typeof focused.width === 'number') ? focused.width : 1200;
    const screenHeight = (focused && typeof focused.height === 'number') ? focused.height : 800;

    const w = Number(width) || Math.min(480, Math.floor(screenWidth * 0.4));
    const h = Number(height) || screenHeight;
    const left = screenLeft + screenWidth - w;
    const top = screenTop;

    chrome.windows.create({ url: chrome.runtime.getURL('sidechat.html'), type: 'popup', left, top, width: w, height: h }, (win) => {
      if (win && win.id) {
        chrome.storage.local.set({ sideWindowId: win.id, sideWidth: w, sideHeight: h });
      }
    });
  });
}
