import { describe, expect, it } from "vitest";
import { makeShell, out } from "../../helpers";

describe("system commands", () => {
  it("whoami, hostname and uname", () => {
    const shell = makeShell();
    expect(out(shell, "whoami")).toBe("user\n");
    expect(out(shell, "hostname")).toBe("sandbox\n");
    expect(out(shell, "uname")).toBe("Linux\n");
    expect(out(shell, "uname -a")).toMatch(/^Linux sandbox/);
  });

  it("date prints something date-shaped", () => {
    expect(out(makeShell(), "date")).toMatch(/^\w{3} \w{3} [ \d]\d \d\d:\d\d:\d\d \w+ \d{4}\n$/);
  });

  it("history lists numbered commands and -c clears it", () => {
    const shell = makeShell();
    shell.run("ls");
    shell.run("pwd");
    expect(out(shell, "history")).toBe("    1  ls\n    2  pwd\n    3  history\n");
    shell.run("history -c");
    expect(shell.history).toEqual([]);
  });

  it("env, printenv and export", () => {
    const shell = makeShell();
    expect(out(shell, "printenv HOME")).toBe("/home/user\n");
    expect(out(shell, "env")).toContain("USER=user\n");
    shell.run("export EDITOR=vim");
    expect(out(shell, "printenv EDITOR")).toBe("vim\n");
    expect(out(shell, "export")).toContain("declare -x EDITOR=\"vim\"\n");
    shell.run("unset EDITOR");
    expect(shell.run("printenv EDITOR").code).toBe(1);
  });

  it("true and false set exit codes", () => {
    const shell = makeShell();
    expect(shell.run("true").code).toBe(0);
    expect(shell.run("false").code).toBe(1);
  });
});

describe("help and man", () => {
  it("help lists commands grouped by category, in the curated order", () => {
    const text = out(makeShell(), "help");
    expect(text.startsWith("Navigation\n")).toBe(true);
    expect(text).toMatch(/Files/);
    expect(text).toMatch(/^\s+ls\s+list directory contents$/m);
    expect(text.indexOf("Navigation")).toBeLessThan(text.indexOf("Help"));
  });

  it("man shows the usage and details of one command", () => {
    const shell = makeShell();
    const text = out(shell, "man grep");
    expect(text).toContain("grep [options] pattern [file...]");
    expect(text).toContain("-i");
    expect(out(shell, "help grep")).toBe(text);
    expect(shell.run("man nope").stderr).toBe("No manual entry for nope\n");
    expect(shell.run("man").stderr).toBe("What manual page do you want?\n");
  });
});
