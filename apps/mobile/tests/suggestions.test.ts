import { describe, expect, it, vi } from "vitest";
import { Shell, VirtualFS } from "@terminal-trainer/core";
import { STARTER_COMMANDS, applySuggestion, createSuggestionBar, suggestionsFor } from "../src/components/suggestions";

function makeShell() {
  const fs = new VirtualFS();
  fs.mkdir("/home/user/docs", { parents: true });
  fs.writeFile("/home/user/notes.txt", "");
  fs.writeFile("/home/user/docs/report.md", "");
  return new Shell({ fs, cwd: "/home/user" });
}

describe("suggestionsFor", () => {
  it("offers starter commands on an empty line", () => {
    expect(suggestionsFor(makeShell(), "")).toEqual(STARTER_COMMANDS.filter((n) => n !== "task" && n !== "hint"));
  });

  it("offers matching commands, then files, capped at the limit", () => {
    const shell = makeShell();
    expect(suggestionsFor(shell, "c")).toEqual(expect.arrayContaining(["cat", "cd", "cp"]));
    expect(suggestionsFor(shell, "c", 2).length).toBe(2);
    expect(suggestionsFor(shell, "cat ")).toEqual(["docs/", "notes.txt"]);
    expect(suggestionsFor(shell, "cat docs/")).toEqual(["docs/report.md"]);
    expect(suggestionsFor(shell, "cat zzz")).toEqual([]);
  });
});

describe("applySuggestion", () => {
  it("replaces the current word and adds a space after files but not directories", () => {
    expect(applySuggestion("cat no", "notes.txt")).toBe("cat notes.txt ");
    expect(applySuggestion("cd d", "docs/")).toBe("cd docs/");
    expect(applySuggestion("", "ls")).toBe("ls ");
    expect(applySuggestion("cat docs/re", "docs/report.md")).toBe("cat docs/report.md ");
  });
});

describe("suggestion bar", () => {
  it("renders chips with short labels and reports picks", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const onPick = vi.fn();
    const bar = createSuggestionBar(document.getElementById("root")!, { onPick });
    expect(bar.element.hidden).toBe(true);
    bar.update(["docs/report.md", "docs/archive/"]);
    const chips = [...bar.element.querySelectorAll("button")];
    expect(chips.map((c) => c.textContent)).toEqual(["report.md", "archive/"]);
    expect(bar.element.hidden).toBe(false);
    chips[0]!.click();
    expect(onPick).toHaveBeenCalledWith("docs/report.md");
    bar.update([]);
    expect(bar.element.hidden).toBe(true);
  });
});
