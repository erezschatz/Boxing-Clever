// `deno task build`: the browser app for deployment, front/dist/app.js (D7,
// SETUP Deployment). The same bundle the dev server makes per request
// (server/static.ts), minified and written once; front/dist/ is gitignored.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleFront, DIST_APP } from '../server/static.ts';

const js = await bundleFront({ minify: true });
const out = fileURLToPath(DIST_APP);
await Deno.mkdir(dirname(out), { recursive: true });
await Deno.writeTextFile(out, js);
console.log(`${out}: ${js.length} bytes`);
