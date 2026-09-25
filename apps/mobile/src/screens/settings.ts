/**
 * Settings as a bottom sheet: terminal font size, reset progress (with an
 * inline confirmation instead of a native dialog), and app info.
 */
import type { FontSize, Preferences } from "../preferences";

export interface SettingsSheetOptions {
  prefs: Preferences;
  onFontSize: (size: FontSize) => void;
  onResetProgress: () => void;
  version: string;
}

export interface SettingsSheet {
  element: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createSettingsSheet(root: HTMLElement, opts: SettingsSheetOptions): SettingsSheet {
  const element = document.createElement("div");
  element.className = "sheet-host";
  element.innerHTML = `
    <div class="sheet-backdrop" hidden></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden>
      <div class="sheet-handle" aria-hidden="true"></div>
      <h2 id="settings-title">Settings</h2>

      <h3>Terminal text size</h3>
      <div class="segmented" role="group" aria-label="Terminal text size">
        <button type="button" data-size="small">Small</button>
        <button type="button" data-size="medium">Medium</button>
        <button type="button" data-size="large">Large</button>
      </div>

      <h3>Progress</h3>
      <button type="button" class="btn btn-danger reset-button">Reset progress…</button>
      <div class="reset-confirm-row" hidden>
        <p>This forgets every completed task. Continue?</p>
        <button type="button" class="btn btn-danger reset-confirm">Yes, reset</button>
        <button type="button" class="btn reset-cancel">Cancel</button>
      </div>

      <h3>About</h3>
      <p class="about">Terminal Trainer <span class="version"></span> · a simulated Linux shell for practising commands. Nothing you type here touches your device.</p>

      <button type="button" class="btn sheet-close">Done</button>
    </div>`;
  root.appendChild(element);

  const backdrop = element.querySelector<HTMLElement>(".sheet-backdrop")!;
  const sheet = element.querySelector<HTMLElement>(".sheet")!;
  const confirmRow = element.querySelector<HTMLElement>(".reset-confirm-row")!;
  element.querySelector(".version")!.textContent = opts.version;

  const sizeButtons = [...element.querySelectorAll<HTMLButtonElement>("[data-size]")];
  const showSize = (size: FontSize) => {
    for (const button of sizeButtons) button.setAttribute("aria-pressed", String(button.dataset.size === size));
  };
  for (const button of sizeButtons) {
    button.addEventListener("click", () => {
      const size = button.dataset.size as FontSize;
      showSize(size);
      opts.onFontSize(size);
    });
  }
  showSize(opts.prefs.fontSize);

  const open = () => {
    backdrop.hidden = false;
    sheet.hidden = false;
    confirmRow.hidden = true;
    element.querySelector<HTMLButtonElement>(".sheet-close")!.focus();
  };
  const close = () => {
    backdrop.hidden = true;
    sheet.hidden = true;
  };

  element.querySelector(".reset-button")!.addEventListener("click", () => (confirmRow.hidden = false));
  element.querySelector(".reset-cancel")!.addEventListener("click", () => (confirmRow.hidden = true));
  element.querySelector(".reset-confirm")!.addEventListener("click", () => {
    opts.onResetProgress();
    close();
  });
  element.querySelector(".sheet-close")!.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !sheet.hidden) close();
  });

  return { element, open, close, isOpen: () => !sheet.hidden };
}
