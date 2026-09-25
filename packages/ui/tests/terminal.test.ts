import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTerminal, type TerminalView } from "../src/terminal";

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

  it("lets Ctrl+C copy when text is selected instead of cancelling", () => {
    type("copy me");
    view.input.setSelectionRange(0, 4);
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "c", ctrlKey: true });
    view.input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(view.input.value).toBe("copy me");
    expect(outputText()).not.toContain("^C");
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

describe("terminal view: touch helpers", () => {
  it("insert() adds text at the caret, replacing any selection, and keeps focus", () => {
    const focus = vi.spyOn(view.input, "focus");
    type("cat file");
    view.input.setSelectionRange(3, 3);
    view.insert(" -n");
    expect(view.input.value).toBe("cat -n file");
    expect(view.input.selectionStart).toBe(6);
    view.input.setSelectionRange(0, 3);
    view.insert("head");
    expect(view.input.value).toBe("head -n file");
    expect(focus).toHaveBeenCalled();
  });

  it("sendKey() drives completion, history, submit and control keys", () => {
    history.push("older", "newest");
    type("ec");
    view.sendKey("Tab");
    expect(view.input.value).toBe("echo ");
    view.sendKey("ArrowUp");
    expect(view.input.value).toBe("newest");
    view.sendKey("ArrowUp");
    expect(view.input.value).toBe("older");
    view.sendKey("ArrowDown");
    expect(view.input.value).toBe("newest");
    view.sendKey("Enter");
    expect(submitted).toEqual(["newest"]);
    type("abandon");
    view.sendKey("ctrl+c");
    expect(view.input.value).toBe("");
    expect(outputText()).toContain("abandon^C");
    view.sendKey("ctrl+l");
    expect(outputText()).toBe("");
    type("wipe me");
    view.sendKey("ctrl+u");
    expect(view.input.value).toBe("");
  });

  it("can be told not to focus on click, for touch screens", () => {
    document.body.innerHTML = '<div id="t2"></div>';
    const quiet = createTerminal(document.getElementById("t2")!, {
      prompt: () => "$ ",
      onSubmit: () => {},
      history: () => [],
      focusOnClick: false,
    });
    const focus = vi.spyOn(quiet.input, "focus");
    quiet.element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(focus).not.toHaveBeenCalled();
  });
});

describe("terminal view: docked layout", () => {
  it("can dock the input line below a scrolling output area and show a Run button", () => {
    document.body.innerHTML = '<div id="t3"></div>';
    const lines: string[] = [];
    const docked = createTerminal(document.getElementById("t3")!, {
      prompt: () => "$ ",
      onSubmit: (line) => lines.push(line),
      history: () => [],
      dockInput: true,
      submitButton: "Run",
    });
    expect(docked.element.classList.contains("terminal-docked")).toBe(true);
    const button = docked.element.querySelector<HTMLButtonElement>(".terminal-run")!;
    expect(button.getAttribute("aria-label")).toBe("Run");
    docked.input.value = "pwd";
    button.click();
    expect(lines).toEqual(["pwd"]);
  });
});
