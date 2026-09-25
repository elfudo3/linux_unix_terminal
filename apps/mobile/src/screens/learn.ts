/**
 * Command reference: a searchable list of every command, and a page per
 * command built from the same metadata `man` uses. "Try it" drops the
 * command into the terminal.
 */
import type { Command, Shell } from "@terminal-trainer/core";

export interface LearnScreen {
  element: HTMLElement;
  showCommand(name: string): void;
  /** Returns to the list. False if the list was already showing. */
  back(): boolean;
  isDetailOpen(): boolean;
}

export function createLearnScreen(root: HTMLElement, shell: Shell, opts: { onTry: (command: string) => void }): LearnScreen {
  const element = document.createElement("section");
  element.className = "screen learn";
  element.innerHTML = `
    <div class="learn-list scrollable">
      <header class="screen-header">
        <h2>Commands</h2>
        <input type="search" class="learn-search" placeholder="Search commands" aria-label="Search commands"
               autocomplete="off" autocapitalize="off" spellcheck="false" />
      </header>
      <div class="learn-groups"></div>
    </div>
    <div class="learn-detail scrollable" hidden>
      <button type="button" class="back-button">‹ Commands</button>
      <h2 class="command-title"></h2>
      <p class="command-summary"></p>
      <h3>Usage</h3>
      <pre class="command-usage"></pre>
      <h3>Details</h3>
      <pre class="command-details"></pre>
      <button type="button" class="btn btn-primary try-button">Try it in the terminal</button>
    </div>`;
  root.appendChild(element);

  const listView = element.querySelector<HTMLElement>(".learn-list")!;
  const detail = element.querySelector<HTMLElement>(".learn-detail")!;
  const groups = element.querySelector<HTMLElement>(".learn-groups")!;
  const search = element.querySelector<HTMLInputElement>(".learn-search")!;
  let currentName = "";

  // Group commands by category, in registration order.
  const byCategory = new Map<string, Command[]>();
  for (const cmd of shell.listCommands()) {
    const key = cmd.category ?? "Other";
    byCategory.set(key, [...(byCategory.get(key) ?? []), cmd]);
  }
  for (const [category, commands] of byCategory) {
    const group = document.createElement("div");
    group.className = "category-group";
    const heading = document.createElement("h3");
    heading.className = "category-heading";
    heading.textContent = category;
    group.appendChild(heading);
    const list = document.createElement("ul");
    list.className = "command-list";
    for (const cmd of commands) {
      const item = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "command-row";
      row.dataset.command = cmd.name;
      row.innerHTML = `<span class="command-name"></span><span class="command-summary"></span>`;
      row.querySelector(".command-name")!.textContent = cmd.name;
      row.querySelector(".command-summary")!.textContent = cmd.summary;
      row.addEventListener("click", () => showCommand(cmd.name));
      item.appendChild(row);
      list.appendChild(item);
    }
    group.appendChild(list);
    groups.appendChild(group);
  }

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    for (const group of groups.querySelectorAll<HTMLElement>(".category-group")) {
      let visible = 0;
      for (const row of group.querySelectorAll<HTMLElement>(".command-row")) {
        const matches = query === "" || row.textContent!.toLowerCase().includes(query);
        row.hidden = !matches;
        if (matches) visible++;
      }
      group.hidden = visible === 0;
    }
  };
  search.addEventListener("input", filter);

  const showCommand = (name: string) => {
    const cmd = shell.getCommand(name);
    if (!cmd) return;
    currentName = name;
    detail.querySelector(".command-title")!.textContent = cmd.name;
    detail.querySelector(".command-summary")!.textContent = cmd.summary;
    detail.querySelector(".command-usage")!.textContent = cmd.usage;
    detail.querySelector(".command-details")!.textContent = cmd.details ?? cmd.summary;
    listView.hidden = true;
    detail.hidden = false;
    detail.scrollTop = 0;
  };

  const back = () => {
    if (detail.hidden) return false;
    detail.hidden = true;
    listView.hidden = false;
    return true;
  };

  detail.querySelector(".back-button")!.addEventListener("click", back);
  detail.querySelector(".try-button")!.addEventListener("click", () => opts.onTry(currentName));

  return { element, showCommand, back, isDetailOpen: () => !detail.hidden };
}
