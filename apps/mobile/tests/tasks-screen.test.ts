import { describe, expect, it, vi } from "vitest";
import { createTasksScreen } from "../src/screens/tasks";
import { makeFixture } from "./helpers";

describe("tasks screen", () => {
  it("lists tasks grouped by topic with progress, marking current and done", () => {
    const { root, shell, trainer } = makeFixture();
    const screen = createTasksScreen(root, trainer, { onSelect: vi.fn() });
    expect(screen.element.querySelectorAll(".topic-heading").length).toBe(2);
    const rows = () => [...screen.element.querySelectorAll<HTMLElement>(".task-row")];
    expect(rows().length).toBe(3);
    expect(rows()[0]!.classList.contains("current")).toBe(true);
    expect(screen.element.querySelector(".progress-label")?.textContent).toBe("0 of 3 done");
    trainer.afterCommand("touch a", shell.run("touch a"));
    expect(rows()[0]!.classList.contains("done")).toBe(true);
    expect(screen.element.querySelector(".progress-label")?.textContent).toBe("1 of 3 done");
    expect(screen.element.querySelector<HTMLElement>(".progress-bar")?.style.width).toBe("33%");
  });

  it("reports which task was tapped", () => {
    const { root, trainer } = makeFixture();
    const onSelect = vi.fn();
    const screen = createTasksScreen(root, trainer, { onSelect });
    screen.element.querySelectorAll<HTMLButtonElement>(".task-row")[2]!.click();
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
