import { describe, expect, it } from "vitest";
import { makeShell, out } from "../../helpers";

describe("ls", () => {
  it("lists the current directory one entry per line, hiding dotfiles", () => {
    expect(out(makeShell(), "ls")).toBe("docs\nnotes.txt\nsrc\n");
  });

  it("shows dotfiles with -a", () => {
    expect(out(makeShell(), "ls -a")).toBe(".\n..\n.secret\ndocs\nnotes.txt\nsrc\n");
  });

  it("lists a given directory or file", () => {
    const shell = makeShell();
    expect(out(shell, "ls docs")).toBe("archive\nreport.md\n");
    expect(out(shell, "ls notes.txt")).toBe("notes.txt\n");
  });

  it("labels each directory when several are given", () => {
    expect(out(makeShell(), "ls docs src")).toBe("docs:\narchive\nreport.md\n\nsrc:\napp.js\napp.py\n");
  });

  it("prints a long listing with -l", () => {
    const lines = out(makeShell(), "ls -l").split("\n");
    expect(lines[0]).toMatch(/^drwxr-xr-x\s+1 user user\s+4096 \w{3} [ \d]\d \d\d:\d\d docs$/);
    expect(lines[1]).toMatch(/^-rw-r--r--\s+1 user user\s+28 \w{3} [ \d]\d \d\d:\d\d notes\.txt$/);
  });

  it("marks directories with / when -F is given", () => {
    expect(out(makeShell(), "ls -F")).toBe("docs/\nnotes.txt\nsrc/\n");
  });

  it("reports missing paths and keeps going", () => {
    const result = makeShell().run("ls nope src");
    expect(result.stderr).toBe("ls: cannot access 'nope': No such file or directory\n");
    expect(result.stdout).toBe("src:\napp.js\napp.py\n");
    expect(result.code).toBe(2);
  });

  it("rejects unknown options", () => {
    expect(makeShell().run("ls -z")).toMatchObject({ stderr: "ls: invalid option -- 'z'\n", code: 1 });
  });
});

describe("pwd and cd", () => {
  it("pwd prints the working directory", () => {
    expect(out(makeShell(), "pwd")).toBe("/home/user\n");
  });

  it("cd - prints the directory it switched to", () => {
    const shell = makeShell();
    shell.run("cd /tmp");
    expect(out(shell, "cd -")).toBe("/home/user\n");
  });

  it("cd rejects extra arguments", () => {
    expect(makeShell().run("cd a b").stderr).toBe("bash: cd: too many arguments\n");
  });
});

describe("tree", () => {
  it("draws the directory tree", () => {
    expect(out(makeShell(), "tree docs")).toBe(
      ["docs", "├── archive", "│   └── old.log", "└── report.md", "", "1 directory, 2 files", ""].join("\n"),
    );
  });
});
