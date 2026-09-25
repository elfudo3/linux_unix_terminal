/**
 * On-screen key bar shown above the soft keyboard. Phone keyboards bury the
 * characters shell commands need (| - / ~ * > $) behind extra layers, so
 * this row puts them one tap away, together with Tab and history keys.
 *
 * Buttons cancel `pointerdown` so the terminal input keeps focus and the
 * keyboard stays open while tapping. A fixed button at the end hides the
 * keyboard (it only shows while the keyboard is open, via CSS).
 */
import type { TerminalKey, TerminalView } from "@terminal-trainer/ui";

export interface KeyBarKey {
  label: string;
  /** Text to insert at the caret... */
  insert?: string;
  /** ...or a terminal key to trigger. */
  key?: TerminalKey;
  /** Accessible name when the label alone is unclear. */
  aria?: string;
}

export const DEFAULT_KEYS: KeyBarKey[] = [
  { label: "Tab", key: "Tab", aria: "Complete" },
  { label: "↑", key: "ArrowUp", aria: "Previous command" },
  { label: "↓", key: "ArrowDown", aria: "Next command" },
  { label: "|", insert: " | " },
  { label: "-", insert: "-" },
  { label: "/", insert: "/" },
  { label: "~", insert: "~" },
  { label: "*", insert: "*" },
  { label: ".", insert: "." },
  { label: ">", insert: " > " },
  { label: ">>", insert: " >> " },
  { label: "<", insert: " < " },
  { label: "$", insert: "$" },
  { label: "'", insert: "'" },
  { label: '"', insert: '"' },
  { label: "&&", insert: " && " },
  { label: "^C", key: "ctrl+c", aria: "Cancel line" },
  { label: "Clear", key: "ctrl+l", aria: "Clear screen" },
];

const HIDE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="12" rx="2"/><path d="M7 7h.01M11 7h.01M15 7h.01M7 11h10M9 21l3-3 3 3"/></svg>';

export function createKeyBar(
  root: HTMLElement,
  terminal: Pick<TerminalView, "insert" | "sendKey" | "input">,
  keys: KeyBarKey[] = DEFAULT_KEYS,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "keybar-wrap";
  const bar = document.createElement("div");
  bar.className = "keybar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Shell keys");
  for (const key of keys) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "keybar-key";
    button.textContent = key.label;
    if (key.aria) button.setAttribute("aria-label", key.aria);
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      if (key.key) terminal.sendKey(key.key);
      else if (key.insert !== undefined) terminal.insert(key.insert);
    });
    bar.appendChild(button);
  }
  const hide = document.createElement("button");
  hide.type = "button";
  hide.className = "keybar-hide";
  hide.setAttribute("aria-label", "Hide keyboard");
  hide.innerHTML = HIDE_ICON;
  hide.addEventListener("click", () => terminal.input.blur());
  wrap.append(bar, hide);
  root.appendChild(wrap);
  return wrap;
}
