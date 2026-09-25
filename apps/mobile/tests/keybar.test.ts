import { describe, expect, it, vi } from "vitest";
import { DEFAULT_KEYS, createKeyBar } from "../src/components/keybar";

describe("key bar", () => {
  it("renders every key and routes taps to insert or sendKey", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const terminal = { insert: vi.fn(), sendKey: vi.fn(), input: document.createElement("input") };
    const bar = createKeyBar(document.getElementById("root")!, terminal);
    const buttons = [...bar.querySelectorAll<HTMLButtonElement>(".keybar-key")];
    expect(buttons.length).toBe(DEFAULT_KEYS.length);
    buttons.find((b) => b.textContent === "|")!.click();
    expect(terminal.insert).toHaveBeenCalledWith(" | ");
    buttons.find((b) => b.textContent === "Tab")!.click();
    expect(terminal.sendKey).toHaveBeenCalledWith("Tab");
    expect(buttons.find((b) => b.textContent === "^C")!.getAttribute("aria-label")).toBe("Cancel line");
  });

  it("keeps the terminal input focused by cancelling pointerdown", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const bar = createKeyBar(document.getElementById("root")!, { insert: vi.fn(), sendKey: vi.fn(), input: document.createElement("input") });
    const event = new Event("pointerdown", { bubbles: true, cancelable: true });
    bar.querySelector("button")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("has a button that hides the keyboard by blurring the input", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const input = document.createElement("input");
    const blur = vi.spyOn(input, "blur");
    const bar = createKeyBar(document.getElementById("root")!, { insert: vi.fn(), sendKey: vi.fn(), input });
    bar.querySelector<HTMLButtonElement>(".keybar-hide")!.click();
    expect(blur).toHaveBeenCalled();
  });
});
