import { describe, expect, it } from "vitest";
import { createSampleFS } from "../../src/core/sample-fs";
import { Shell } from "../../src/core/shell";

describe("sample filesystem", () => {
  const fs = createSampleFS();

  it("has a home directory with a few folders to explore", () => {
    expect(fs.isDir("/home/user")).toBe(true);
    for (const dir of ["documents", "projects", "data", "logs", "downloads"]) {
      expect(fs.isDir(`/home/user/${dir}`)).toBe(true);
    }
  });

  it("has system files that classic exercises use", () => {
    expect(fs.readFile("/etc/passwd")).toContain("user:");
    expect(fs.readFile("/etc/hostname")).toBe("sandbox\n");
    expect(fs.isDir("/tmp")).toBe(true);
    expect(fs.isDir("/var/log")).toBe(true);
  });

  it("has data files with predictable shapes for exercises", () => {
    expect(fs.readFile("/home/user/data/people.csv").split("\n")[0]).toBe("name,age,city");
    expect(fs.readFile("/home/user/logs/app.log")).toMatch(/ERROR/);
    expect(fs.stat("/home/user/projects/scripts/backup.sh")?.mode).toBe(0o644);
  });

  it("works as the shell's starting point", () => {
    const shell = new Shell({ fs: createSampleFS() });
    expect(shell.run("ls").stdout).toContain("documents\n");
    expect(shell.run("cat README.txt").code).toBe(0);
  });

  it("returns a fresh copy every time", () => {
    const a = createSampleFS();
    a.remove("/home/user/notes.txt");
    expect(createSampleFS().exists("/home/user/notes.txt")).toBe(true);
  });
});
