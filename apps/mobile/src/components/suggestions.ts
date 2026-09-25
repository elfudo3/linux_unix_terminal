/**
 * Tap-to-insert suggestions above the key bar: command names while typing
 * the first word, file names after it. Built on the same completion logic
 * as the Tab key, so the two never disagree.
 */
import { complete, type Shell } from "@terminal-trainer/core";

/** Shown when the line is empty, instead of an alphabetical dump of every command. */
export const STARTER_COMMANDS = ["ls", "cd", "cat", "pwd", "task", "hint", "help", "clear"];

export function suggestionsFor(shell: Shell, line: string, limit = 8): string[] {
  if (line.trim() === "") return STARTER_COMMANDS.filter((name) => shell.getCommand(name)).slice(0, limit);
  return complete(shell, line).candidates.slice(0, limit);
}

/** Replaces the word being typed with `candidate`; files get a trailing space, directories do not. */
export function applySuggestion(line: string, candidate: string): string {
  const start = line.lastIndexOf(" ") + 1;
  return line.slice(0, start) + candidate + (candidate.endsWith("/") ? "" : " ");
}

export interface SuggestionBar {
  element: HTMLElement;
  update(candidates: string[]): void;
}

export function createSuggestionBar(root: HTMLElement, opts: { onPick: (candidate: string) => void }): SuggestionBar {
  const bar = document.createElement("div");
  bar.className = "suggestions";
  bar.setAttribute("aria-label", "Suggestions");
  root.appendChild(bar);

  const update = (candidates: string[]) => {
    bar.replaceChildren();
    bar.hidden = candidates.length === 0;
    for (const candidate of candidates) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      // Show just the last path segment so "docs/archive/old.log" stays short.
      chip.textContent = candidate.replace(/\/$/, "").split("/").pop() + (candidate.endsWith("/") ? "/" : "");
      chip.title = candidate;
      chip.addEventListener("pointerdown", (event) => event.preventDefault());
      chip.addEventListener("click", () => opts.onPick(candidate));
      bar.appendChild(chip);
    }
  };
  update([]);
  return { element: bar, update };
}
