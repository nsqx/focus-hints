// ==UserScript==
// @name          focus-hints
// @namespace     http://github.com/nsqx
// @version       1.0.0
// @description   An opiniated, Vimium-inspired userscript to make keyboard-based navigation effortless.
// @author        nsqx
// @match         *://*/*
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @run-at        document-start
// @downloadURL   https://raw.githubusercontent.com/nsqx/focus-hints/main/src/focus-hints.user.js
// ==/UserScript==

(function () {
  'use strict';

  let auto_show = GM_getValue('nsqx/focus-hints:show-by-default', true);

  GM_registerMenuCommand(`${auto_show ? 'Hide' : 'Show'} focus hints by default`, () => {
    auto_show = !auto_show;
    GM_setValue('nsqx/focus-hints:show-by-default', auto_show);
    location.reload();
  });

  focusHints({ default_visible: auto_show });
})();

//

/**
 * @description An opiniated, Vimium-inspired userscript to make keyboard-based navigation effortless.
 * @author nsqx
 * @version 1.0.0
 * @param {boolean} default_visible --- enable focus hints on initialization
 */
function focusHints({ default_visible = true, alphabetical = true } = {}) {
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

  // register keydown handler
  window.addEventListener('keydown', keydown_handler, true);

  // fn: initial paint & setup
  function trigger_paint() {
    if (!is_hints_active || !document.body) return;
    clear();
    if (default_visible) {
      setup();
      overlay.showPopover();
      add_listeners();
    }
  }
  window.addEventListener('DOMContentLoaded', trigger_paint);
  window.addEventListener('load', trigger_paint);

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
  let shadow_root;
  try {
    shadow_root = host.attachShadow({ mode: 'closed' });
  } catch (e) {
    shadow_root = host;
  }

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
  if (
    shadow_root.adoptedStyleSheets &&
    typeof CSSStyleSheet !== 'undefined' &&
    CSSStyleSheet.prototype.replaceSync
  ) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css_text);
    shadow_root.adoptedStyleSheets = [sheet];
  } else {
    // adopted-style-sheets shim
    const style = document.createElement('style');
    style.textContent = css_text;
    shadow_root.appendChild(style);
  }

  // create hints container
  const overlay = shadow_root.appendChild(document.createElement('div'));
  overlay.className = overlay_id;

  // visibility toggling & popover shim
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
  function get_tabbable(use_shadow = true) {
    const tabbable = [];

    const is_tabbable = el => {
      if (el.disabled) return false;
      const tag = el.tagName.toLowerCase();
      const target =
        ['input', 'select', 'textarea', 'button', 'object', 'summary', 'audio', 'video'].indexOf(
          tag
        ) !== -1 ||
        (tag === 'a' && el.hasAttribute('href')) ||
        (tag === 'area' && el.hasAttribute('href')) ||
        el.hasAttribute('contenteditable') ||
        el.hasAttribute('tabindex');
      if (!target) return false;

      if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ visibilityProperty: true });
      } else {
        // check-visibility shim
        const style = window.getComputedStyle(el);
        return (
          (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        );
      }
    };

    function walk(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
          if (use_shadow && node.shadowRoot) return NodeFilter.FILTER_ACCEPT;
          return is_tabbable(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });

      let current = walker.nextNode();
      while (current) {
        if (use_shadow && current.shadowRoot) {
          if (is_tabbable(current)) tabbable.push(current);
          // walk shadow root
          walk(current.shadowRoot);
        } else {
          tabbable.push(current);
        }
        current = walker.nextNode();
      }
    }

    if (!document.body) return [];
    walk(document.body);
    return tabbable;
  }

  // fn: make a label with text
  function make_label(text, additional = '') {
    const label = document.createElement('div');
    label.className = additional ? 'label ' + additional : 'label';
    label.textContent = text;
    label.ariaHidden = 'true';
    return label;
  }

  // fn: generate label text (base implementation provided by Gemini)
  let code_particles;
  let code_particles_safe;
  const reserved = 'HJKL';
  if (alphabetical) {
    code_particles_safe = 'ABCDEFGIMNOPQRSTUVWXYZ'
      .split('')
      .filter(c => !reserved.includes(c))
      .join(''); // HJKL reserved for page movement
    code_particles = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ;,';
  } else {
    // two-handed ergonomic layout for QWERTY layouts
    code_particles_safe = 'SDFGZXCVAQWER'
      .split('')
      .filter(c => !reserved.includes(c))
      .join('');
    code_particles = 'HJKL;NM,UIOPYBT';
  }
  const code_is_case_sensitive = false;
  function* generate_codes(code_particles, ln, random = false) {
    const base = code_particles.length;
    const safe_base = code_particles_safe.length;
    const total = ln === 1 ? safe_base : safe_base * base ** (ln - 1);

    const skip = total % 31 === 0 ? 37 : 31;
    let current = Math.floor(Math.random() * total);
    for (let i = 0; i < total; i++) {
      let val = random ? (current = (current + skip) % total) : i;
      let str = '';
      for (let j = 0; j < ln; j++) {
        if (j === ln - 1) {
          str = code_particles_safe[val % safe_base] + str;
          val = (val / safe_base) | 0;
        } else {
          str = code_particles[val % base] + str;
          val = (val / base) | 0;
        }
      }
      yield str;
    }
    console.error(
      `exhausted all unique labels (more than ${Math.pow(code_particles.length, ln)} present)!`
    );
  }

  // fn: (measure) get label coordinates
  function position_label(label) {
    label.hintLeft = label.hintTarget.getClientRects()[0].x;
    label.hintTop = label.hintTarget.getClientRects()[0].y;
  }
  // fn: (manipulate) compose label coordinates
  function position_label_render(label, width = code_length * 11, height = 18) {
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
    if (tabbable.length <= code_particles_safe.length) {
      code_length = 1;
    } else if (tabbable.length <= code_particles_safe.length * code_particles.length) {
      code_length = 2;
    } else if (tabbable.length <= code_particles_safe.length * Math.pow(code_particles.length, 2)) {
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
    overlay.textContent = '';
  }

  // update label positions
  let frame_id = null;
  const frame = i => {
    if (frame_id) cancelAnimationFrame(frame_id);
    frame_id = requestAnimationFrame(() => {
      // (measure)
      for (const i in labels) {
        position_label(labels[i]);
      }
      // (manipulate)
      for (const i in labels) {
        position_label_render(labels[i]);
      }
      frame_id = null;
    });
  };

  // fn: observe DOM mutations
  let mutation_timeout = null;
  const observer = new MutationObserver(mutations => {
    if (!is_hints_active) return;

    if (mutations.some(m => m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
      if (mutation_timeout) clearTimeout(mutation_timeout);
      mutation_timeout = setTimeout(() => {
        clear();
        setup();
      }, 200);
    }
  });

  function add_listeners() {
    window.addEventListener('scroll', frame, { capture: true, passive: true });
    window.addEventListener('resize', frame, { passive: true });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  function clear_listeners() {
    window.removeEventListener('scroll', frame, true);
    window.removeEventListener('resize', frame);
    if (frame_id) cancelAnimationFrame(frame_id);
    observer.disconnect();
  }

  let keybind = '';
  let indicator_timeout = null;
  let is_hints_active = default_visible;

  function clear_keybind() {
    keybind = '';
    indicator.style.opacity = '0';
    for (const code in labels) {
      labels[code].style.opacity = '';
    }
  }
  function keybind_not_found() {
    indicator.textContent = keybind + '?';
    keybind = '';
    clearTimeout(indicator_timeout);
    indicator_timeout = setTimeout(i => {
      clear_keybind();
    }, 1000);
  }

  function keydown_handler(e) {
    if ((e.ctrlKey && e.key === '`') || (is_hints_active && e.key === 'Escape' && keybind === '')) {
      // 1
      e.preventDefault();
      e.stopImmediatePropagation();
      keybind = '';
      is_hints_active = !is_hints_active;
      if (is_hints_active) {
        clear();
        setup();
        overlay.showPopover();
        add_listeners();
      } else {
        overlay.hidePopover();
        clear();
        clear_listeners();
      }
      return;
    }
    if (!is_hints_active) {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      // 2
      clearTimeout(mutation_timeout);
      mutation_timeout = setTimeout(() => {
        clear();
        setup();
      }, 200);
    } else if (e.key === '`') {
      e.preventDefault();
      e.stopImmediatePropagation();
      clear();
      setup();
    } else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      // 3
      let key = e.key;
      let key_upper = key.toUpperCase();
      if (keybind === '')
        switch (key_upper) {
          case 'K':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ top: -window.innerHeight / 2, behavior: 'instant' });
            return;
          case 'J':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ top: window.innerHeight / 2, behavior: 'instant' });
            return;
          case 'H':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ left: -window.innerWidth / 2, behavior: 'instant' });
            return;
          case 'L':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollBy({ left: window.innerWidth / 2, behavior: 'instant' });
            return;
          case '9':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ top: 0, behavior: 'instant' });
            return;
          case '8':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
            return;
          case '7':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ left: 0, behavior: 'instant' });
            return;
          case '0':
            e.preventDefault();
            e.stopImmediatePropagation();
            window.scrollTo({ left: document.scrollingElement.scrollWidth, behavior: 'instant' });
            return;
        }
      if (key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        keybind = '';
        clearTimeout(indicator_timeout);
        clear_keybind();
        return;
      }
      if (!code_is_case_sensitive) key = key_upper;
      if (code_particles.indexOf(key) !== -1 || code_particles_safe.indexOf(key) !== -1) {
        // 4
        e.preventDefault();
        e.stopImmediatePropagation();
        keybind += key;
        indicator.style.opacity = '1';
        indicator.textContent = keybind;

        let exists = false;
        for (const code in labels) {
          if (!code.startsWith(keybind)) {
            labels[code].style.opacity = '0.2';
          } else {
            labels[code].style.opacity = '';
            exists = true;
          }
        }
        if (!exists) {
          keybind_not_found();
          return;
        }

        clearTimeout(indicator_timeout);
        indicator_timeout = setTimeout(i => {
          clear_keybind();
        }, 3000);

        if (keybind.length < code_length) {
          return;
        } else if (keybind.length > code_length) {
          clear_keybind();
          return;
        }

        const ref = labels[keybind];
        if (typeof ref !== 'undefined') {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
          ref.hintTarget.focus({ focusVisible: true });
          keybind = '';
          clearTimeout(indicator_timeout);
          indicator_timeout = setTimeout(i => {
            clear_keybind();
          }, 1000);
        } else {
          keybind_not_found();
        }
      }
    }
  }
}
