/**
 * The terminal widget: an output log plus a single input line. It owns no
 * shell logic; it renders text it is given and hands typed lines to a
 * callback. A real <input> is used (not contenteditable) so screen readers
 * and mobile keyboards work.
 *
 * Keys: Enter runs, Up/Down walk history, Tab completes, Ctrl+L clears,
 * Ctrl+C cancels the current line, Ctrl+U wipes it.
 */
import type { Completion } from "../core/completion";

export type ChunkKind = "stdout" | "stderr" | "info" | "success" | "command";

export interface TerminalOptions {
  /** Current prompt text, e.g. "user@sandbox:~$ ". Called before every echo. */
  prompt: () => string;
  /** Called with each submitted line. */
  onSubmit: (line: string) => void;
  /** Lines available to the Up/Down keys. */
  history: () => readonly string[];
  complete?: (line: string) => Completion;
  /** How many output chunks to keep in the DOM (oldest are dropped). */
  maxChunks?: number;
}

export interface TerminalView {
  element: HTMLElement;
  input: HTMLInputElement;
  /** Appends text to the output. Empty text prints nothing. */
  print(text: string, kind?: ChunkKind): void;
  clear(): void;
  focus(): void;
  /** Runs `line` exactly as if the user had typed it and pressed Enter. */
  submit(line: string): void;
}

export function createTerminal(root: HTMLElement, opts: TerminalOptions): TerminalView {
  const maxChunks = opts.maxChunks ?? 500;

  root.innerHTML = `
    <div class="terminal" role="region" aria-label="Terminal">
      <div class="terminal-output" role="log" aria-live="polite"></div>
      <form class="terminal-input-line" autocomplete="off">
        <label class="terminal-prompt" for="terminal-input"></label>
        <input id="terminal-input" class="terminal-input" type="text" autocomplete="off"
               autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send"
               aria-label="Command line. Type a command and press Enter." />
      </form>
    </div>`;
  const element = root.querySelector<HTMLElement>(".terminal")!;
  const output = root.querySelector<HTMLElement>(".terminal-output")!;
  const form = root.querySelector<HTMLFormElement>(".terminal-input-line")!;
  const promptEl = root.querySelector<HTMLElement>(".terminal-prompt")!;
  const input = root.querySelector<HTMLInputElement>(".terminal-input")!;

  // History navigation state: index into history(), and the draft typed before browsing.
  let historyIndex = -1;
  let draft = "";

  const refreshPrompt = () => (promptEl.textContent = opts.prompt());

  const scrollToBottom = () => {
    element.scrollTop = element.scrollHeight;
  };

  const print = (text: string, kind: ChunkKind = "stdout") => {
    if (text === "") return;
    const chunk = document.createElement("div");
    chunk.className = `line line-${kind}`;
    chunk.textContent = text;
    output.appendChild(chunk);
    while (output.childElementCount > maxChunks) output.firstElementChild!.remove();
    scrollToBottom();
  };

  /** Echoes the prompt and the line, like a real terminal does when you press Enter. */
  const echo = (line: string) => {
    const chunk = document.createElement("div");
    chunk.className = "line line-command";
    const promptSpan = document.createElement("span");
    promptSpan.className = "prompt";
    promptSpan.textContent = opts.prompt();
    chunk.append(promptSpan, document.createTextNode(line));
    output.appendChild(chunk);
    while (output.childElementCount > maxChunks) output.firstElementChild!.remove();
  };

  const submit = (line: string) => {
    echo(line);
    input.value = "";
    historyIndex = -1;
    draft = "";
    opts.onSubmit(line);
    refreshPrompt();
    scrollToBottom();
  };

  const browseHistory = (direction: -1 | 1) => {
    const lines = opts.history();
    if (lines.length === 0) return;
    if (historyIndex === -1) {
      if (direction === 1) return;
      draft = input.value;
      historyIndex = lines.length;
    }
    historyIndex = Math.min(Math.max(historyIndex + direction, 0), lines.length);
    input.value = historyIndex === lines.length ? draft : (lines[historyIndex] ?? "");
    if (historyIndex === lines.length) historyIndex = -1;
    // Keep the caret at the end, where you expect it after recalling a line.
    input.setSelectionRange(input.value.length, input.value.length);
  };

  const tabComplete = () => {
    if (!opts.complete) return;
    const { line, candidates } = opts.complete(input.value);
    if (candidates.length > 1 && line === input.value) {
      // Nothing more to fill in: show the options, like bash does on a second Tab.
      echo(input.value);
      print(candidates.join("  ") + "\n", "info");
    }
    input.value = line;
    input.setSelectionRange(line.length, line.length);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit(input.value);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      browseHistory(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      browseHistory(1);
    } else if (event.key === "Tab") {
      event.preventDefault();
      tabComplete();
    } else if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      clear();
    } else if (event.ctrlKey && event.key.toLowerCase() === "c") {
      // With a selection, Ctrl+C means "copy"; leave that to the browser.
      const selecting = input.selectionStart !== input.selectionEnd || Boolean(window.getSelection()?.toString());
      if (selecting) return;
      event.preventDefault();
      echo(input.value + "^C");
      input.value = "";
      historyIndex = -1;
    } else if (event.ctrlKey && event.key.toLowerCase() === "u") {
      event.preventDefault();
      input.value = "";
    }
  });

  // Clicking anywhere in the terminal focuses the input, unless the user is selecting text to copy.
  element.addEventListener("click", () => {
    if (!window.getSelection()?.toString()) input.focus();
  });

  const clear = () => {
    output.replaceChildren();
  };

  refreshPrompt();
  return { element, input, print, clear, submit, focus: () => input.focus() };
}
