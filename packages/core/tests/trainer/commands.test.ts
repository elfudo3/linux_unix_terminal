import { describe, expect, it } from "vitest";
import { createSampleFS } from "../../src/core/sample-fs";
import { Shell } from "../../src/core/shell";
import { challenges } from "../../src/trainer/challenges";
import { trainerCommands } from "../../src/trainer/commands";
import { Trainer } from "../../src/trainer/trainer";

function make() {
  const shell = new Shell({ fs: createSampleFS() });
  const trainer = new Trainer({ shell, challenges, freshFS: createSampleFS });
  for (const cmd of trainerCommands(trainer)) shell.register(cmd);
  return { shell, trainer };
}

describe("practice commands", () => {
  it("task shows the current exercise", () => {
    const { shell, trainer } = make();
    const text = shell.run("task").stdout;
    expect(text).toContain(`Task 1 of ${challenges.length}`);
    expect(text).toContain(trainer.current.title);
    expect(text).toContain(trainer.current.task);
  });

  it("task N jumps to another exercise", () => {
    const { shell, trainer } = make();
    expect(shell.run("task 5").stdout).toContain("Task 5 of");
    expect(trainer.current.id).toBe(challenges[4]!.id);
    expect(shell.run("task 999").stderr).toMatch(/between 1 and/);
  });

  it("hint and answer reveal help", () => {
    const { shell, trainer } = make();
    expect(shell.run("hint").stdout).toContain(trainer.current.hint);
    expect(shell.run("answer").stdout).toContain(trainer.current.solution[0]!);
  });

  it("next refuses until solved, skip always moves on", () => {
    const { shell, trainer } = make();
    expect(shell.run("next").stderr).toMatch(/not finished/);
    expect(shell.run("skip").stdout).toContain("Task 2 of");
    trainer.afterCommand(trainer.current.solution[0]!, shell.run(trainer.current.solution[0]!));
    expect(shell.run("next").stdout).toContain("Task 3 of");
  });

  it("tasks lists everything with completion marks", () => {
    const { shell } = make();
    const text = shell.run("tasks").stdout;
    expect(text).toContain(challenges[0]!.title);
    expect(text).toContain("[ ]");
  });

  it("progress summarises by topic", () => {
    const { shell } = make();
    const text = shell.run("progress").stdout;
    expect(text).toMatch(/0 of \d+ tasks done/);
    expect(text).toContain("Navigation");
  });

  it("reset restores the sandbox", () => {
    const { shell } = make();
    shell.run("rm notes.txt");
    expect(shell.run("reset").stdout).toMatch(/reset/i);
    expect(shell.fs.exists("/home/user/notes.txt")).toBe(true);
  });
});
