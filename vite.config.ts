import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { orderApi } from './server/orderApi'

export default defineConfig({ plugins: [react(), tailwindcss(), orderApi()] })
