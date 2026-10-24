import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS=1 npm run dev  → serve com certificado local para testar câmera/AR no celular pela rede.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/estadio-ar/' : '/',
  plugins: process.env.HTTPS ? [basicSsl()] : [],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
}));
