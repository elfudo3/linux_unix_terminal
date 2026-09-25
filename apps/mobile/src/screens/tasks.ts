/** The task list: progress at the top, every exercise grouped by topic below. */
import type { Trainer } from "@terminal-trainer/core";

export interface TasksScreen {
  element: HTMLElement;
  render(): void;
}

export function createTasksScreen(root: HTMLElement, trainer: Trainer, opts: { onSelect: (index: number) => void }): TasksScreen {
  const element = document.createElement("section");
  element.className = "screen tasks scrollable";
  element.innerHTML = `
    <header class="screen-header">
      <h2>Tasks</h2>
      <div class="progress" role="progressbar" aria-label="Tasks completed" aria-valuemin="0" aria-valuenow="0" aria-valuemax="0">
        <div class="progress-bar"></div>
      </div>
      <p class="progress-label"></p>
    </header>
    <ol class="task-list"></ol>`;
  root.appendChild(element);

  const progress = element.querySelector<HTMLElement>(".progress")!;
  const bar = element.querySelector<HTMLElement>(".progress-bar")!;
  const label = element.querySelector<HTMLElement>(".progress-label")!;
  const list = element.querySelector<HTMLOListElement>(".task-list")!;

  const render = () => {
    const { done, total, index } = trainer.progress;
    progress.setAttribute("aria-valuenow", String(done));
    progress.setAttribute("aria-valuemax", String(total));
    bar.style.width = `${total === 0 ? 0 : Math.round((done / total) * 100)}%`;
    label.textContent = `${done} of ${total} done`;

    list.replaceChildren();
    let topic = "";
    trainer.challenges.forEach((challenge, i) => {
      if (challenge.topic !== topic) {
        topic = challenge.topic;
        const heading = document.createElement("li");
        heading.className = "topic-heading";
        heading.textContent = topic;
        list.appendChild(heading);
      }
      const item = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "task-row";
      row.classList.toggle("done", trainer.isCompleted(challenge));
      row.classList.toggle("current", i === index);
      row.setAttribute("aria-current", i === index ? "true" : "false");
      row.innerHTML = `<span class="task-num">${i + 1}</span><span class="task-row-title"></span><span class="task-check" aria-hidden="true">✓</span>`;
      row.querySelector(".task-row-title")!.textContent = challenge.title;
      row.addEventListener("click", () => opts.onSelect(i));
      item.appendChild(row);
      list.appendChild(item);
    });
  };

  trainer.subscribe(render);
  render();
  return { element, render };
}
