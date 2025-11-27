(function () {
  // State
  let pageZoom = 1.0;
  const minZoom = 0.5,
    maxZoom = 3.0,
    zoomStep = 0.1;
  let highContrast = false;
  let dyslexia = false;
  let colorblind = false;
  let colorblindProfile = "protanopia";
  let largeCursor = false;
  let focusMode = false;
  let modifiedEls = []; // store elements modified via element-resize mode

  function ensureStyles() {
    if (document.getElementById("a11y-plus-styles")) return;
    const style = document.createElement("style");
    style.id = "a11y-plus-styles";
    style.innerHTML = `
    :root { --a11y-zoom: 1; }
    .a11y-high-contrast { background: #000 !important; color: #fff !important; filter: none !important; }
    .a11y-high-contrast img, .a11y-high-contrast svg { opacity: 0.95 !important; }
    .a11y-dyslexia * { font-family: "OpenDyslexic", "Arial", sans-serif !important; letter-spacing: 0.02em !important; line-height: 1.6 !important; }
    .a11y-large-cursor, .a11y-large-cursor * { cursor: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAIElEQVQoz2P8z/CfAQzMDAwMDAwGhgYGBgYGBgYwA0YABxYwO0AAAAAElFTkSuQmCC'), auto !important; }
    .a11y-highlight-links a { outline: 3px solid #FFD54F !important; padding:2px 4px !important; border-radius:4px !important; }
    .a11y-focus-mode * { opacity: 0.12 !important; transition: opacity 120ms linear; }
    .a11y-focus-mode :hover, .a11y-focus-mode :focus { opacity: 1 !important; }
    /* Daltonization UI adjustments (no global filter) */
    .a11y-colorblind { /* base helpers: highlight links/controls, small contrast tweaks */ }
    .a11y-colorblind img, .a11y-colorblind svg { filter: none !important; }
    /* Profile filters (applied via modifier classes) */
    .a11y-colorblind--protanopia { filter: url('#a11y-filter-protanopia') !important; }
    .a11y-colorblind--deuteranopia { filter: url('#a11y-filter-deuteranopia') !important; }
    .a11y-colorblind--tritanopia { filter: url('#a11y-filter-tritanopia') !important; }
    .a11y-colorblind--enhance { filter: saturate(1.18) contrast(1.08) brightness(1.02) !important; }
    .a11y-colorblind a { outline: 3px solid #FFB300 !important; background: rgba(255,179,0,0.06) !important; padding: 2px 4px !important; border-radius: 4px !important; text-decoration: none !important; }
    .a11y-colorblind button, .a11y-colorblind input, .a11y-colorblind select, .a11y-colorblind textarea { box-shadow: inset 0 0 0 3px rgba(33,150,243,0.08) !important; border-radius: 4px !important; }
    .a11y-colorblind [role='button'] { outline-offset: 2px !important; }
    .a11y-element-selected { outline: 3px dashed #2196F3 !important; }
    `;
    document.head.appendChild(style);
  }

  function applyPageZoom() {
    document.documentElement.style.setProperty("--a11y-zoom", pageZoom);
    document.body.style.zoom = pageZoom * 100 + "%";
  }

  ensureStyles();
  applyPageZoom();

  function toggleClass(name, val) {
    if (val) document.documentElement.classList.add(name);
    else document.documentElement.classList.remove(name);
  }

  function enableElementResize(dir) {
    // One-time click handler
    const handler = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      let el = ev.target;
      // prefer block-level ancestor for better effect
      const blk =
        el.closest("p,div,section,article,main,header,footer,li,td,th") || el;
      el = blk;
      // get current font size
      const cs = window.getComputedStyle(el).fontSize;
      const current = parseFloat(cs) || 16;
      const factor = dir === "up" ? 1.2 : 1 / 1.2;
      const newSize = Math.min(72, Math.max(8, Math.round(current * factor)));
      el.style.fontSize = newSize + "px";
      el.classList.add("a11y-element-selected");
      // store for resetAll
      el.setAttribute("data-a11y-modified", "true");
      modifiedEls.push(el);
      // flash then remove selection after 1.6s
      setTimeout(() => el.classList.remove("a11y-element-selected"), 1600);
      // remove listener after one click
      document.removeEventListener("click", handler, true);
      // show small toast
      showToast("Tamanho de fonte ajustado");
    };
    // add capture listener so it intercepts clicks before page handlers
    document.addEventListener("click", handler, true);
    showToast("Clique no elemento que quer ajustar (uma vez).");
  }

  function showToast(msg) {
    const id = "a11y-toast";
    let t = document.getElementById(id);
    if (!t) {
      t = document.createElement("div");
      t.id = id;
      t.style.position = "fixed";
      t.style.right = "12px";
      t.style.bottom = "12px";
      t.style.zIndex = "2147483647";
      t.style.background = "rgba(0,0,0,0.75)";
      t.style.color = "#fff";
      t.style.padding = "8px 12px";
      t.style.borderRadius = "6px";
      t.style.fontSize = "13px";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._hideTimeout);
    t._hideTimeout = setTimeout(() => {
      t.style.opacity = "0";
    }, 2200);
  }

  function resetAll() {
    // reset page zoom
    pageZoom = 1.0;
    applyPageZoom();
    // remove classes
    highContrast = dyslexia = largeCursor = focusMode = colorblind = false;
    toggleClass("a11y-high-contrast", false);
    toggleClass("a11y-dyslexia", false);
    toggleClass("a11y-large-cursor", false);
    toggleClass("a11y-highlight-links", false);
    toggleClass("a11y-focus-mode", false);
    toggleClass("a11y-colorblind", false);
    toggleClass("a11y-colorblind--protanopia", false);
    toggleClass("a11y-colorblind--deuteranopia", false);
    toggleClass("a11y-colorblind--tritanopia", false);
    toggleClass("a11y-colorblind--enhance", false);
    // remove element inline styles we added
    modifiedEls.forEach((el) => {
      try {
        el.style.fontSize = "";
        el.removeAttribute("data-a11y-modified");
      } catch (e) {}
    });
    modifiedEls = [];
    // remove focus marker
    const m = document.getElementById("a11y-focus-marker");
    if (m) m.remove();
    showToast("Configurações de acessibilidade resetadas");
  }

  function ensureColorblindFilters() {
    if (document.getElementById("a11y-colorblind-filters")) return;
    const div = document.createElement("div");
    div.id = "a11y-colorblind-filters";
    div.style.position = "absolute";
    div.style.width = "0";
    div.style.height = "0";
    div.style.overflow = "hidden";
    div.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute">
        <defs>
          <!-- Protanopia approximation -->
          <filter id="a11y-filter-protanopia">
            <feColorMatrix type="matrix" values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0" />
          </filter>
          <!-- Deuteranopia approximation -->
          <filter id="a11y-filter-deuteranopia">
            <feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0" />
          </filter>
          <!-- Tritanopia approximation -->
          <filter id="a11y-filter-tritanopia">
            <feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0" />
          </filter>
        </defs>
      </svg>
    `;
    (document.body && document.body.appendChild(div)) ||
      document.head.appendChild(div);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const cmd = msg.command;
    if (cmd === "increasePageZoom") {
      pageZoom = Math.min(maxZoom, +(pageZoom + zoomStep).toFixed(2));
      applyPageZoom();
      showToast("Zoom da página: " + Math.round(pageZoom * 100) + "%");
    } else if (cmd === "decreasePageZoom") {
      pageZoom = Math.max(minZoom, +(pageZoom - zoomStep).toFixed(2));
      applyPageZoom();
      showToast("Zoom da página: " + Math.round(pageZoom * 100) + "%");
    } else if (cmd === "resetPageZoom") {
      pageZoom = 1.0;
      applyPageZoom();
      showToast("Zoom reiniciado");
    } else if (cmd === "enableElementResize") {
      const dir = msg.dir || "up";
      enableElementResize(dir);
    } else if (cmd === "toggleHighContrast") {
      highContrast = !highContrast;
      toggleClass("a11y-high-contrast", highContrast);
      showToast("Alto contraste " + (highContrast ? "ativado" : "desativado"));
    } else if (cmd === "toggleColorblind") {
      colorblind = !colorblind;
      ensureColorblindFilters();
      // toggle using last chosen profile
      toggleClass("a11y-colorblind", colorblind);
      toggleClass("a11y-colorblind--" + colorblindProfile, colorblind);
      showToast("Modo daltônico " + (colorblind ? "ativado" : "desativado"));
    } else if (cmd === "setColorblind") {
      const enabled = !!msg.enabled;
      const profile = msg.profile || "protanopia";
      colorblind = enabled;
      colorblindProfile = profile;
      if (enabled) ensureColorblindFilters();
      // clear all profile modifiers
      toggleClass("a11y-colorblind--protanopia", false);
      toggleClass("a11y-colorblind--deuteranopia", false);
      toggleClass("a11y-colorblind--tritanopia", false);
      toggleClass("a11y-colorblind--enhance", false);
      toggleClass("a11y-colorblind", enabled);
      if (enabled) toggleClass("a11y-colorblind--" + profile, true);
      showToast(
        "Modo daltônico " +
          (enabled ? "ativado (" + profile + ")" : "desativado")
      );
    } else if (cmd === "toggleDyslexia") {
      dyslexia = !dyslexia;
      toggleClass("a11y-dyslexia", dyslexia);
      if (dyslexia && !document.getElementById("open-dyslexic")) {
        const lf = document.createElement("link");
        lf.id = "open-dyslexic";
        lf.rel = "stylesheet";
        lf.href =
          "https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/open-dyslexic.css";
        document.head.appendChild(lf);
      }
      showToast("Modo dislexia " + (dyslexia ? "ativado" : "desativado"));
    } else if (cmd === "toggleLargeCursor") {
      largeCursor = !largeCursor;
      toggleClass("a11y-large-cursor", largeCursor);
      showToast("Cursor ampliado " + (largeCursor ? "ativado" : "desativado"));
    } else if (cmd === "toggleHighlightLinks") {
      const on = document.documentElement.classList.toggle(
        "a11y-highlight-links"
      );
      showToast("Destacar links " + (on ? "ativado" : "desativado"));
    } else if (cmd === "toggleFocusMode") {
      focusMode = !focusMode;
      toggleClass("a11y-focus-mode", focusMode);
      if (focusMode) {
        const marker = document.createElement("div");
        marker.id = "a11y-focus-marker";
        marker.style.position = "fixed";
        marker.style.left = "0";
        marker.style.right = "0";
        marker.style.top = "40%";
        marker.style.height = "2.2em";
        marker.style.background = "rgba(255,255,0,0.08)";
        marker.style.pointerEvents = "none";
        marker.style.zIndex = "2147483647";
        document.body.appendChild(marker);
      } else {
        const m = document.getElementById("a11y-focus-marker");
        if (m) m.remove();
      }
      showToast("Foco de leitura " + (focusMode ? "ativado" : "desativado"));
    } else if (cmd === "resetAll") {
      resetAll();
    }
  });
})();
