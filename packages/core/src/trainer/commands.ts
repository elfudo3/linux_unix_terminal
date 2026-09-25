/** Commands that drive the practice mode: task, tasks, hint, answer, next, skip, progress, reset. */
import type { Command } from "../core/types";
import type { Trainer } from "./trainer";

const CATEGORY = "Practice";

/** The text shown for the current task. */
export function describeTask(trainer: Trainer): string {
  const { index, total } = trainer.progress;
  const c = trainer.current;
  const status = trainer.isCompleted(c) ? " (done)" : "";
  return [
    `Task ${index + 1} of ${total} · ${c.topic}: ${c.title}${status}`,
    "",
    c.task,
    "",
    "Type  hint  for a hint,  answer  to see a solution,  skip  to move on.",
    "",
  ].join("\n");
}

export function trainerCommands(trainer: Trainer): Command[] {
  const task: Command = {
    name: "task",
    category: CATEGORY,
    summary: "show the current exercise (task N jumps to exercise N)",
    usage: "task [number]",
    details: "Shows what to do next. `task 12` jumps straight to exercise 12; the sandbox is reset when you switch.",
    run: ({ args }) => {
      if (args[0] !== undefined) {
        const n = Number(args[0]);
        const total = trainer.challenges.length;
        if (!Number.isInteger(n) || n < 1 || n > total) return { stderr: `task: pick a number between 1 and ${total}\n`, code: 1 };
        trainer.goTo(n - 1);
      }
      return { stdout: describeTask(trainer) };
    },
  };

  const tasks: Command = {
    name: "tasks",
    category: CATEGORY,
    summary: "list every exercise and which ones you have done",
    usage: "tasks",
    details: "Lists all exercises grouped by topic. [x] marks the ones you have completed; > marks the current one.",
    run: () => {
      let text = "";
      let topic = "";
      trainer.challenges.forEach((c, i) => {
        if (c.topic !== topic) {
          topic = c.topic;
          text += `${text ? "\n" : ""}${topic}\n`;
        }
        const mark = trainer.isCompleted(c) ? "[x]" : "[ ]";
        const cursor = i === trainer.progress.index ? ">" : " ";
        text += `${cursor} ${mark} ${String(i + 1).padStart(2)}. ${c.title}\n`;
      });
      return { stdout: text };
    },
  };

  const hint: Command = {
    name: "hint",
    category: CATEGORY,
    summary: "get a hint for the current exercise",
    usage: "hint",
    details: "Shows a nudge in the right direction without giving the answer away.",
    run: () => ({ stdout: `Hint: ${trainer.current.hint}\n` }),
  };

  const answer: Command = {
    name: "answer",
    category: CATEGORY,
    summary: "show a solution for the current exercise",
    usage: "answer",
    details: "Shows one way to solve the current exercise. There are usually others. Try it yourself first!",
    run: () => ({ stdout: "One solution:\n" + trainer.current.solution.map((l) => `  ${l}`).join("\n") + "\n" }),
  };

  const next: Command = {
    name: "next",
    category: CATEGORY,
    summary: "move on to the next exercise once this one is done",
    usage: "next",
    details: "Loads the next exercise. Only works after the current one is solved; use `skip` to jump ahead anyway.",
    run: () => {
      if (!trainer.solved) return { stderr: "next: the current task is not finished yet. Type  skip  to move on anyway.\n", code: 1 };
      if (!trainer.next()) return { stdout: "That was the last task. Type  tasks  to review, or  task 1  to start over.\n" };
      return { stdout: describeTask(trainer) };
    },
  };

  const skip: Command = {
    name: "skip",
    category: CATEGORY,
    summary: "skip the current exercise",
    usage: "skip",
    details: "Moves to the next exercise without completing this one. You can come back later with `task N`.",
    run: () => {
      if (!trainer.skip()) return { stdout: "This is the last task.\n" };
      return { stdout: describeTask(trainer) };
    },
  };

  const progress: Command = {
    name: "progress",
    category: CATEGORY,
    summary: "show how many exercises you have completed",
    usage: "progress",
    details: "Shows completed exercises per topic.",
    run: () => {
      const { done, total } = trainer.progress;
      const byTopic = new Map<string, { done: number; total: number }>();
      for (const c of trainer.challenges) {
        const entry = byTopic.get(c.topic) ?? { done: 0, total: 0 };
        entry.total++;
        if (trainer.isCompleted(c)) entry.done++;
        byTopic.set(c.topic, entry);
      }
      const width = Math.max(...[...byTopic.keys()].map((t) => t.length));
      let text = `${done} of ${total} tasks done\n\n`;
      for (const [topic, n] of byTopic) {
        const bar = "#".repeat(n.done) + "-".repeat(n.total - n.done);
        text += `  ${topic.padEnd(width)}  ${bar}  ${n.done}/${n.total}\n`;
      }
      return { stdout: text };
    },
  };

  const reset: Command = {
    name: "reset",
    category: CATEGORY,
    summary: "restore the sandbox files for the current exercise",
    usage: "reset [--progress]",
    details: "Puts every file back the way the current exercise started. `reset --progress` also forgets which exercises you completed.",
    run: ({ args }) => {
      if (args.includes("--progress")) {
        trainer.resetProgress();
        return { stdout: "Progress cleared. Starting from task 1.\n\n" + describeTask(trainer) };
      }
      trainer.reset();
      return { stdout: "Sandbox reset. Your files are back to how this task started.\n" };
    },
  };

  return [task, tasks, hint, answer, next, skip, progress, reset];
}
