import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the built web app (dist/) in native iOS and Android shells.
 * Change `appId` to your own reverse-DNS identifier before publishing; it must
 * match the bundle id / application id you register with Apple and Google.
 */
const config: CapacitorConfig = {
  appId: "com.terminaltrainer.app",
  appName: "Terminal Trainer",
  webDir: "dist",
  backgroundColor: "#0b0f14",
  ios: {
    // The app manages its own scrolling areas; the web view itself never scrolls or bounces.
    scrollEnabled: false,
    contentInset: "never",
  },
  plugins: {
    Keyboard: {
      // Resize the web view when the keyboard opens so the input stays visible.
      resize: "native",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0f14",
    },
  },
};

export default config;
