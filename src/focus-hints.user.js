// ==UserScript==
// @name          focus-hints
// @namespace     http://github.com/nsqx
// @version       1.0.0
// @description   A small, Vimium-inspired userscript to enable keyboard based navigation.
// @author        nsqx
// @match         *://*/*
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @run-at        document-idle
// @downloadURL   https://raw.githubusercontent.com/nsqx/focus-hints/main/src/focus-hints.user.js
// ==/UserScript==

(function () {
  'use strict';

  let auto_show = GM_getValue('nsqx/focus-hints:show-by-default', true);

  GM_registerMenuCommand(`${auto_show ? 'Hide' : 'Show'} focus hints by default`, () => {
    auto_show = !auto_show;
    GM_setValue('nsqx/focus-hints:show-by-default', auto_show);
    console.log(`focus-hints are now ${auto_show ? 'visible' : 'hidden'} by default.`);
  });

  focusHints(auto_show);
})();

//

/**
 * @description A small, Vimium-inspired userscript to enable keyboard based navigation.
 * @author nsqx
 * @version 1.0.0
 * @param {boolean} default_visible --- enable focus hints on initialization
 */
function focusHints(default_visible = true) {
  // check if an instance is already present
  if (typeof window.__focusHintsSnowflake__ === 'string') return;

  // generate unique identifier
  const snowflake = (function (l) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let u = '';
    for (let i = 0; i < l; i++) u += chars.charAt(Math.floor(Math.random() * chars.length));
    return u;
  })(14);
  window.__focusHintsSnowflake__ = snowflake;

  // setup host element
  const overlay_id = `focus-hints-${snowflake}`;
  const host = document.documentElement.appendChild(document.createElement(overlay_id));
  host.style.all = 'initial!important';
  host.style.display = 'block!important';
  host.style.position = 'absolute!important';
  host.style.top = '0!important';
  host.style.left = '0!important';
  host.style.width = '0!important';
  host.style.height = '0!important';
  host.style.pointerEvents = 'none!important';
  const shadow_root = host.attachShadow({ mode: 'closed' });

  // setup shadow styles
  const css_text = `
.${overlay_id} {
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  overflow: visible;
  margin: 0;
  padding: 0;
  border-width: 0;
  background-color: transparent;
}
.${overlay_id} .label,
.${overlay_id} .indicator {
  background-color: yellow;
  color: black;
  font-family: 'SF Mono', ui-monospace, 
                Menlo, Monaco, 
                'Cascadia Mono', 'Segoe UI Mono', 
                'Roboto Mono', 
                'Oxygen Mono', 
                'Ubuntu Mono', 
                'Source Code Pro',
                'Fira Mono', 
                'Droid Sans Mono', 
                'Consolas', 'Courier New', monospace;
  position: absolute;
  opacity: 90%;
  font-weight: 600;
  user-select: none;
  line-height: 1;
}
.${overlay_id} .label {
  font-size: 12px;
  padding: 2px;
}
.${overlay_id} .indicator {
  padding: 8px;
  font-size: 16px;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
}
  `;
  if (Array.isArray(shadow_root.adoptedStyleSheets)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css_text);
    shadow_root.adoptedStyleSheets = [sheet];
  } else {
    const style = document.createElement('style');
    style.textContent = css_text;
    shadow_root.appendChild(style);
  }

  // create hints container
  const overlay = shadow_root.appendChild(document.createElement('div'));
  overlay.className = overlay_id;

  // visibility toggling & shim for popover
  if ('popover' in overlay || Object.prototype.hasOwnProperty.call(HTMLElement, 'popover')) {
    overlay.popover = 'manual';
  } else {
    overlay.showPopover = i => {
      overlay.style.opacity = '1';
      overlay.dataset.popoverState = 'visible';
    };
    overlay.hidePopover = i => {
      overlay.style.opacity = '0';
      overlay.dataset.popoverState = 'hidden';
    };
    overlay.togglePopover = i => {
      if (overlay.dataset.popoverState == 'hidden') {
        overlay.showPopover();
      } else {
        overlay.hidePopover();
      }
    };
    host.style.zIndex = '2147483647';
  }
  overlay.hidePopover();

  // ---
  // fn: get tabbable elements
  function get_tabbable() {
    let tabbable = [];
    for (const el of document.querySelectorAll(
      'input,select,textarea,button,object,audio,video,details,[contenteditable]'
    )) {
      if (!el.hasAttribute('disabled') && el.checkVisibility({ visibilityProperty: true }))
        tabbable.push(el);
    }
    for (const el of document.querySelectorAll('[tabindex]')) {
      if (el.checkVisibility({ visibilityProperty: true })) tabbable.push(el);
    }
    for (const el of document.querySelectorAll('area[href],a[href]')) {
      if (el.checkVisibility({ visibilityProperty: true })) tabbable.push(el);
    }
    return tabbable;
  }

  // fn: make a label with text
  function make_label(text) {
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = text;
    label.ariaHidden = 'true';
    return label;
  }

  // fn: generate label text (base implementation provided by Gemini)
  const code_particles = 'ABCDEFGIMNOPQRSTUVWXYZ;'; // IJKL reserved for page movement
  const code_is_case_sensitive = false;
  function* generate_codes(code_particles, ln) {
    const base = code_particles.length;
    const s = function* (length) {
      const total = base ** length;
      const skip = total % 31 === 0 ? 37 : 31;
      let current = Math.floor(Math.random() * total);
      for (let i = 0; i < total; i++) {
        current = (current + skip) % total;
        let val = current;
        let str = '';
        for (let j = 0; j < length; j++) {
          str = code_particles[val % base] + str;
          val = (val / base) | 0;
        }
        yield str;
      }
    };
    yield* s(ln);
    console.error(
      `too many tabbable elements (more than ${Math.pow(code_particles.length, ln)} present)!?!?`
    );
  }

  // fn: (measure) get label coordinates
  function position_label(label) {
    label.hintLeft = label.hintTarget.getBoundingClientRect().x;
    label.hintTop = label.hintTarget.getBoundingClientRect().y;
  }
  // fn: (manipulate) compose label coordinates
  function position_label_render(label, width = 24, height = 18) {
    const x = label.hintLeft;
    const y = label.hintTop;
    if (label.hintLeft - width > 0) {
      label.style.left = `${x - width}px`;
    } else {
      label.style.left = `${x}px`;
    }
    label.style.top = `${y}px`;
  }

  // ---
  // setup
  let code_length;
  let tabbable;
  let labels;
  let indicator;
  let codes;

  function setup() {
    // get tabbable elements
    tabbable = get_tabbable();
    if (tabbable.length <= code_particles.length) {
      code_length = 1;
    } else if (tabbable.length <= Math.pow(code_particles.length, 2)) {
      code_length = 2;
    } else if (tabbable.length <= Math.pow(code_particles.length, 3)) {
      code_length = 3;
    } else {
      code_length = 4;
    }
    codes = generate_codes(code_particles, code_length);
    // make a label for each tabbable element & position
    labels = {};
    for (const el of tabbable) {
      let code = codes.next().value;
      let label = make_label(code);
      label.hintTarget = el;
      position_label(label);
      labels[code] = label;
    }
    for (const i in labels) {
      overlay.appendChild(labels[i]);
      position_label_render(labels[i]);
    }
    // keybind indicator
    indicator = overlay.appendChild(document.createElement('div'));
    indicator.className = 'indicator';
    indicator.style.opacity = '0';
  }
  // fn: clear labels
  function clear() {
    code_length = 0;
    tabbable = [];
    labels = {};
    indicator = '';
    codes = null;
    overlay.innerHTML = '';
  }

  let frame_id = null;
  const frame = i => {
    for (const i in labels) {
      position_label(labels[i]);
    }
    for (const i in labels) {
      position_label_render(labels[i]);
    }
    frame_id = requestAnimationFrame(frame);
  };

  let keybind = '';
  let indicator_timeout = null;
  let is_hints_active = default_visible;
  if (default_visible) {
    setup();
    overlay.showPopover();
    frame_id = requestAnimationFrame(frame);
  }
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      keybind = '';
      is_hints_active = !is_hints_active;
      if (is_hints_active) {
        setup();
        overlay.showPopover();
        frame_id = requestAnimationFrame(frame);
      } else {
        overlay.hidePopover();
        clear();
        cancelAnimationFrame(frame_id);
      }
      return;
    }
    if (!is_hints_active) {
      return;
    } else {
      if (e.key === '`') {
        e.preventDefault();
        e.stopImmediatePropagation();
        clear();
        setup();
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        let key = e.key;
        let key_upper = key.toUpperCase();
        switch (key_upper) {
          case 'K':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ top: -window.innerHeight / 2, behavior: 'smooth' });
            return;
          case 'J':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ top: window.innerHeight / 2, behavior: 'smooth' });
            return;
          case 'H':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ left: -window.innerWidth / 2, behavior: 'smooth' });
            return;
          case 'L':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ left: window.innerWidth / 2, behavior: 'smooth' });
            return;
          case '9':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          case '8':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            return;
          case '7':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ left: 0, behavior: 'smooth' });
            return;
          case '0':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ left: document.scrollingElement.scrollWidth, behavior: 'smooth' });
            return;
        }
        if (!code_is_case_sensitive) key = key_upper;
        if (code_particles.indexOf(key) !== -1) {
          e.preventDefault();
          e.stopImmediatePropagation();
          keybind += key;
          clearTimeout(indicator_timeout);
          indicator.style.opacity = '1';
          indicator.textContent = keybind;
          if (keybind.length === code_length) {
            const ref = labels[keybind];
            if (typeof ref !== 'undefined') {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
              ref.hintTarget.focus({ focusVisible: true });
              keybind = '';
              indicator_timeout = setTimeout(i => {
                indicator.style.opacity = '0';
              }, 1000);
            } else {
              keybind = keybind.slice(1);
              indicator.textContent = keybind;
            }
          }
        }
      }
    }
  });
}
