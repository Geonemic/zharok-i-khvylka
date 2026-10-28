import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // номер збірки: у кімнаті можуть грати лише однакові версії гри (інакше симуляції розійдуться)
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  server: {
    port: 5173,
    // онлайн під час розробки: запити до кімнат ідуть на локальний сервер wrangler
    proxy: { '/api': { target: 'http://localhost:8787', ws: true } },
  },
});
