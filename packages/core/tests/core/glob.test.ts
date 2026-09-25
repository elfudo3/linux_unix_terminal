import { describe, expect, it } from "vitest";
import { VirtualFS } from "../../src/core/filesystem";
import { expandGlob, hasGlob, matchGlob } from "../../src/core/glob";

describe("matchGlob", () => {
  it("supports * ? and [..] like a shell", () => {
    expect(matchGlob("*.txt", "a.txt")).toBe(true);
    expect(matchGlob("*.txt", "a.md")).toBe(false);
    expect(matchGlob("?.txt", "a.txt")).toBe(true);
    expect(matchGlob("?.txt", "ab.txt")).toBe(false);
    expect(matchGlob("[ab].txt", "b.txt")).toBe(true);
    expect(matchGlob("[ab].txt", "c.txt")).toBe(false);
    expect(matchGlob("file[0-9]", "file7")).toBe(true);
  });

  it("treats regex metacharacters literally", () => {
    expect(matchGlob("a.b", "aXb")).toBe(false);
    expect(matchGlob("a+b", "a+b")).toBe(true);
  });
});

describe("expandGlob", () => {
  const fs = new VirtualFS();
  fs.mkdir("/home/user/docs", { parents: true });
  fs.writeFile("/home/user/a.txt", "");
  fs.writeFile("/home/user/b.txt", "");
  fs.writeFile("/home/user/.hidden", "");
  fs.writeFile("/home/user/docs/c.md", "");
  fs.writeFile("/home/user/docs/d.md", "");

  it("detects glob characters", () => {
    expect(hasGlob("*.txt")).toBe(true);
    expect(hasGlob("plain.txt")).toBe(false);
  });

  it("expands relative to the current directory, sorted", () => {
    expect(expandGlob(fs, "/home/user", "*.txt")).toEqual(["a.txt", "b.txt"]);
  });

  it("expands patterns with directory parts", () => {
    expect(expandGlob(fs, "/home/user", "docs/*.md")).toEqual(["docs/c.md", "docs/d.md"]);
    expect(expandGlob(fs, "/", "/home/*/docs/*")).toEqual(["/home/user/docs/c.md", "/home/user/docs/d.md"]);
  });

  it("skips dotfiles unless the pattern starts with a dot", () => {
    expect(expandGlob(fs, "/home/user", "*")).toEqual(["a.txt", "b.txt", "docs"]);
    expect(expandGlob(fs, "/home/user", ".*")).toEqual([".hidden"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(expandGlob(fs, "/home/user", "*.zip")).toEqual([]);
  });
});
