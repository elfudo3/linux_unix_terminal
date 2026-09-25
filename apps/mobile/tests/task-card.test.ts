import { describe, expect, it, vi } from "vitest";
import { createTaskCard } from "../src/components/task-card";
import { makeFixture } from "./helpers";

describe("task card", () => {
  it("shows the current task and routes buttons to commands", () => {
    const { root, trainer } = makeFixture();
    const onCommand = vi.fn();
    const card = createTaskCard(root, trainer, { onCommand });
    expect(card.element.querySelector(".task-title")?.textContent).toBe("Make a");
    expect(card.element.querySelector(".task-meta")?.textContent).toBe("Task 1 of 3 · Basics");
    expect(card.element.querySelector(".task-text")?.textContent).toBe("Create a file named a.");
    card.element.querySelector<HTMLButtonElement>('[data-cmd="hint"]')!.click();
    card.element.querySelector<HTMLButtonElement>('[data-cmd="skip"]')!.click();
    expect(onCommand.mock.calls.map((c) => c[0])).toEqual(["hint", "skip"]);
  });

  it("enables Next and shows a solved state after the task is done", () => {
    const { root, shell, trainer } = makeFixture();
    const card = createTaskCard(root, trainer, { onCommand: vi.fn() });
    const next = card.element.querySelector<HTMLButtonElement>('[data-cmd="next"]')!;
    expect(next.disabled).toBe(true);
    trainer.afterCommand("touch a", shell.run("touch a"));
    expect(next.disabled).toBe(false);
    expect(card.element.classList.contains("solved")).toBe(true);
    expect(card.element.querySelector(".task-status")?.textContent).toMatch(/solved/i);
  });

  it("collapses and expands from the header, reporting the change", () => {
    const { root, trainer } = makeFixture();
    const onToggle = vi.fn();
    const card = createTaskCard(root, trainer, { onCommand: vi.fn(), collapsed: true, onToggle });
    const header = card.element.querySelector<HTMLButtonElement>(".task-card-header")!;
    expect(card.element.classList.contains("collapsed")).toBe(true);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    header.click();
    expect(card.element.classList.contains("collapsed")).toBe(false);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("re-renders when the trainer moves to another task", () => {
    const { root, trainer } = makeFixture();
    const card = createTaskCard(root, trainer, { onCommand: vi.fn() });
    trainer.skip();
    expect(card.element.querySelector(".task-title")?.textContent).toBe("Make b");
  });
});
