import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/Chatbot/",
  plugins: [react()],
  server: {
    open: true,
  },
})