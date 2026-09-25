import { describe, expect, it } from "vitest";
import { makeShell, out } from "../../helpers";

describe("echo", () => {
  it("prints its arguments, with -n and -e options", () => {
    const shell = makeShell();
    expect(out(shell, "echo a  b")).toBe("a b\n");
    expect(out(shell, "echo -n hi")).toBe("hi");
    expect(out(shell, "echo -e 'a\\tb\\nc'")).toBe("a\tb\nc\n");
    expect(out(shell, "echo")).toBe("\n");
  });
});

describe("head and tail", () => {
  it("default to 10 lines and accept -n N or -N", () => {
    const shell = makeShell();
    shell.fs.writeFile("/home/user/nums.txt", Array.from({ length: 15 }, (_, i) => i + 1).join("\n") + "\n");
    expect(out(shell, "head nums.txt")).toBe("1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n");
    expect(out(shell, "head -n 2 nums.txt")).toBe("1\n2\n");
    expect(out(shell, "head -3 nums.txt")).toBe("1\n2\n3\n");
    expect(out(shell, "tail -n 2 nums.txt")).toBe("14\n15\n");
    expect(out(shell, "tail -1 nums.txt")).toBe("15\n");
    expect(out(shell, "cat nums.txt | tail -n 1")).toBe("15\n");
  });

  it("label each file when several are given", () => {
    expect(out(makeShell(), "head -1 notes.txt /etc/hosts")).toBe(
      "==> notes.txt <==\nBuy milk\n\n==> /etc/hosts <==\n127.0.0.1 localhost\n",
    );
  });
});

describe("wc", () => {
  it("counts lines, words and bytes", () => {
    const shell = makeShell();
    expect(out(shell, "wc notes.txt")).toBe("3 6 28 notes.txt\n");
    expect(out(shell, "wc -l notes.txt")).toBe("3 notes.txt\n");
    expect(out(shell, "cat notes.txt | wc -l")).toBe("3\n");
    expect(out(shell, "wc -w notes.txt /etc/hosts")).toBe("6 notes.txt\n2 /etc/hosts\n8 total\n");
  });
});

describe("grep", () => {
  it("prints matching lines, with -i -n -v -c", () => {
    const shell = makeShell();
    expect(out(shell, "grep buy notes.txt")).toBe("buy bread\n");
    expect(out(shell, "grep -i buy notes.txt")).toBe("Buy milk\nbuy bread\n");
    expect(out(shell, "grep -n Call notes.txt")).toBe("2:Call Bob\n");
    expect(out(shell, "grep -v Bob notes.txt")).toBe("Buy milk\nbuy bread\n");
    expect(out(shell, "grep -c ERROR docs/archive/old.log")).toBe("2\n");
    expect(out(shell, "grep -ci buy notes.txt")).toBe("2\n");
  });

  it("uses exit code 1 when nothing matches", () => {
    const shell = makeShell();
    expect(shell.run("grep zzz notes.txt")).toMatchObject({ stdout: "", code: 1 });
    expect(shell.run("grep milk notes.txt").code).toBe(0);
  });

  it("reads stdin, prefixes file names for many files, and supports -r and -l", () => {
    const shell = makeShell();
    expect(out(shell, "cat notes.txt | grep milk")).toBe("Buy milk\n");
    expect(out(shell, "grep hi src/app.py src/app.js")).toBe("src/app.py:print('hi')\nsrc/app.js:console.log('hi')\n");
    expect(out(shell, "grep -r ERROR docs")).toBe("docs/archive/old.log:ERROR disk full\ndocs/archive/old.log:ERROR timeout\n");
    expect(out(shell, "grep -rl hi .")).toBe("./.secret\n./src/app.js\n./src/app.py\n");
    expect(shell.run("grep x docs").stderr).toBe("grep: docs: Is a directory\n");
  });

  it("supports regular expressions and whole words", () => {
    const shell = makeShell();
    expect(out(shell, "grep '^b' notes.txt")).toBe("buy bread\n");
    expect(out(shell, "grep -E 'milk|bread' notes.txt")).toBe("Buy milk\nbuy bread\n");
    expect(out(shell, "grep -w Bo notes.txt")).toBe("");
    expect(out(shell, "grep -w Bob notes.txt")).toBe("Call Bob\n");
  });
});

