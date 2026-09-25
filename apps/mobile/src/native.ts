/**
 * The only file that talks to Capacitor. Everything is wrapped so the same
 * code runs in a plain browser (where the plugins do nothing) and tests can
 * inject a fake bridge.
 */
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Keyboard } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";

export interface NativeBridge {
  readonly isNative: boolean;
  /** One-time platform setup (status bar, keyboard accessory bar). */
  setup(): Promise<void>;
  hapticSuccess(): void;
  hapticTap(): void;
  /** Android back button. The handler returns true when it handled the press; otherwise the app exits. */
  onBackButton(handler: () => boolean): void;
  /** Soft keyboard shown/hidden. */
  onKeyboard(handler: (open: boolean) => void): void;
}

/** Does nothing; used in tests and as a safe fallback. */
export const noopNative: NativeBridge = {
  isNative: false,
  setup: async () => {},
  hapticSuccess: () => {},
  hapticTap: () => {},
  onBackButton: () => {},
  onKeyboard: () => {},
};

/** Swallows "not implemented on web" and similar errors from plugin calls. */
const quietly = (promise: Promise<unknown>) => promise.catch(() => {});

export function createNativeBridge(): NativeBridge {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) return noopNative;
  return {
    isNative,
    setup: async () => {
      await quietly(StatusBar.setStyle({ style: Style.Dark }));
      // We draw our own key bar, so hide iOS's default "Done" accessory bar.
      await quietly(Keyboard.setAccessoryBarVisible({ isVisible: false }));
    },
    hapticSuccess: () => quietly(Haptics.notification({ type: NotificationType.Success })),
    hapticTap: () => quietly(Haptics.impact({ style: ImpactStyle.Light })),
    onBackButton: (handler) => {
      quietly(
        CapApp.addListener("backButton", () => {
          if (!handler()) quietly(CapApp.exitApp());
        }),
      );
    },
    onKeyboard: (handler) => {
      quietly(Keyboard.addListener("keyboardWillShow", () => handler(true)));
      quietly(Keyboard.addListener("keyboardWillHide", () => handler(false)));
    },
  };
}
