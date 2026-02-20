import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const CHILLER_API_EC2 = 'http://3.16.135.140:8080';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TS error: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      'process.env': {
        API_KEY: env.API_KEY,
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
      }
    },
    server: {
      proxy: {
        // In dev, /chiller-api/* is forwarded to EC2. Set VITE_CHILLER_USE_PROXY=true to use it (avoids CORS and timeouts if EC2 is reachable from your machine).
        '/chiller-api': {
          target: CHILLER_API_EC2,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/chiller-api/, ''),
        },
      },
    },
  };
});