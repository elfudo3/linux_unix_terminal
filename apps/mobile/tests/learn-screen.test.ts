import { describe, expect, it, vi } from "vitest";
import { createLearnScreen } from "../src/screens/learn";
import { makeFixture } from "./helpers";

describe("learn screen", () => {
  it("lists commands by category and filters by search", () => {
    const { root, shell } = makeFixture();
    const screen = createLearnScreen(root, shell, { onTry: vi.fn() });
    const rows = () => [...screen.element.querySelectorAll<HTMLElement>(".command-row:not([hidden])")];
    expect(rows().length).toBe(shell.commandNames().length);
    expect(screen.element.querySelector(".category-heading")?.textContent).toBe("Navigation");
    const search = screen.element.querySelector<HTMLInputElement>(".learn-search")!;
    search.value = "direct";
    search.dispatchEvent(new Event("input"));
    const names = rows().map((r) => r.dataset.command);
    expect(names).toContain("cd");
    expect(names).toContain("ls");
    expect(names).not.toContain("grep");
    expect(screen.element.querySelectorAll(".category-group:not([hidden])").length).toBeLessThan(6);
  });

  it("opens a command's page, goes back, and can send it to the terminal", () => {
    const { root, shell } = makeFixture();
    const onTry = vi.fn();
    const screen = createLearnScreen(root, shell, { onTry });
    screen.element.querySelector<HTMLButtonElement>('.command-row[data-command="grep"]')!.click();
    const detail = screen.element.querySelector<HTMLElement>(".learn-detail")!;
    expect(detail.hidden).toBe(false);
    expect(detail.querySelector(".command-title")?.textContent).toBe("grep");
    expect(detail.querySelector(".command-usage")?.textContent).toContain("grep [options] pattern");
    expect(detail.querySelector(".command-details")?.textContent).toContain("-i");
    detail.querySelector<HTMLButtonElement>(".try-button")!.click();
    expect(onTry).toHaveBeenCalledWith("grep");
    expect(screen.isDetailOpen()).toBe(true);
    expect(screen.back()).toBe(true);
    expect(detail.hidden).toBe(true);
    expect(screen.back()).toBe(false);
  });
});
