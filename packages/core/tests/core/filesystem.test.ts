import { describe, expect, it } from "vitest";
import { FsError, VirtualFS, resolvePath } from "../../src/core/filesystem";

describe("resolvePath", () => {
  it("keeps absolute paths and normalises them", () => {
    expect(resolvePath("/", "/home/user")).toBe("/");
    expect(resolvePath("/a/b/../c/./d", "/")).toBe("/a/c/d");
    expect(resolvePath("/a//b/", "/")).toBe("/a/b");
  });

  it("joins relative paths onto the current directory", () => {
    expect(resolvePath("docs", "/home/user")).toBe("/home/user/docs");
    expect(resolvePath("..", "/home/user")).toBe("/home");
    expect(resolvePath("../../etc", "/home/user")).toBe("/etc");
    expect(resolvePath(".", "/home/user")).toBe("/home/user");
  });

  it("never climbs above the root", () => {
    expect(resolvePath("../../../..", "/home")).toBe("/");
  });
});

describe("VirtualFS", () => {
  const make = () => {
    const fs = new VirtualFS();
    fs.mkdir("/home/user/docs", { parents: true });
    fs.writeFile("/home/user/docs/notes.txt", "hello\n");
    return fs;
  };

  it("starts with only the root directory", () => {
    const fs = new VirtualFS();
    expect(fs.isDir("/")).toBe(true);
    expect(fs.readdir("/")).toEqual([]);
  });

  it("creates nested directories with parents and lists them sorted", () => {
    const fs = make();
    fs.mkdir("/home/user/b");
    fs.mkdir("/home/user/a");
    expect(fs.readdir("/home/user")).toEqual(["a", "b", "docs"]);
  });

  it("refuses to create a directory whose parent is missing", () => {
    const fs = new VirtualFS();
    expect(() => fs.mkdir("/missing/child")).toThrow(FsError);
    expect(() => fs.mkdir("/missing/child")).toThrow(/No such file or directory/);
  });

  it("refuses to create a directory that already exists (unless parents)", () => {
    const fs = make();
    expect(() => fs.mkdir("/home")).toThrow(/File exists/);
    expect(() => fs.mkdir("/home", { parents: true })).not.toThrow();
  });

  it("reads and writes files, and can append", () => {
    const fs = make();
    expect(fs.readFile("/home/user/docs/notes.txt")).toBe("hello\n");
    fs.writeFile("/home/user/docs/notes.txt", "bye\n");
    expect(fs.readFile("/home/user/docs/notes.txt")).toBe("bye\n");
    fs.writeFile("/home/user/docs/notes.txt", "more\n", { append: true });
    expect(fs.readFile("/home/user/docs/notes.txt")).toBe("bye\nmore\n");
  });

  it("reports the right error when reading a missing file or a directory", () => {
    const fs = make();
    expect(() => fs.readFile("/nope")).toThrow(/No such file or directory/);
    expect(() => fs.readFile("/home")).toThrow(/Is a directory/);
    expect(() => fs.writeFile("/home", "x")).toThrow(/Is a directory/);
    expect(() => fs.readdir("/home/user/docs/notes.txt")).toThrow(/Not a directory/);
  });

  it("removes files, and directories only when asked recursively", () => {
    const fs = make();
    expect(() => fs.remove("/home/user/docs")).toThrow(/Is a directory/);
    fs.remove("/home/user/docs/notes.txt");
    expect(fs.exists("/home/user/docs/notes.txt")).toBe(false);
    fs.remove("/home", { recursive: true });
    expect(fs.exists("/home")).toBe(false);
    expect(() => fs.remove("/home")).toThrow(/No such file or directory/);
  });

  it("removes empty directories with rmdir semantics", () => {
    const fs = make();
    expect(() => fs.rmdir("/home/user/docs")).toThrow(/Directory not empty/);
    fs.mkdir("/empty");
    fs.rmdir("/empty");
    expect(fs.exists("/empty")).toBe(false);
  });

  it("copies files and directory trees", () => {
    const fs = make();
    fs.copy("/home/user/docs/notes.txt", "/home/user/copy.txt");
    expect(fs.readFile("/home/user/copy.txt")).toBe("hello\n");
    expect(() => fs.copy("/home/user/docs", "/backup")).toThrow(/Is a directory/);
    fs.copy("/home/user/docs", "/backup", { recursive: true });
    expect(fs.readFile("/backup/notes.txt")).toBe("hello\n");
    // The copy is independent of the original.
    fs.writeFile("/backup/notes.txt", "changed");
    expect(fs.readFile("/home/user/docs/notes.txt")).toBe("hello\n");
  });

  it("moves (renames) files and directories", () => {
    const fs = make();
    fs.move("/home/user/docs", "/home/user/papers");
    expect(fs.exists("/home/user/docs")).toBe(false);
    expect(fs.readFile("/home/user/papers/notes.txt")).toBe("hello\n");
    expect(() => fs.move("/nope", "/x")).toThrow(/No such file or directory/);
  });

  it("stores and changes permission modes", () => {
    const fs = make();
    expect(fs.stat("/home/user/docs/notes.txt")?.mode).toBe(0o644);
    expect(fs.stat("/home/user/docs")?.mode).toBe(0o755);
    fs.chmod("/home/user/docs/notes.txt", 0o755);
    expect(fs.stat("/home/user/docs/notes.txt")?.mode).toBe(0o755);
  });

  it("clones into an independent copy", () => {
    const fs = make();
    const copy = fs.clone();
    copy.writeFile("/home/user/docs/notes.txt", "changed");
    copy.mkdir("/new");
    expect(fs.readFile("/home/user/docs/notes.txt")).toBe("hello\n");
    expect(fs.exists("/new")).toBe(false);
  });
});

describe("VirtualFS timestamps", () => {
  it("records a modification time and lets touch refresh it", () => {
    const fs = new VirtualFS();
    fs.writeFile("/f", "x");
    const first = fs.stat("/f")!.mtime;
    expect(typeof first).toBe("number");
    fs.touch("/f");
    expect(fs.stat("/f")!.mtime).toBeGreaterThanOrEqual(first);
    expect(() => fs.touch("/missing")).toThrow(/No such file or directory/);
  });
});
