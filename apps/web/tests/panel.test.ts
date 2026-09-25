import { beforeEach, describe, expect, it } from "vitest";
import { Shell, Trainer, createSampleFS, type Challenge } from "@terminal-trainer/core";
import { createPanel } from "../src/panel";

const tiny: Challenge[] = [
  { id: "a", topic: "Basics", title: "Make a", task: "Create a file named a.", hint: "Use touch.", solution: ["touch a"], check: ({ shell }) => shell.fs.exists("/home/user/a") },
  { id: "b", topic: "Basics", title: "Make b", task: "Create b.", hint: "touch b", solution: ["touch b"], check: ({ shell }) => shell.fs.exists("/home/user/b") },
];

let root: HTMLElement;
let shell: Shell;
let trainer: Trainer;
let commands: string[];

const text = (selector: string) => root.querySelector(selector)?.textContent ?? "";
const click = (selector: string) => (root.querySelector(selector) as HTMLElement).click();

beforeEach(() => {
  document.body.innerHTML = '<div id="p"></div>';
  root = document.getElementById("p")!;
  shell = new Shell({ fs: createSampleFS() });
  trainer = new Trainer({ shell, challenges: tiny, freshFS: createSampleFS });
  commands = [];
  createPanel(root, trainer, { onCommand: (line) => commands.push(line) });
});

describe("practice panel", () => {
  it("shows the current task and progress", () => {
    expect(text(".task-title")).toBe("Make a");
    expect(text(".task-text")).toBe("Create a file named a.");
    expect(text(".task-meta")).toContain("Task 1 of 2");
    expect(text(".progress-label")).toBe("0 / 2 done");
    expect(root.querySelector<HTMLElement>(".progress-bar")?.style.width).toBe("0%");
  });

  it("buttons run practice commands through the terminal", () => {
    click('[data-cmd="hint"]');
    click('[data-cmd="skip"]');
    expect(commands).toEqual(["hint", "skip"]);
  });

  it("enables Next and celebrates once the task is solved", () => {
    const next = root.querySelector<HTMLButtonElement>('[data-cmd="next"]')!;
    expect(next.disabled).toBe(true);
    trainer.afterCommand("touch a", shell.run("touch a"));
    expect(next.disabled).toBe(false);
    expect(text(".task-status")).toMatch(/solved/i);
    expect(text(".progress-label")).toBe("1 / 2 done");
    expect(root.querySelector<HTMLElement>(".progress-bar")?.style.width).toBe("50%");
  });

  it("lists all tasks, marks the current and done ones, and jumps on click", () => {
    trainer.afterCommand("touch a", shell.run("touch a"));
    const items = root.querySelectorAll(".task-list-item");
    expect(items.length).toBe(2);
    expect(items[0]?.className).toContain("done");
    expect(items[0]?.className).toContain("current");
    (items[1]?.querySelector("button") as HTMLElement).click();
    expect(commands).toEqual(["task 2"]);
  });

  it("re-renders when the trainer moves on", () => {
    trainer.skip();
    expect(text(".task-title")).toBe("Make b");
  });
});
