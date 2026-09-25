/**
 * The main screen: task card, terminal, suggestion chips and key bar.
 * It owns running commands (shell → output → trainer check); the app
 * only listens for "solved" to add haptics and a toast.
 */
import type { Shell, Trainer } from "@terminal-trainer/core";
import { complete } from "@terminal-trainer/core";
import { createTerminal, type TerminalView } from "@terminal-trainer/ui";
import { createKeyBar } from "../components/keybar";
import { applySuggestion, createSuggestionBar, suggestionsFor } from "../components/suggestions";
import { createTaskCard, type TaskCard } from "../components/task-card";
import { FONT_SIZE_PX, type FontSize, type Preferences } from "../preferences";

export interface PracticeScreenDeps {
  shell: Shell;
  trainer: Trainer;
  prefs: Preferences;
  onPrefsChange: (prefs: Preferences) => void;
  onSolved?: () => void;
}

export interface PracticeScreen {
  element: HTMLElement;
  terminal: TerminalView;
  card: TaskCard;
  /** Runs a line as if typed (used by the task card and other screens). */
  run(line: string): void;
  /** Puts text on the input line, ready to edit or run (used by Learn's "Try it"). */
  setLine(text: string): void;
  setFontSize(size: FontSize): void;
  /** Tell the screen the soft keyboard opened or closed. */
  setKeyboardOpen(open: boolean): void;
}

export function createPracticeScreen(root: HTMLElement, deps: PracticeScreenDeps): PracticeScreen {
  const { shell, trainer } = deps;
  const element = document.createElement("section");
  element.className = "screen practice";
  root.appendChild(element);

  const prefs = { ...deps.prefs };

  // The saved preference applies while the keyboard is closed. When it opens,
  // the card collapses to give the terminal room; expanding it again during
  // that typing session is temporary and not saved.
  let keyboardOpen = false;
  let expandedWhileTyping = false;
  const applyCollapse = () => card.setCollapsed(keyboardOpen ? !expandedWhileTyping : prefs.taskCardCollapsed);

  const card = createTaskCard(element, trainer, {
    onCommand: (line) => run(line),
    collapsed: prefs.taskCardCollapsed,
    onToggle: (collapsed) => {
      if (keyboardOpen) {
        expandedWhileTyping = !collapsed;
        return;
      }
      prefs.taskCardCollapsed = collapsed;
      deps.onPrefsChange({ ...prefs });
    },
  });

  const setKeyboardOpen = (open: boolean) => {
    if (open === keyboardOpen) return;
    keyboardOpen = open;
    expandedWhileTyping = false;
    applyCollapse();
  };

  const terminalRoot = document.createElement("div");
  terminalRoot.className = "terminal-root";
  element.appendChild(terminalRoot);

  const terminal = createTerminal(terminalRoot, {
    prompt: () => shell.prompt(),
    history: () => shell.history,
    complete: (line) => complete(shell, line),
    focusOnClick: false,
    dockInput: true,
    submitButton: "Run",
    maxChunks: 300,
    onSubmit: (line) => {
      const result = shell.run(line);
      if (result.clear) terminal.clear();
      terminal.print(result.stdout);
      terminal.print(result.stderr, "stderr");
      if (trainer.afterCommand(line, result) === "solved") {
        terminal.print(trainer.finished ? "✓ Task complete! That was the last one. Well done!\n" : "✓ Task complete! Tap Next to continue.\n", "success");
        deps.onSolved?.();
      }
      refreshSuggestions();
    },
  });

  const suggestions = createSuggestionBar(element, {
    onPick: (candidate) => {
      terminal.input.value = applySuggestion(terminal.input.value, candidate);
      terminal.focus();
      refreshSuggestions();
    },
  });
  createKeyBar(element, terminal);

  const refreshSuggestions = () => suggestions.update(suggestionsFor(shell, terminal.input.value));
  terminal.input.addEventListener("input", refreshSuggestions);

  const run = (line: string) => terminal.submit(line);

  const setLine = (text: string) => {
    terminal.input.value = text;
    terminal.focus();
    terminal.input.setSelectionRange(text.length, text.length);
    refreshSuggestions();
  };

  const setFontSize = (size: FontSize) => {
    terminal.element.style.setProperty("--terminal-font-size", `${FONT_SIZE_PX[size]}px`);
  };

  setFontSize(prefs.fontSize);
  refreshSuggestions();
  terminal.print(
    "Welcome! This is a simulated Linux shell: nothing here can harm a real device.\nYour task is shown above. Type  help  to list every command.\n",
    "info",
  );

  return { element, terminal, card, run, setLine, setFontSize, setKeyboardOpen };
}
