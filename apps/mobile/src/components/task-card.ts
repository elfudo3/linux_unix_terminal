/**
 * The current exercise, shown above the terminal. Tapping the header
 * collapses it to one line so the terminal gets more room when the
 * keyboard is open. Buttons send practice commands (hint, skip...) through
 * the terminal so the transcript shows what happened.
 */
import type { Trainer } from "@terminal-trainer/core";

export interface TaskCardOptions {
  onCommand: (line: string) => void;
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

export interface TaskCard {
  element: HTMLElement;
  render(): void;
  setCollapsed(collapsed: boolean): void;
}

export function createTaskCard(root: HTMLElement, trainer: Trainer, opts: TaskCardOptions): TaskCard {
  const element = document.createElement("section");
  element.className = "task-card";
  element.setAttribute("aria-label", "Current task");
  element.innerHTML = `
    <button type="button" class="task-card-header" aria-expanded="true" aria-controls="task-card-body">
      <span class="task-card-heading">
        <span class="task-meta"></span>
        <span class="task-title"></span>
      </span>
      <svg class="chevron" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <div class="task-card-body" id="task-card-body">
      <p class="task-text"></p>
      <p class="task-status" role="status"></p>
      <div class="task-actions">
        <button type="button" class="btn" data-cmd="hint">Hint</button>
        <button type="button" class="btn" data-cmd="answer">Answer</button>
        <button type="button" class="btn" data-cmd="skip">Skip</button>
        <button type="button" class="btn btn-primary" data-cmd="next">Next →</button>
      </div>
    </div>`;
  root.appendChild(element);

  const q = <T extends HTMLElement>(selector: string) => element.querySelector<T>(selector)!;
  const header = q<HTMLButtonElement>(".task-card-header");
  const meta = q(".task-meta");
  const title = q(".task-title");
  const text = q(".task-text");
  const status = q(".task-status");
  const next = q<HTMLButtonElement>('[data-cmd="next"]');

  for (const button of element.querySelectorAll<HTMLButtonElement>("[data-cmd]")) {
    button.addEventListener("click", () => opts.onCommand(button.dataset.cmd!));
  }

  const setCollapsed = (collapsed: boolean) => {
    element.classList.toggle("collapsed", collapsed);
    header.setAttribute("aria-expanded", String(!collapsed));
  };

  // Tapping the header while typing must not close the keyboard.
  header.addEventListener("pointerdown", (event) => event.preventDefault());
  header.addEventListener("click", () => {
    const collapsed = !element.classList.contains("collapsed");
    setCollapsed(collapsed);
    opts.onToggle?.(collapsed);
  });

  const render = () => {
    const { index, total } = trainer.progress;
    const task = trainer.current;
    meta.textContent = `Task ${index + 1} of ${total} · ${task.topic}`;
    title.textContent = task.title;
    text.textContent = task.task;
    element.classList.toggle("solved", trainer.solved);
    if (trainer.solved) status.textContent = trainer.finished ? "✓ Solved! You have finished every task." : "✓ Solved! Tap Next to continue.";
    else status.textContent = trainer.isCompleted(task) ? "Completed earlier. Solve it again or skip." : "";
    next.disabled = !trainer.solved;
  };

  setCollapsed(opts.collapsed ?? false);
  trainer.subscribe(render);
  render();
  return { element, render, setCollapsed };
}
