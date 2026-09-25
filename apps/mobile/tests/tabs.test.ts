import { beforeEach, describe, expect, it } from "vitest";
import { createTabs, type Tabs } from "../src/components/tabs";

let tabs: Tabs;
let panels: Record<string, HTMLElement>;

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  const root = document.getElementById("root")!;
  panels = {};
  for (const id of ["practice", "tasks", "learn"]) {
    panels[id] = document.createElement("section");
    root.appendChild(panels[id]);
  }
  tabs = createTabs(root, [
    { id: "practice", label: "Practice", icon: "<svg></svg>", panel: panels.practice! },
    { id: "tasks", label: "Tasks", icon: "<svg></svg>", panel: panels.tasks! },
    { id: "learn", label: "Learn", icon: "<svg></svg>", panel: panels.learn! },
  ]);
});

describe("tabs", () => {
  it("shows the first panel and hides the rest", () => {
    expect(tabs.current).toBe("practice");
    expect(panels.practice!.hidden).toBe(false);
    expect(panels.tasks!.hidden).toBe(true);
    expect(panels.learn!.hidden).toBe(true);
  });

  it("switches on click and keeps ARIA state in sync", () => {
    const button = tabs.element.querySelector<HTMLButtonElement>('[data-tab="learn"]')!;
    button.click();
    expect(tabs.current).toBe("learn");
    expect(panels.learn!.hidden).toBe(false);
    expect(panels.practice!.hidden).toBe(true);
    expect(button.getAttribute("aria-selected")).toBe("true");
    expect(tabs.element.querySelector('[data-tab="practice"]')?.getAttribute("aria-selected")).toBe("false");
    expect(panels.learn!.getAttribute("role")).toBe("tabpanel");
  });

  it("notifies listeners, ignores unknown ids and repeats", () => {
    const seen: string[] = [];
    const stop = tabs.onChange((id) => seen.push(id));
    tabs.select("tasks");
    tabs.select("tasks");
    tabs.select("nope");
    stop();
    tabs.select("learn");
    expect(seen).toEqual(["tasks"]);
    expect(tabs.current).toBe("learn");
  });
});
