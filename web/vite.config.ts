import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'safari15', // iPadOS 15 WKWebView
    outDir: '../ios/Kiosk/web',
    emptyOutDir: true,
  },
})
