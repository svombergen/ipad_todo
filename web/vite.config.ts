declare const process: { env: Record<string, string | undefined> } // ponytail: avoids @types/node for one env read
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __BUILD__: JSON.stringify(process.env.BUILD ?? '0') }, // CI run number, see build.sh
  build: {
    target: 'safari15', // iPadOS 15 WKWebView
    outDir: '../ios/Kiosk/web',
    emptyOutDir: true,
  },
})
