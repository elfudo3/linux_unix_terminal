import { describe, expect, it } from "vitest";
import { createSampleFS } from "../../src/core/sample-fs";
import { Shell } from "../../src/core/shell";
import { challenges } from "../../src/trainer/challenges";
import { Trainer, type Challenge } from "../../src/trainer/trainer";

/** A tiny in-memory stand-in for localStorage. */
function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const tiny: Challenge[] = [
  { id: "a", topic: "T", title: "Make a", task: "touch a", hint: "touch", solution: ["touch a"], check: ({ shell }) => shell.fs.exists("/home/user/a") },
  { id: "b", topic: "T", title: "Make b", task: "touch b", hint: "touch", solution: ["touch b"], check: ({ shell }) => shell.fs.exists("/home/user/b") },
  {
    id: "c",
    topic: "U",
    title: "Say hi",
    task: "echo hi",
    hint: "echo",
    solution: ["echo hi"],
    setup: (shell) => shell.fs.writeFile("/home/user/extra.txt", "x"),
    check: ({ result }) => result.stdout === "hi\n",
  },
];

function make(storage = memoryStorage()) {
  const shell = new Shell({ fs: createSampleFS() });
  const trainer = new Trainer({ shell, challenges: tiny, storage, freshFS: createSampleFS });
  return { shell, trainer, storage };
}

describe("Trainer", () => {
  it("starts on the first task with nothing solved", () => {
    const { trainer } = make();
    expect(trainer.current.id).toBe("a");
    expect(trainer.solved).toBe(false);
    expect(trainer.progress).toEqual({ done: 0, total: 3, index: 0 });
  });

  it("reports when a command solves the current task, once", () => {
    const { shell, trainer } = make();
    const run = (line: string) => trainer.afterCommand(line, shell.run(line));
    expect(run("ls")).toBe("no");
    expect(run("touch a")).toBe("solved");
    expect(trainer.solved).toBe(true);
    expect(run("touch a")).toBe("already");
    expect(trainer.progress.done).toBe(1);
  });

  it("next() only advances once the task is solved; skip() always does", () => {
    const { shell, trainer } = make();
    expect(trainer.next()).toBe(false);
    expect(trainer.current.id).toBe("a");
    trainer.afterCommand("touch a", shell.run("touch a"));
    expect(trainer.next()).toBe(true);
    expect(trainer.current.id).toBe("b");
    expect(trainer.skip()).toBe(true);
    expect(trainer.current.id).toBe("c");
    expect(trainer.progress.done).toBe(1);
  });

  it("resets the sandbox and runs the task's setup when a task starts", () => {
    const { shell, trainer } = make();
    shell.run("touch a; cd documents");
    trainer.skip();
    expect(shell.fs.exists("/home/user/a")).toBe(false);
    expect(shell.cwd).toBe("/home/user");
    trainer.skip();
    expect(shell.fs.exists("/home/user/extra.txt")).toBe(true);
  });

  it("reset() restores the current task's starting files without losing progress", () => {
    const { shell, trainer } = make();
    trainer.afterCommand("touch a", shell.run("touch a"));
    shell.run("rm notes.txt");
    trainer.reset();
    expect(shell.fs.exists("/home/user/notes.txt")).toBe(true);
    expect(shell.fs.exists("/home/user/a")).toBe(false);
    expect(trainer.progress.done).toBe(1);
    expect(trainer.solved).toBe(false);
  });

  it("stops at the last task and knows when everything is done", () => {
    const { shell, trainer } = make();
    trainer.skip();
    trainer.skip();
    expect(trainer.skip()).toBe(false);
    expect(trainer.current.id).toBe("c");
    expect(trainer.finished).toBe(false);
    trainer.afterCommand("echo hi", shell.run("echo hi"));
    trainer.afterCommand("touch a", shell.run("touch a"));
    trainer.goTo(0);
    trainer.afterCommand("touch a", shell.run("touch a"));
    trainer.goTo(1);
    trainer.afterCommand("touch b", shell.run("touch b"));
    expect(trainer.finished).toBe(true);
  });

  it("persists progress and resumes from storage", () => {
    const storage = memoryStorage();
    const first = make(storage);
    first.trainer.afterCommand("touch a", first.shell.run("touch a"));
    first.trainer.next();
    const second = make(storage);
    expect(second.trainer.current.id).toBe("b");
    expect(second.trainer.progress.done).toBe(1);
    second.trainer.resetProgress();
    expect(second.trainer.current.id).toBe("a");
    expect(second.trainer.progress.done).toBe(0);
    expect(make(storage).trainer.progress.done).toBe(0);
  });

  it("survives corrupt or missing storage", () => {
    const storage = memoryStorage();
    storage.setItem("terminal-trainer.progress", "{not json");
    expect(() => make(storage)).not.toThrow();
    const shell = new Shell({ fs: createSampleFS() });
    expect(() => new Trainer({ shell, challenges: tiny, freshFS: createSampleFS })).not.toThrow();
  });

  it("notifies listeners when state changes", () => {
    const { shell, trainer } = make();
    let calls = 0;
    const stop = trainer.subscribe(() => calls++);
    trainer.afterCommand("touch a", shell.run("touch a"));
    trainer.next();
    stop();
    trainer.skip();
    expect(calls).toBe(2);
  });
});

describe("challenge catalogue", () => {
  it("has unique ids and non-empty text", () => {
    const ids = challenges.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of challenges) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.task.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(0);
      expect(c.solution.length).toBeGreaterThan(0);
    }
  });

  it("every task is solved by its own reference solution and not by a no-op", () => {
    for (const [index, challenge] of challenges.entries()) {
      const shell = new Shell({ fs: createSampleFS() });
      const trainer = new Trainer({ shell, challenges, freshFS: createSampleFS });
      trainer.goTo(index);
      expect(trainer.afterCommand("true", shell.run("true")), `${challenge.id} solved by 'true'`).toBe("no");
      let outcome = "no";
      for (const line of challenge.solution) outcome = trainer.afterCommand(line, shell.run(line));
      expect(outcome, `${challenge.id} not solved by ${challenge.solution.join(" ; ")}`).toBe("solved");
    }
  });
});
