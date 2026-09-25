/**
 * Bottom tab bar. Each tab owns a panel element; exactly one panel is shown
 * at a time and the others get the `hidden` attribute, so screens keep
 * their state (scroll position, typed text) while out of view.
 */

export interface TabSpec {
  id: string;
  label: string;
  /** Inline SVG markup for the icon. */
  icon: string;
  panel: HTMLElement;
}

export interface Tabs {
  element: HTMLElement;
  readonly current: string;
  select(id: string): void;
  /** Called with the new tab id after every change. Returns an unsubscribe function. */
  onChange(listener: (id: string) => void): () => void;
}

export function createTabs(root: HTMLElement, specs: TabSpec[], opts: { initial?: string } = {}): Tabs {
  const nav = document.createElement("nav");
  nav.className = "tabbar";
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", "Sections");
  root.appendChild(nav);

  const listeners = new Set<(id: string) => void>();
  const buttons = new Map<string, HTMLButtonElement>();
  let current = "";

  for (const spec of specs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `panel-${spec.id}`);
    button.dataset.tab = spec.id;
    button.innerHTML = `<span class="tab-icon" aria-hidden="true">${spec.icon}</span><span class="tab-label">${spec.label}</span>`;
    button.addEventListener("click", () => select(spec.id));
    nav.appendChild(button);
    buttons.set(spec.id, button);

    spec.panel.id = `panel-${spec.id}`;
    spec.panel.setAttribute("role", "tabpanel");
    spec.panel.setAttribute("aria-labelledby", `tab-${spec.id}`);
    button.id = `tab-${spec.id}`;
  }

  const select = (id: string) => {
    if (!buttons.has(id) || id === current) return;
    current = id;
    for (const spec of specs) {
      const active = spec.id === id;
      spec.panel.hidden = !active;
      const button = buttons.get(spec.id)!;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle("tab-active", active);
    }
    for (const listener of listeners) listener(id);
  };

  select(opts.initial ?? specs[0]!.id);

  return {
    element: nav,
    get current() {
      return current;
    },
    select,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
