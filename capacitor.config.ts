import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jumjod.app',
  appName: 'JumJod',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://jum-jod.vercel.app',
    cleartext: true
  }
};

export default config;
