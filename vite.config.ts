import { defineConfig, type Plugin } from 'vite';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAPS_DIR = join(__dirname, 'src/data/maps');

/**
 * Dev-only save endpoint for tools/world-builder's editor. Lets the browser
 * write an edited MapDef straight back to src/data/maps/<id>.json. Never
 * runs during `vite build` (apply: 'serve'), so it ships nothing to the game.
 */
function worldBuilderSavePlugin(): Plugin {
  return {
    name: 'world-builder-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__world-builder/save', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 2_000_000) req.destroy(); // guard against runaway bodies
        });
        req.on('end', () => {
          try {
            const { mapId, json } = JSON.parse(body) as { mapId: string; json: string };
            const known = readdirSync(MAPS_DIR).map((f) => f.replace(/\.json$/, ''));
            if (!known.includes(mapId)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: `unknown mapId: ${mapId}` }));
              return;
            }
            writeFileSync(join(MAPS_DIR, `${mapId}.json`), json);
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  // relative paths so the build works from any hosting URL or subpath
  base: './',
  plugins: [worldBuilderSavePlugin()]
});
