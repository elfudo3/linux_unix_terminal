import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../src/preferences";
import { createPracticeScreen } from "../src/screens/practice";
import { makeFixture } from "./helpers";

function make() {
  const fixture = makeFixture();
  const onSolved = vi.fn();
  const onPrefsChange = vi.fn();
  const screen = createPracticeScreen(fixture.root, { ...fixture, prefs: { ...DEFAULT_PREFERENCES }, onSolved, onPrefsChange });
  const type = (text: string) => {
    screen.terminal.input.value = text;
    screen.terminal.input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return { ...fixture, screen, onSolved, onPrefsChange, type };
}

describe("practice screen", () => {
  it("runs commands, prints output and checks the task", () => {
    const { screen, trainer, onSolved, type } = make();
    type("pwd");
    screen.terminal.sendKey("Enter");
    const output = screen.element.querySelector(".terminal-output")!.textContent;
    expect(output).toContain("/home/user");
    expect(onSolved).not.toHaveBeenCalled();
    type("touch a");
    screen.terminal.sendKey("Enter");
    expect(onSolved).toHaveBeenCalledTimes(1);
    expect(trainer.solved).toBe(true);
    expect(screen.element.querySelector(".terminal-output")!.textContent).toMatch(/Task complete/);
  });

  it("clears the screen when asked and prints errors", () => {
    const { screen, type } = make();
    type("nope");
    screen.terminal.sendKey("Enter");
    expect(screen.element.querySelector(".line-stderr")?.textContent).toContain("command not found");
    type("clear");
    screen.terminal.sendKey("Enter");
    expect(screen.element.querySelector(".terminal-output")!.textContent).toBe("");
  });

  it("updates suggestions while typing and applies a tapped chip", () => {
    const { screen, type } = make();
    const chips = () => [...screen.element.querySelectorAll<HTMLButtonElement>(".suggestions .chip")].map((c) => c.textContent);
    expect(chips()).toContain("ls");
    type("cat no");
    expect(chips()).toEqual(["notes.txt"]);
    screen.element.querySelector<HTMLButtonElement>(".suggestions .chip")!.click();
    expect(screen.terminal.input.value).toBe("cat notes.txt ");
    screen.terminal.sendKey("Enter");
    expect(chips()).toContain("ls");
  });

  it("has a key bar wired to the terminal and a collapsible task card", () => {
    const { screen, onPrefsChange } = make();
    [...screen.element.querySelectorAll<HTMLButtonElement>(".keybar-key")].find((b) => b.textContent === "~")!.click();
    expect(screen.terminal.input.value).toBe("~");
    screen.element.querySelector<HTMLButtonElement>(".task-card-header")!.click();
    expect(onPrefsChange).toHaveBeenCalledWith(expect.objectContaining({ taskCardCollapsed: true }));
  });

  it("collapses the task card while the keyboard is open, without touching the saved preference", () => {
    const { screen, onPrefsChange } = make();
    const card = screen.element.querySelector(".task-card")!;
    screen.setKeyboardOpen(true);
    expect(card.classList.contains("collapsed")).toBe(true);
    expect(onPrefsChange).not.toHaveBeenCalled();
    screen.element.querySelector<HTMLButtonElement>(".task-card-header")!.click();
    expect(card.classList.contains("collapsed")).toBe(false);
    expect(onPrefsChange).not.toHaveBeenCalled();
    screen.setKeyboardOpen(false);
    expect(card.classList.contains("collapsed")).toBe(false);
  });

  it("applies the font size preference to the terminal", () => {
    const { screen } = make();
    screen.setFontSize("large");
    expect(screen.terminal.element.style.getPropertyValue("--terminal-font-size")).toBe("17px");
  });
});
