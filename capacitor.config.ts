import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "app.navalsmart.mobile",
  appName: "NavalSmart",
  webDir: "mobile/www",
  ios: {
    contentInset: "automatic",
    scheme: "NavalSmart",
    backgroundColor: "#071426",
  },
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
        androidScheme: "https",
        iosScheme: "https",
      }
    : undefined,
};

export default config;
