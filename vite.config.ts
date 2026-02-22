import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true, // Lyssnar på 0.0.0.0 så telefon/andra enheter på samma WiFi når servern
    port: 5173,
  },
})
