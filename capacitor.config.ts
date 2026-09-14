import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jumjod.app',
  appName: 'JumJod',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: 'https://your-vercel-domain.com', // เปลี่ยนเป็น URL จริงของ Vercel
    cleartext: true
  }
};

export default config;