describe("sort and uniq", () => {
  it("sort orders lines, with -r -n -u", () => {
    const shell = makeShell();
    shell.fs.writeFile("/home/user/n.txt", "10\n9\n100\n9\n");
    expect(out(shell, "sort n.txt")).toBe("10\n100\n9\n9\n");
    expect(out(shell, "sort -n n.txt")).toBe("9\n9\n10\n100\n");
    expect(out(shell, "sort -rn n.txt")).toBe("100\n10\n9\n9\n");
    expect(out(shell, "sort -u n.txt")).toBe("10\n100\n9\n");
    expect(out(shell, "echo b | sort")).toBe("b\n");
  });

  it("uniq removes adjacent duplicates and counts with -c", () => {
    const shell = makeShell();
    shell.fs.writeFile("/home/user/d.txt", "a\na\nb\na\n");
    expect(out(shell, "uniq d.txt")).toBe("a\nb\na\n");
    expect(out(shell, "sort d.txt | uniq -c")).toBe("      3 a\n      1 b\n");
    expect(out(shell, "sort d.txt | uniq -d")).toBe("a\n");
  });
});

describe("cut and tr", () => {
  it("cut extracts fields and characters", () => {
    const shell = makeShell();
    shell.fs.writeFile("/home/user/p.csv", "ann,30,london\nbob,25,paris\n");
    expect(out(shell, "cut -d , -f 1 p.csv")).toBe("ann\nbob\n");
    expect(out(shell, "cut -d, -f1,3 p.csv")).toBe("ann,london\nbob,paris\n");
    expect(out(shell, "cut -d, -f2- p.csv")).toBe("30,london\n25,paris\n");
    expect(out(shell, "cut -c 1-3 p.csv")).toBe("ann\nbob\n");
    expect(out(shell, "cut -d: -f1 /etc/hosts")).toBe("127.0.0.1 localhost\n");
    expect(makeShell().run("cut notes.txt").stderr).toBe("cut: you must specify a list of bytes, characters, or fields\n");
  });

  it("tr translates or deletes characters", () => {
    const shell = makeShell();
    expect(out(shell, "echo hello | tr a-z A-Z")).toBe("HELLO\n");
    expect(out(shell, "echo hello | tr -d l")).toBe("heo\n");
    expect(out(shell, "echo a-b | tr - _")).toBe("a_b\n");
    expect(out(shell, "echo 'a b' | tr ' ' '\\n'")).toBe("a\nb\n");
  });
});

describe("sed and awk (subset)", () => {
  it("sed substitutes text, optionally in place", () => {
    const shell = makeShell();
    expect(out(shell, "sed 's/milk/tea/' notes.txt")).toBe("Buy tea\nCall Bob\nbuy bread\n");
    expect(out(shell, "echo aaa | sed 's/a/b/'")).toBe("baa\n");
    expect(out(shell, "echo aaa | sed 's/a/b/g'")).toBe("bbb\n");
    expect(out(shell, "sed 's/BUY/get/gi' notes.txt")).toBe("get milk\nCall Bob\nget bread\n");
    shell.run("sed -i 's/Bob/Alice/' notes.txt");
    expect(shell.fs.readFile("/home/user/notes.txt")).toBe("Buy milk\nCall Alice\nbuy bread\n");
    expect(shell.run("sed 'p' notes.txt").stderr).toMatch(/only s\/old\/new\/ is supported/);
  });

  it("awk prints selected fields", () => {
    const shell = makeShell();
    expect(out(shell, "awk '{print $1}' notes.txt")).toBe("Buy\nCall\nbuy\n");
    expect(out(shell, "awk '{print $2, $1}' notes.txt")).toBe("milk Buy\nBob Call\nbread buy\n");
    expect(out(shell, "awk -F: '{print $1}' /etc/hosts")).toBe("127.0.0.1 localhost\n");
    expect(out(shell, "awk '/Bob/ {print $0}' notes.txt")).toBe("Call Bob\n");
    expect(out(shell, "cat notes.txt | awk '{print NR\": \"$1}'")).toBe("1: Buy\n2: Call\n3: buy\n");
    expect(out(shell, "awk '{print $NF}' notes.txt")).toBe("milk\nBob\nbread\n");
    expect(shell.run("awk 'BEGIN{x=1}' notes.txt").stderr).toMatch(/only/);
  });
});
