function injectIfNeeded(tabId) {
  // Always inject content.js so page has helpers (idempotent)
  return chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function withActiveTab(callback) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) return;
  const tab = tabs[0];
  try {
    await injectIfNeeded(tab.id);
  } catch (e) {
    console.error("Erro ao injetar content.js", e);
  }
  callback(tab.id);
}

function sendCommandToTab(tabId, cmd, payload = {}) {
  chrome.tabs.sendMessage(tabId, { command: cmd, ...payload });
}

document.getElementById("increasePage").onclick = () => {
  withActiveTab((tabId) => sendCommandToTab(tabId, "increasePageZoom"));
};
document.getElementById("decreasePage").onclick = () => {
  withActiveTab((tabId) => sendCommandToTab(tabId, "decreasePageZoom"));
};
document.getElementById("resetFont").onclick = () => {
  withActiveTab((tabId) => sendCommandToTab(tabId, "resetPageZoom"));
};

// Colorblind / daltonic mode: initialize UI and persist selection (guarded)
(function () {
  try {
    const colorBtn = document.getElementById("colorblindMode");
    const profileSelect = document.getElementById("colorblindProfile");

    function updateColorUI(state) {
      const enabled = !!state.enabled;
      const profile = state.profile || "protanopia";
      if (colorBtn) {
        if (enabled) colorBtn.classList.add("active");
        else colorBtn.classList.remove("active");
        colorBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
      }
      if (profileSelect) profileSelect.value = profile;
    }

    // On popup open, read saved state and apply (also inform the page)
    document.addEventListener("DOMContentLoaded", () => {
      chrome.storage.sync.get(
        { colorblind: { enabled: false, profile: "protanopia" } },
        (res) => {
          const state = res.colorblind || {
            enabled: false,
            profile: "protanopia",
          };
          updateColorUI(state);
          if (state.enabled) {
            withActiveTab((tabId) =>
              sendCommandToTab(tabId, "setColorblind", {
                enabled: true,
                profile: state.profile,
              })
            );
          }
        }
      );
    });

    // Toggle enabled/disabled
    if (colorBtn) {
      colorBtn.addEventListener("click", () => {
        chrome.storage.sync.get(
          { colorblind: { enabled: false, profile: "protanopia" } },
          (res) => {
            const cur = res.colorblind || {
              enabled: false,
              profile: "protanopia",
            };
            const newState = {
              enabled: !cur.enabled,
              profile: (profileSelect && profileSelect.value) || cur.profile,
            };
            chrome.storage.sync.set({ colorblind: newState }, () => {
              updateColorUI(newState);
              withActiveTab((tabId) =>
                sendCommandToTab(tabId, "setColorblind", {
                  enabled: newState.enabled,
                  profile: newState.profile,
                })
              );
            });
          }
        );
      });
    }

    // Change profile while enabled
    if (profileSelect)
      profileSelect.addEventListener("change", () => {
        const profile = profileSelect.value;
        chrome.storage.sync.get(
          { colorblind: { enabled: false, profile: "protanopia" } },
          (res) => {
            const cur = res.colorblind || {
              enabled: false,
              profile: "protanopia",
            };
            const newState = { enabled: cur.enabled, profile };
            chrome.storage.sync.set({ colorblind: newState }, () => {
              updateColorUI(newState);
              if (newState.enabled)
                withActiveTab((tabId) =>
                  sendCommandToTab(tabId, "setColorblind", {
                    enabled: true,
                    profile,
                  })
                );
            });
          }
        );
      });
  } catch (err) {
    console.error("Colorblind UI init failed", err);
  }
})();

// Element-based adjustments: enter "select mode" for next click on page
document.getElementById("increaseElement").onclick = () => {
  withActiveTab((tabId) =>
    sendCommandToTab(tabId, "enableElementResize", { dir: "up" })
  );
};
document.getElementById("decreaseElement").onclick = () => {
  withActiveTab((tabId) =>
    sendCommandToTab(tabId, "enableElementResize", { dir: "down" })
  );
};
document.getElementById("resetAll").onclick = () => {
  withActiveTab((tabId) => sendCommandToTab(tabId, "resetAll"));
};

