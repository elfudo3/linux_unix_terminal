/** Entry point: styles, storage guard, native bridge, then the app. */
import "@terminal-trainer/ui/terminal.css";
import "./styles/app.css";
import { createApp } from "./app";
import { createNativeBridge } from "./native";

declare const __APP_VERSION__: string;

/** localStorage can throw (private mode, disabled storage); fall back to no persistence. */
function safeStorage(): Storage | undefined {
  try {
    localStorage.setItem("terminal-trainer.ping", "1");
    localStorage.removeItem("terminal-trainer.ping");
    return localStorage;
  } catch {
    return undefined;
  }
}

const native = createNativeBridge();
createApp(document.getElementById("app")!, { storage: safeStorage(), native, version: __APP_VERSION__ });
void native.setup();
