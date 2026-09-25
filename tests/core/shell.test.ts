import { describe, expect, it } from "vitest";
import { VirtualFS } from "../../src/core/filesystem";
import { Shell } from "../../src/core/shell";

function makeShell() {
  const fs = new VirtualFS();
  fs.mkdir("/home/user/docs", { parents: true });
  fs.mkdir("/tmp");
  fs.writeFile("/home/user/a.txt", "banana\napple\n");
  fs.writeFile("/home/user/b.txt", "b\n");
  fs.writeFile("/home/user/docs/c.md", "# c\n");
  return new Shell({ fs, cwd: "/home/user" });
}

describe("Shell basics", () => {
  it("runs a command and returns its output and exit code", () => {
    const shell = makeShell();
    expect(shell.run("echo hello world")).toEqual({ stdout: "hello world\n", stderr: "", code: 0, clear: false });
  });

  it("does nothing for an empty line", () => {
    expect(makeShell().run("   ")).toEqual({ stdout: "", stderr: "", code: 0, clear: false });
  });

  it("reports unknown commands like bash does", () => {
    const result = makeShell().run("frobnicate");
    expect(result.stderr).toBe("bash: frobnicate: command not found\n");
    expect(result.code).toBe(127);
  });

  it("reports syntax errors", () => {
    const result = makeShell().run("ls |");
    expect(result.stderr).toMatch(/syntax error/);
    expect(result.code).toBe(2);
  });

  it("recovers if a command throws unexpectedly", () => {
    const shell = makeShell();
    shell.register({
      name: "boom",
      summary: "",
      usage: "boom",
      run: () => {
        throw new Error("kaboom");
      },
    });
    expect(shell.run("boom")).toMatchObject({ stderr: "boom: kaboom\n", code: 1 });
  });
});

describe("Working directory", () => {
  it("cd changes the directory and pwd prints it", () => {
    const shell = makeShell();
    expect(shell.run("cd docs").code).toBe(0);
    expect(shell.run("pwd").stdout).toBe("/home/user/docs\n");
    shell.run("cd ..");
    expect(shell.cwd).toBe("/home/user");
    shell.run("cd /tmp");
    expect(shell.cwd).toBe("/tmp");
  });

  it("cd with no argument or ~ goes home, and cd - goes back", () => {
    const shell = makeShell();
    shell.run("cd /tmp");
    shell.run("cd");
    expect(shell.cwd).toBe("/home/user");
    shell.run("cd /tmp");
    shell.run("cd ~/docs");
    expect(shell.cwd).toBe("/home/user/docs");
    shell.run("cd -");
    expect(shell.cwd).toBe("/tmp");
  });

  it("cd into a missing or non-directory path fails clearly", () => {
    const shell = makeShell();
    expect(shell.run("cd nope")).toMatchObject({ stderr: "bash: cd: nope: No such file or directory\n", code: 1 });
    expect(shell.run("cd a.txt")).toMatchObject({ stderr: "bash: cd: a.txt: Not a directory\n", code: 1 });
    expect(shell.cwd).toBe("/home/user");
  });

  it("shows the prompt with ~ for the home directory", () => {
    const shell = makeShell();
    expect(shell.prompt()).toBe("user@sandbox:~$ ");
    shell.run("cd docs");
    expect(shell.prompt()).toBe("user@sandbox:~/docs$ ");
    shell.run("cd /");
    expect(shell.prompt()).toBe("user@sandbox:/$ ");
  });
});

