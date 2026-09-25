import { describe, expect, it } from "vitest";
import { makeShell, out } from "../../helpers";

describe("find", () => {
  it("lists everything under a path, depth first", () => {
    expect(out(makeShell(), "find docs")).toBe("docs\ndocs/archive\ndocs/archive/old.log\ndocs/report.md\n");
  });

  it("defaults to the current directory and prints ./ prefixes", () => {
    expect(out(makeShell(), "find")).toBe(
      ".\n./.secret\n./docs\n./docs/archive\n./docs/archive/old.log\n./docs/report.md\n./notes.txt\n./src\n./src/app.js\n./src/app.py\n",
    );
  });

  it("filters by -name, -iname and -type", () => {
    const shell = makeShell();
    expect(out(shell, "find . -name '*.py'")).toBe("./src/app.py\n");
    expect(out(shell, "find . -iname 'REPORT*'")).toBe("./docs/report.md\n");
    expect(out(shell, "find . -type d")).toBe(".\n./docs\n./docs/archive\n./src\n");
    expect(out(shell, "find docs -type f -name '*.log'")).toBe("docs/archive/old.log\n");
  });

  it("reports unknown paths and predicates", () => {
    const shell = makeShell();
    expect(shell.run("find nope").stderr).toBe("find: 'nope': No such file or directory\n");
    expect(shell.run("find . -size 1").stderr).toBe("find: unknown predicate `-size'\n");
  });
});

describe("which and xargs", () => {
  it("which locates known commands", () => {
    const shell = makeShell();
    expect(out(shell, "which ls")).toBe("/usr/bin/ls\n");
    expect(shell.run("which nope").code).toBe(1);
  });

  it("xargs feeds stdin as arguments", () => {
    const shell = makeShell();
    expect(out(shell, "echo notes.txt /etc/hosts | xargs wc -l")).toBe("3 notes.txt\n1 /etc/hosts\n4 total\n");
    expect(out(shell, "echo a b | xargs")).toBe("a b\n");
    expect(out(shell, "find src -name '*.js' | xargs cat")).toBe("console.log('hi')\n");
  });
});
