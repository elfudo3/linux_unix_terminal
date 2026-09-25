// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTerminal, type TerminalView } from "../../src/ui/terminal";

let root: HTMLElement;
let view: TerminalView;
let submitted: string[];
let history: string[];

const key = (init: KeyboardEventInit) => view.input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
const type = (text: string) => (view.input.value = text);
const outputText = () => root.querySelector(".terminal-output")!.textContent ?? "";

beforeEach(() => {
  document.body.innerHTML = '<div id="t"></div>';
  root = document.getElementById("t")!;
  submitted = [];
  history = [];
  view = createTerminal(root, {
    prompt: () => "user@sandbox:~$ ",
    onSubmit: (line) => {
      submitted.push(line);
      if (line.trim()) history.push(line);
    },
    history: () => history,
    complete: (line) => (line === "ec" ? { line: "echo ", candidates: ["echo"] } : { line, candidates: ["cat", "cd"] }),
    maxChunks: 5,
  });
});

describe("terminal view", () => {
  it("echoes the prompt and command, then hands the line to onSubmit", () => {
    type("echo hi");
    key({ key: "Enter" });
    expect(submitted).toEqual(["echo hi"]);
    expect(outputText()).toContain("user@sandbox:~$ echo hi");
    expect(view.input.value).toBe("");
  });

  it("prints stdout, stderr and info chunks with distinct classes", () => {
    view.print("out\n");
    view.print("bad\n", "stderr");
    view.print("note", "info");
    expect(root.querySelector(".line-stdout")?.textContent).toBe("out\n");
    expect(root.querySelector(".line-stderr")?.textContent).toBe("bad\n");
    expect(root.querySelector(".line-info")?.textContent).toBe("note");
    view.print("");
    expect(root.querySelectorAll(".terminal-output > *").length).toBe(3);
  });

  it("walks history with the arrow keys and keeps the draft", () => {
    history.push("first", "second");
    type("draft");
    key({ key: "ArrowUp" });
    expect(view.input.value).toBe("second");
    key({ key: "ArrowUp" });
    expect(view.input.value).toBe("first");
    key({ key: "ArrowUp" });
    expect(view.input.value).toBe("first");
    key({ key: "ArrowDown" });
    expect(view.input.value).toBe("second");
    key({ key: "ArrowDown" });
    expect(view.input.value).toBe("draft");
  });

  it("completes with Tab and lists candidates when ambiguous", () => {
    type("ec");
    key({ key: "Tab" });
    expect(view.input.value).toBe("echo ");
    type("c");
    key({ key: "Tab" });
    expect(view.input.value).toBe("c");
    expect(outputText()).toContain("cat  cd");
  });

  it("clears with Ctrl+L and cancels a line with Ctrl+C", () => {
    view.print("old");
    key({ key: "l", ctrlKey: true });
    expect(outputText()).toBe("");
    type("half typed");
    key({ key: "c", ctrlKey: true });
    expect(view.input.value).toBe("");
    expect(outputText()).toContain("half typed^C");
    expect(submitted).toEqual([]);
  });

  it("submit() runs a line programmatically, as if typed", () => {
    view.submit("pwd");
    expect(submitted).toEqual(["pwd"]);
    expect(outputText()).toContain("user@sandbox:~$ pwd");
  });

  it("keeps only the newest chunks so the DOM stays small", () => {
    for (let i = 0; i < 12; i++) view.print(`line ${i}`);
    const chunks = root.querySelectorAll(".terminal-output > *");
    expect(chunks.length).toBe(5);
    expect(chunks[0]?.textContent).toBe("line 7");
  });

  it("focuses the input when the terminal is clicked", () => {
    const focus = vi.spyOn(view.input, "focus");
    root.querySelector(".terminal")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(focus).toHaveBeenCalled();
  });
});
