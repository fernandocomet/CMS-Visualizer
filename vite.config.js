import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy personalizado: evita problemas del proxy http-proxy con la API de Webflow
function webflowProxy() {
  return {
    name: 'webflow-proxy',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        // req.url puede ser /v2/... (Connect) o /api/v2/... según versión
        const path = (req.url || '/').replace(/^\/api/, '') || '/';
        const auth = req.headers.authorization;
        if (!auth) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing Authorization header' }));
          return;
        }
        try {
          const url = `https://api.webflow.com${path}`;
          if (process.env.DEBUG) console.log('[Webflow proxy]', req.method, url);
          const fetchRes = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': auth, 'accept': 'application/json' },
          });
          const body = await fetchRes.text();
          res.writeHead(fetchRes.status, {
            'Content-Type': fetchRes.headers.get('content-type') || 'application/json',
          });
          res.end(body);
        } catch (err) {
          console.error('[Webflow proxy]', err.message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), webflowProxy()],
})