document.getElementById("highContrast").onclick = () =>
  withActiveTab((tabId) => sendCommandToTab(tabId, "toggleHighContrast"));
document.getElementById("dyslexiaMode").onclick = () =>
  withActiveTab((tabId) => sendCommandToTab(tabId, "toggleDyslexia"));
document.getElementById("largeCursor").onclick = () =>
  withActiveTab((tabId) => sendCommandToTab(tabId, "toggleLargeCursor"));
document.getElementById("highlightLinks").onclick = () =>
  withActiveTab((tabId) => sendCommandToTab(tabId, "toggleHighlightLinks"));

document.getElementById("focusMode").onclick = () =>
  withActiveTab((tabId) => sendCommandToTab(tabId, "toggleFocusMode"));

// Read selected text: ask content script for selection; if empty, read article/main excerpt
document.getElementById("readText").onclick = async () => {
  const rate = parseFloat(document.getElementById("ttsRate").value) || 1.0;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) return;
  const tabId = tabs[0].id;
  try {
    await injectIfNeeded(tabId);
  } catch (e) {
    console.error("inject fail", e);
  }
  // Execute a function in page to obtain selection or main text
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const sel = window.getSelection().toString().trim();
        if (sel.length > 0) return { source: "selection", text: sel };
        const article =
          document.querySelector("article") ||
          document.querySelector("main") ||
          document.body;
        let text = (article.innerText || "").trim();
        text = text.slice(0, 10000); // safety limit
        return { source: "page", text };
      },
    });
    const res = results && results[0] && results[0].result;
    if (res && res.text && res.text.length > 0) {
      chrome.tts.speak(res.text, { rate, enqueue: true });
    } else {
      chrome.tts.speak("Nenhum texto encontrado para leitura.", {
        rate,
        enqueue: true,
      });
    }
  } catch (err) {
    console.error("Erro ao obter texto:", err);
    chrome.tts.speak("Erro ao obter o texto da página.", {
      rate,
      enqueue: true,
    });
  }
};

// tts rate display
const rateInput = document.getElementById("ttsRate");
const rateVal = document.getElementById("rateVal");
rateInput.oninput = () => {
  rateVal.textContent = rateInput.value;
};

// Regra de 3: calcular A -> B = C -> X  (X = B * C / A)
const calcBtn = document.getElementById("calcRule");
const clearBtn = document.getElementById("clearRule");
const ruleResult = document.getElementById("ruleResult");
const inA = document.getElementById("ruleA");
const inB = document.getElementById("ruleB");
const inC = document.getElementById("ruleC");

function formatNumber(v) {
  if (!isFinite(v)) return "—";
  // trim unnecessary decimals
  return Number.isInteger(v)
    ? v.toString()
    : v.toFixed(6).replace(/(?:\.0+|0+)$/, "");
}

function calculateRule() {
  const a = parseFloat(inA.value);
  const b = parseFloat(inB.value);
  const c = parseFloat(inC.value);
  if (!isFinite(a) || !isFinite(b) || !isFinite(c)) {
    ruleResult.textContent = "Preencha os 3 valores válidos.";
    return;
  }
  if (a === 0) {
    ruleResult.textContent = "A não pode ser zero.";
    return;
  }
  const x = (b * c) / a;
  ruleResult.textContent = "Resultado: " + formatNumber(x);
}

function clearRule() {
  inA.value = "";
  inB.value = "";
  inC.value = "";
  ruleResult.textContent = "Resultado: —";
}

if (calcBtn) calcBtn.addEventListener("click", calculateRule);
if (clearBtn) clearBtn.addEventListener("click", clearRule);

// allow Enter to calculate when focus is on any input
[inA, inB, inC].forEach((inp) => {
  if (!inp) return;
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      calculateRule();
    }
  });
});
