# focus hints

An opiniated, Vimium-inspired userscript that makes keyboard-based navigation effortless on the webpage. Keyboard shortcuts (hints) are overlayed onto interactive elements, allowing you to traverse links, inputs, and fields without touching your mouse.

## installation

1. If you don't have a userscript manager yet, [install one](https://en.wikipedia.org/wiki/Userscript_manager).
2. Open the userscript source ([focus-hints.user.js](https://raw.githubusercontent.com/nsqx/focus-hints/refs/heads/main/src/focus-hints.user.js)). Your userscript manager should automatically detect the script.
3. Press **Install** or **Save**.

## usage

This userscript will overlay keyboard hints next to interactive elements, labelled by a key or some sequence of keys. The key sequences can be typed to bring focus to the corresponding element. When the hints are visible, any key pressed which may form a valid key sequence will be intercepted. As such, the page will not receive the relevant keyboard event. To send keyboard events to the page (e.g., to type into a field), you must exit hints mode.

To toggle focus hints, press `Ctrl` + <code>&#96;</code> (backtick). When in hints mode, you can also press `Esc` to close hints when there is no active key sequence.

### keyboard commands

| key                         | action                                              |
| :-------------------------- | :-------------------------------------------------- |
| `Ctrl` + <code>&#96;</code> | toggle hints mode                                   |
| `Esc`                       | exit hints mode _or_ clear the current key sequence |
| <code>&#96;</code>          | manually refresh hints                              |
| `K`                         | scroll up (half page)                               |
| `J`                         | scroll down (half page)                             |
| `H`                         | scroll left (half page)                             |
| `L`                         | scroll right (half page)                            |
| `9`                         | jump to top                                         |
| `8`                         | jump to bottom                                      |
| `7`                         | jump to far left                                    |
| `0`                         | jump to far right                                   |

## configuration

The script will order hints alphabetically by default. To enable ergonomic ordering for QWERTY keyboard layouts, you can select **Use ergonomic hint labelling** in your userscript manager menu. The page will be refreshed to reflect the updated preferences.

## notes

This userscript will run on **all sites** by default. If you wish to exclude any pages due to script conflicts or privacy concerns\*, follow these steps:

1. Click the **Edit** button under **focus hints** in your userscript manager.
2. Switch to the **Settings** tab.
3. Under `@exclude-match` rules, uncheck **Keep original** and add your relevant page URL globs.
   - For example, adding `*://example.com/*` and `*://*.example.com/*` will restrict this userscript from running on all pages and subdomains under the `example.com` domain.

\*Although this userscript runs completely locally, it's good practice to disable extensions and userscripts on pages with sensitive data, such as banking sites or government portals.

---

<details>
  <summary>TODO</summary>

- [ ] implement targetable scrolling
- [ ] put hints (blue) on scroll containers
</details>
