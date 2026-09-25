import { describe, expect, it } from "vitest";
import { complete } from "../../src/core/completion";
import { makeShell } from "../helpers";

describe("tab completion", () => {
  const shell = makeShell();

  it("completes a unique command name and adds a space", () => {
    expect(complete(shell, "whoa")).toEqual({ line: "whoami ", candidates: ["whoami"] });
  });

  it("lists candidates and fills the common prefix when several commands match", () => {
    const result = complete(shell, "c");
    expect(result.line).toBe("c");
    expect(result.candidates).toEqual(expect.arrayContaining(["cat", "cd", "chmod", "cp", "cut"]));
  });

  it("completes file names after the command", () => {
    expect(complete(shell, "cat no")).toEqual({ line: "cat notes.txt ", candidates: ["notes.txt"] });
  });

  it("completes directories with a trailing slash and no space", () => {
    expect(complete(shell, "cd do")).toEqual({ line: "cd docs/", candidates: ["docs/"] });
  });

  it("completes inside sub-directories and keeps ~", () => {
    expect(complete(shell, "cat docs/re").line).toBe("cat docs/report.md ");
    expect(complete(shell, "cd ~/do").line).toBe("cd ~/docs/");
    expect(complete(shell, "ls /et").line).toBe("ls /etc/");
  });

  it("extends to the longest common prefix when ambiguous", () => {
    expect(complete(shell, "ls src/a")).toEqual({ line: "ls src/app.", candidates: ["src/app.js", "src/app.py"] });
  });

  it("shows hidden files only when the word starts with a dot", () => {
    expect(complete(shell, "cat .").line).toBe("cat .secret ");
    expect(complete(shell, "cat ").candidates).toEqual(["docs/", "notes.txt", "src/"]);
  });

  it("completes a command name again after a pipe or ;", () => {
    expect(complete(shell, "ls | whi").line).toBe("ls | which ");
    expect(complete(shell, "cd docs; pw").line).toBe("cd docs; pwd ");
  });

  it("leaves the line alone when nothing matches", () => {
    expect(complete(shell, "cat zzz")).toEqual({ line: "cat zzz", candidates: [] });
  });

  it("lists every command on an empty line", () => {
    const result = complete(shell, "");
    expect(result.line).toBe("");
    expect(result.candidates).toEqual(shell.commandNames());
  });
});