describe("Pipes and redirects", () => {
  it("pipes stdout of one command into the next", () => {
    expect(makeShell().run("cat a.txt | sort").stdout).toBe("apple\nbanana\n");
  });

  it("uses the exit code of the last command in a pipeline", () => {
    const shell = makeShell();
    expect(shell.run("cat missing | sort").code).toBe(0);
    expect(shell.run("echo hi | cat missing").code).toBe(1);
  });

  it("writes and appends with > and >>", () => {
    const shell = makeShell();
    shell.run("echo one > out.txt");
    expect(shell.fs.readFile("/home/user/out.txt")).toBe("one\n");
    shell.run("echo two >> out.txt");
    expect(shell.fs.readFile("/home/user/out.txt")).toBe("one\ntwo\n");
    expect(shell.run("echo three > out.txt").stdout).toBe("");
    expect(shell.fs.readFile("/home/user/out.txt")).toBe("three\n");
  });

  it("reads stdin from a file with <", () => {
    expect(makeShell().run("sort < a.txt").stdout).toBe("apple\nbanana\n");
  });

  it("reports redirect targets that cannot be opened", () => {
    const shell = makeShell();
    expect(shell.run("echo hi > nope/x.txt")).toMatchObject({ stderr: "bash: nope/x.txt: No such file or directory\n", code: 1 });
    expect(shell.run("sort < missing.txt")).toMatchObject({ stderr: "bash: missing.txt: No such file or directory\n", code: 1 });
  });
});

describe("Command lists", () => {
  it("runs commands in sequence with ;", () => {
    expect(makeShell().run("echo a; echo b").stdout).toBe("a\nb\n");
  });

  it("stops after a failure with && and continues with ||", () => {
    const shell = makeShell();
    expect(shell.run("cat missing && echo yes").stdout).toBe("");
    expect(shell.run("cat missing || echo fallback").stdout).toBe("fallback\n");
    expect(shell.run("echo ok && echo also").stdout).toBe("ok\nalso\n");
  });

  it("exposes the last exit code as $?", () => {
    const shell = makeShell();
    expect(shell.run("cat missing; echo $?").stdout).toBe("1\n");
    expect(shell.run("echo $?").stdout).toBe("0\n");
  });
});

describe("Expansion", () => {
  it("expands globs against the filesystem, sorted", () => {
    const shell = makeShell();
    expect(shell.run("echo *.txt").stdout).toBe("a.txt b.txt\n");
    expect(shell.run("echo docs/*").stdout).toBe("docs/c.md\n");
  });

  it("leaves globs alone when quoted or when nothing matches", () => {
    const shell = makeShell();
    expect(shell.run("echo '*.txt'").stdout).toBe("*.txt\n");
    expect(shell.run("echo *.zip").stdout).toBe("*.zip\n");
  });

  it("expands ~ to the home directory", () => {
    const shell = makeShell();
    expect(shell.run("echo ~").stdout).toBe("/home/user\n");
    expect(shell.run("echo ~/docs").stdout).toBe("/home/user/docs\n");
    expect(shell.run("echo '~'").stdout).toBe("~\n");
  });

  it("supports variables via export and plain assignment", () => {
    const shell = makeShell();
    expect(shell.run("export NAME=World; echo hello $NAME").stdout).toBe("hello World\n");
    expect(shell.run("GREETING=hi; echo $GREETING").stdout).toBe("hi\n");
    expect(shell.run("echo $HOME $USER").stdout).toBe("/home/user user\n");
  });
});

describe("History and misc", () => {
  it("records non-empty lines in history", () => {
    const shell = makeShell();
    shell.run("echo one");
    shell.run("   ");
    shell.run("echo two");
    expect(shell.history).toEqual(["echo one", "echo two"]);
  });

  it("propagates a clear request from the clear command", () => {
    expect(makeShell().run("clear").clear).toBe(true);
  });

  it("lists registered command names", () => {
    expect(makeShell().commandNames()).toContain("ls");
  });
});

describe("Reset", () => {
  it("swaps in a fresh filesystem and returns home", () => {
    const shell = makeShell();
    shell.run("cd docs");
    shell.run("rm /home/user/a.txt");
    const fresh = new VirtualFS();
    fresh.mkdir("/home/user", { parents: true });
    fresh.writeFile("/home/user/a.txt", "back");
    shell.resetFilesystem(fresh);
    expect(shell.cwd).toBe("/home/user");
    expect(shell.run("cat a.txt").stdout).toBe("back");
    expect(shell.run("cd -").stdout).toBe("/home/user\n");
  });
});
