import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type App } from "../src/app";
import type { NativeBridge } from "../src/native";
import { PREFERENCES_KEY } from "../src/preferences";
import { memoryStorage } from "./helpers";

let app: App;
let native: NativeBridge;
let storage: ReturnType<typeof memoryStorage>;

const type = (text: string) => {
  app.practice.terminal.input.value = text;
  app.practice.terminal.input.dispatchEvent(new Event("input", { bubbles: true }));
};
const run = (line: string) => {
  type(line);
  app.practice.terminal.sendKey("Enter");
};
const output = () => app.practice.element.querySelector(".terminal-output")!.textContent ?? "";

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  storage = memoryStorage();
  native = { isNative: true, setup: async () => {}, hapticSuccess: vi.fn(), hapticTap: vi.fn(), onBackButton: vi.fn(), onKeyboard: vi.fn() };
  app = createApp(document.getElementById("root")!, { storage, native, version: "9.9.9" });
});

describe("mobile app", () => {
  it("mounts three tabs with Practice selected and the task shown", () => {
    expect(app.tabs.current).toBe("practice");
    expect(app.element.querySelectorAll('[role="tab"]').length).toBe(3);
    expect(output()).toContain("Welcome");
    expect(app.practice.element.querySelector(".task-title")?.textContent).toBe(app.trainer.current.title);
  });

  it("solving a task buzzes and toasts", () => {
    run("pwd");
    expect(native.hapticSuccess).toHaveBeenCalledTimes(1);
    expect(app.element.querySelector(".toast")?.textContent).toBe("✓ Solved!");
    expect(app.element.querySelector(".toast")?.classList.contains("toast-visible")).toBe(true);
  });

  it("tapping a task in the list jumps to it on the Practice tab", () => {
    app.tabs.select("tasks");
    app.tasks.element.querySelectorAll<HTMLButtonElement>(".task-row")[4]!.click();
    expect(app.tabs.current).toBe("practice");
    expect(app.trainer.progress.index).toBe(4);
    expect(output()).toContain("Task 5 of");
  });

  it("'Try it' in Learn puts the command on the input line", () => {
    app.tabs.select("learn");
    app.learn.showCommand("grep");
    app.learn.element.querySelector<HTMLButtonElement>(".try-button")!.click();
    expect(app.tabs.current).toBe("practice");
    expect(app.practice.terminal.input.value).toBe("grep ");
  });

  it("the back button closes settings, leaves Learn detail, returns to Practice, then exits", () => {
    app.settings.open();
    expect(app.back()).toBe(true);
    expect(app.settings.isOpen()).toBe(false);
    app.tabs.select("learn");
    app.learn.showCommand("ls");
    expect(app.back()).toBe(true);
    expect(app.learn.isDetailOpen()).toBe(false);
    expect(app.back()).toBe(true);
    expect(app.tabs.current).toBe("practice");
    expect(app.back()).toBe(false);
    expect(native.onBackButton).toHaveBeenCalled();
  });

  it("marks the keyboard as open while the input has focus", () => {
    app.practice.terminal.input.dispatchEvent(new Event("focus"));
    expect(app.element.classList.contains("keyboard-open")).toBe(true);
    expect(app.practice.element.querySelector(".task-card")?.classList.contains("collapsed")).toBe(true);
    app.practice.terminal.input.dispatchEvent(new Event("blur"));
    expect(app.element.classList.contains("keyboard-open")).toBe(false);
  });

  it("persists the font size and progress", () => {
    app.settings.open();
    app.settings.element.querySelector<HTMLButtonElement>('[data-size="large"]')!.click();
    expect(JSON.parse(storage.getItem(PREFERENCES_KEY)!).fontSize).toBe("large");
    expect(app.practice.terminal.element.style.getPropertyValue("--terminal-font-size")).toBe("17px");
    run("pwd");
    document.body.innerHTML = '<div id="root"></div>';
    const again = createApp(document.getElementById("root")!, { storage, native });
    expect(again.trainer.progress.done).toBe(1);
    expect(again.practice.terminal.element.style.getPropertyValue("--terminal-font-size")).toBe("17px");
    expect(again.element.textContent).toContain("dev");
  });

  it("reset progress from settings starts over", () => {
    run("pwd");
    app.settings.open();
    app.settings.element.querySelector<HTMLButtonElement>(".reset-button")!.click();
    app.settings.element.querySelector<HTMLButtonElement>(".reset-confirm")!.click();
    expect(app.trainer.progress).toMatchObject({ done: 0, index: 0 });
    expect(output()).toContain("Task 1 of");
  });
});
