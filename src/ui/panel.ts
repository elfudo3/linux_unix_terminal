/**
 * The practice panel beside the terminal: current task, progress and a list
 * of all tasks. Buttons do not touch the trainer directly; they send the
 * matching command (hint, skip, next...) through the terminal so the
 * transcript always shows what happened and typing works the same way.
 */
import type { Trainer } from "../trainer/trainer";

export interface PanelOptions {
  /** Runs a command line in the terminal. */
  onCommand: (line: string) => void;
}

export function createPanel(root: HTMLElement, trainer: Trainer, opts: PanelOptions): void {
  root.innerHTML = `
    <aside class="panel" aria-label="Practice">
      <div class="panel-header">
        <h2 class="panel-title">Practice</h2>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuenow="0" aria-valuemax="0" aria-label="Tasks completed">
          <div class="progress-bar"></div>
        </div>
        <span class="progress-label"></span>
      </div>
      <section class="task" aria-live="polite">
        <p class="task-meta"></p>
        <h3 class="task-title"></h3>
        <p class="task-text"></p>
        <p class="task-status"></p>
      </section>
      <div class="panel-actions">
        <button type="button" class="btn" data-cmd="hint">Hint</button>
        <button type="button" class="btn" data-cmd="answer">Answer</button>
        <button type="button" class="btn" data-cmd="reset" title="Put the files back the way this task started">Reset files</button>
        <button type="button" class="btn" data-cmd="skip">Skip</button>
        <button type="button" class="btn btn-primary" data-cmd="next">Next →</button>
      </div>
      <details class="all-tasks">
        <summary>All tasks</summary>
        <ol class="task-list"></ol>
      </details>
    </aside>`;

  const q = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const progress = q<HTMLElement>(".progress");
  const bar = q<HTMLElement>(".progress-bar");
  const label = q<HTMLElement>(".progress-label");
  const meta = q<HTMLElement>(".task-meta");
  const title = q<HTMLElement>(".task-title");
  const text = q<HTMLElement>(".task-text");
  const status = q<HTMLElement>(".task-status");
  const nextButton = q<HTMLButtonElement>('[data-cmd="next"]');
  const list = q<HTMLOListElement>(".task-list");

  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-cmd]")) {
    button.addEventListener("click", () => opts.onCommand(button.dataset.cmd!));
  }

  const render = () => {
    const { done, total, index } = trainer.progress;
    const task = trainer.current;

    progress.setAttribute("aria-valuenow", String(done));
    progress.setAttribute("aria-valuemax", String(total));
    bar.style.width = `${total === 0 ? 0 : Math.round((done / total) * 100)}%`;
    label.textContent = `${done} / ${total} done`;

    meta.textContent = `Task ${index + 1} of ${total} · ${task.topic}`;
    title.textContent = task.title;
    text.textContent = task.task;
    if (trainer.solved) status.textContent = trainer.finished ? "✓ Solved! You have finished every task." : "✓ Solved! Press Next to continue.";
    else status.textContent = trainer.isCompleted(task) ? "Completed earlier. Solve it again or press Skip." : "";
    nextButton.disabled = !trainer.solved;

    // The full list, grouped by topic through a data attribute the CSS can style.
    list.replaceChildren();
    let topic = "";
    trainer.challenges.forEach((c, i) => {
      if (c.topic !== topic) {
        topic = c.topic;
        const heading = document.createElement("li");
        heading.className = "task-list-topic";
        heading.textContent = topic;
        heading.setAttribute("role", "presentation");
        list.appendChild(heading);
      }
      const item = document.createElement("li");
      item.className = ["task-list-item", trainer.isCompleted(c) ? "done" : "", i === index ? "current" : ""].join(" ").trim();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "task-link";
      button.textContent = `${i + 1}. ${c.title}`;
      button.setAttribute("aria-current", i === index ? "true" : "false");
      button.addEventListener("click", () => opts.onCommand(`task ${i + 1}`));
      item.appendChild(button);
      list.appendChild(item);
    });
  };

  trainer.subscribe(render);
  render();
}
