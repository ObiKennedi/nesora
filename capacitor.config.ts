import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nesora.app',
  appName: 'NESORA',
  webDir: 'capacitor-shell',
  server: {
    url: 'https://nesora.com/login',
    cleartext: false,
  },
  android: {
    appendUserAgent: 'NesoraApp',
  },
};

export default config;
