/**
 * Assembles the mobile app: shell + trainer, the three tab screens, the
 * settings sheet, and the glue between them (jump to a task, try a
 * command, back button, keyboard state). Native calls go through the
 * injected bridge so this file is fully testable in jsdom.
 */
import { Shell, Trainer, challenges, createSampleFS, trainerCommands, type ProgressStorage } from "@terminal-trainer/core";
import { createTabs, type Tabs } from "./components/tabs";
import { showToast } from "./components/toast";
import { noopNative, type NativeBridge } from "./native";
import { loadPreferences, savePreferences } from "./preferences";
import { createLearnScreen, type LearnScreen } from "./screens/learn";
import { createPracticeScreen, type PracticeScreen } from "./screens/practice";
import { createSettingsSheet, type SettingsSheet } from "./screens/settings";
import { createTasksScreen, type TasksScreen } from "./screens/tasks";

export interface AppOptions {
  storage?: ProgressStorage;
  native?: NativeBridge;
  version?: string;
}

export interface App {
  element: HTMLElement;
  shell: Shell;
  trainer: Trainer;
  tabs: Tabs;
  practice: PracticeScreen;
  tasks: TasksScreen;
  learn: LearnScreen;
  settings: SettingsSheet;
  /** Android back button logic; returns true when handled. */
  back(): boolean;
}

const ICONS = {
  practice: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/></svg>',
  learn: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
};

export function createApp(root: HTMLElement, opts: AppOptions = {}): App {
  const native = opts.native ?? noopNative;
  const storage = opts.storage;

  const shell = new Shell({ fs: createSampleFS() });
  const trainer = new Trainer({ shell, challenges, freshFS: createSampleFS, storage });
  for (const cmd of trainerCommands(trainer)) shell.register(cmd);

  const prefs = loadPreferences(storage);

  const element = document.createElement("div");
  element.className = "app";
  element.innerHTML = `
    <header class="appbar">
      <h1 class="appbar-title"><span class="appbar-logo" aria-hidden="true">&gt;_</span> Terminal Trainer</h1>
      <button type="button" class="icon-button settings-button" aria-label="Settings">${ICONS.settings}</button>
    </header>
    <main class="screens"></main>`;
  root.appendChild(element);
  const screens = element.querySelector<HTMLElement>(".screens")!;

  const practice = createPracticeScreen(screens, {
    shell,
    trainer,
    prefs,
    onPrefsChange: (next) => savePreferences(storage, next),
    onSolved: () => {
      native.hapticSuccess();
      showToast(element, "✓ Solved!");
    },
  });

  const tasks = createTasksScreen(screens, trainer, {
    onSelect: (index) => {
      tabs.select("practice");
      practice.run(`task ${index + 1}`);
    },
  });

  const learn = createLearnScreen(screens, shell, {
    onTry: (command) => {
      tabs.select("practice");
      practice.setLine(command + " ");
    },
  });

  const tabs = createTabs(element, [
    { id: "practice", label: "Practice", icon: ICONS.practice, panel: practice.element },
    { id: "tasks", label: "Tasks", icon: ICONS.tasks, panel: tasks.element },
    { id: "learn", label: "Learn", icon: ICONS.learn, panel: learn.element },
  ]);
  tabs.onChange(() => native.hapticTap());

  const settings = createSettingsSheet(element, {
    prefs,
    version: opts.version ?? "dev",
    onFontSize: (size) => {
      prefs.fontSize = size;
      savePreferences(storage, prefs);
      practice.setFontSize(size);
    },
    onResetProgress: () => {
      trainer.resetProgress();
      tabs.select("practice");
      practice.run("task");
    },
  });
  element.querySelector(".settings-button")!.addEventListener("click", () => settings.open());

  // While the keyboard is up, the tab bar hides so the terminal keeps its space.
  const setKeyboard = (open: boolean) => {
    element.classList.toggle("keyboard-open", open);
    practice.setKeyboardOpen(open);
  };
  practice.terminal.input.addEventListener("focus", () => setKeyboard(true));
  practice.terminal.input.addEventListener("blur", () => setKeyboard(false));
  native.onKeyboard(setKeyboard);

  const back = (): boolean => {
    if (settings.isOpen()) {
      settings.close();
      return true;
    }
    if (tabs.current === "learn" && learn.back()) return true;
    if (tabs.current !== "practice") {
      tabs.select("practice");
      return true;
    }
    return false;
  };
  native.onBackButton(back);

  return { element, shell, trainer, tabs, practice, tasks, learn, settings, back };
}
