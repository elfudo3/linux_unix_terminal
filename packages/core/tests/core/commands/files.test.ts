import { describe, expect, it } from "vitest";
import { makeShell, out } from "../../helpers";

describe("cat", () => {
  it("prints files in order and numbers lines with -n", () => {
    const shell = makeShell();
    expect(out(shell, "cat notes.txt")).toBe("Buy milk\nCall Bob\nbuy bread\n");
    expect(out(shell, "cat -n notes.txt")).toBe("     1\tBuy milk\n     2\tCall Bob\n     3\tbuy bread\n");
    expect(out(shell, "cat /etc/hosts notes.txt")).toBe("127.0.0.1 localhost\nBuy milk\nCall Bob\nbuy bread\n");
  });

  it("echoes stdin when no file is given", () => {
    expect(out(makeShell(), "echo hi | cat")).toBe("hi\n");
  });

  it("reports errors per file", () => {
    const result = makeShell().run("cat nope docs");
    expect(result.stderr).toBe("cat: nope: No such file or directory\ncat: docs: Is a directory\n");
    expect(result.code).toBe(1);
  });
});

describe("touch and mkdir", () => {
  it("touch creates empty files and leaves existing ones alone", () => {
    const shell = makeShell();
    shell.run("touch new.txt notes.txt");
    expect(shell.fs.readFile("/home/user/new.txt")).toBe("");
    expect(shell.fs.readFile("/home/user/notes.txt")).toBe("Buy milk\nCall Bob\nbuy bread\n");
    expect(shell.run("touch nope/x").stderr).toBe("touch: cannot touch 'nope/x': No such file or directory\n");
  });

  it("mkdir creates directories, nested only with -p", () => {
    const shell = makeShell();
    shell.run("mkdir projects");
    expect(shell.fs.isDir("/home/user/projects")).toBe(true);
    expect(shell.run("mkdir a/b/c").stderr).toBe("mkdir: cannot create directory 'a/b/c': No such file or directory\n");
    expect(shell.run("mkdir -p a/b/c").code).toBe(0);
    expect(shell.fs.isDir("/home/user/a/b/c")).toBe(true);
    expect(shell.run("mkdir docs").stderr).toBe("mkdir: cannot create directory 'docs': File exists\n");
    expect(shell.run("mkdir").stderr).toBe("mkdir: missing operand\n");
  });
});

describe("rm and rmdir", () => {
  it("rm deletes files and needs -r for directories", () => {
    const shell = makeShell();
    expect(shell.run("rm notes.txt").code).toBe(0);
    expect(shell.fs.exists("/home/user/notes.txt")).toBe(false);
    expect(shell.run("rm docs").stderr).toBe("rm: cannot remove 'docs': Is a directory\n");
    expect(shell.run("rm -r docs").code).toBe(0);
    expect(shell.fs.exists("/home/user/docs")).toBe(false);
  });

  it("rm -f ignores missing files", () => {
    const shell = makeShell();
    expect(shell.run("rm nope").stderr).toBe("rm: cannot remove 'nope': No such file or directory\n");
    expect(shell.run("rm -f nope")).toMatchObject({ stderr: "", code: 0 });
  });

  it("rm refuses to delete the root", () => {
    expect(makeShell().run("rm -rf /").stderr).toMatch(/dangerous/);
  });

  it("rmdir removes only empty directories", () => {
    const shell = makeShell();
    expect(shell.run("rmdir docs").stderr).toBe("rmdir: failed to remove 'docs': Directory not empty\n");
    shell.run("mkdir empty");
    expect(shell.run("rmdir empty").code).toBe(0);
    expect(shell.fs.exists("/home/user/empty")).toBe(false);
  });
});

describe("cp and mv", () => {
  it("cp copies a file to a new name or into a directory", () => {
    const shell = makeShell();
    shell.run("cp notes.txt copy.txt");
    expect(shell.fs.readFile("/home/user/copy.txt")).toBe("Buy milk\nCall Bob\nbuy bread\n");
    shell.run("cp notes.txt docs");
    expect(shell.fs.exists("/home/user/docs/notes.txt")).toBe(true);
  });

  it("cp needs -r for directories and a directory target for many sources", () => {
    const shell = makeShell();
    expect(shell.run("cp docs backup").stderr).toBe("cp: -r not specified; omitting directory 'docs'\n");
    expect(shell.run("cp -r docs backup").code).toBe(0);
    expect(shell.fs.exists("/home/user/backup/report.md")).toBe(true);
    expect(shell.run("cp notes.txt src/app.py nope").stderr).toBe("cp: target 'nope' is not a directory\n");
    expect(shell.run("cp notes.txt").stderr).toBe("cp: missing destination file operand after 'notes.txt'\n");
    expect(shell.run("cp nope x").stderr).toBe("cp: cannot stat 'nope': No such file or directory\n");
  });

  it("mv renames and moves into directories", () => {
    const shell = makeShell();
    shell.run("mv notes.txt todo.txt");
    expect(shell.fs.exists("/home/user/notes.txt")).toBe(false);
    expect(shell.fs.exists("/home/user/todo.txt")).toBe(true);
    shell.run("mv todo.txt src/app.py docs");
    expect(shell.fs.exists("/home/user/docs/todo.txt")).toBe(true);
    expect(shell.fs.exists("/home/user/docs/app.py")).toBe(true);
    expect(shell.run("mv nope x").stderr).toBe("mv: cannot stat 'nope': No such file or directory\n");
  });
});

describe("chmod", () => {
  it("accepts numeric modes", () => {
    const shell = makeShell();
    shell.run("chmod 755 notes.txt");
    expect(shell.fs.stat("/home/user/notes.txt")!.mode).toBe(0o755);
  });

  it("accepts symbolic modes", () => {
    const shell = makeShell();
    shell.run("chmod +x notes.txt");
    expect(shell.fs.stat("/home/user/notes.txt")!.mode).toBe(0o755);
    shell.run("chmod go-rx notes.txt");
    expect(shell.fs.stat("/home/user/notes.txt")!.mode).toBe(0o700);
    shell.run("chmod u=rw,g=r,o= notes.txt");
    expect(shell.fs.stat("/home/user/notes.txt")!.mode).toBe(0o640);
    expect(out(shell, "ls -l notes.txt")).toMatch(/^-rw-r-----/);
  });

  it("rejects bad modes and missing files", () => {
    const shell = makeShell();
    expect(shell.run("chmod xyz notes.txt").stderr).toBe("chmod: invalid mode: 'xyz'\n");
    expect(shell.run("chmod 644 nope").stderr).toBe("chmod: cannot access 'nope': No such file or directory\n");
  });
});
