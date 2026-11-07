// Serves front/ as static files with index.html as the fallback for any path
// that is not a file, so the browser router owns the URL space.
//
// /app.js is the browser app, front/app.ts bundled with everything it
// imports (the pages, server/rules/) and lit-html left to the page's import
// map (D7, D33). In development (BOXING_DEV set, as `deno task dev` does) it
// is bundled on every request, so a reload shows the edit; otherwise it is
// front/dist/app.js, written once by `deno task build`.
//
// Why not Atrium's makeSpaHandler: a chamber that imports ../../core/ only
// works when it sits inside Atrium's tree, and this repo must also run with
// `deno serve mod.ts` on its own. Thirty lines here cost less than that
// coupling (D1 keeps auth, TLS and the import map on Atrium's side; static
// files were never part of the contract).
/// <reference lib="deno.unstable" />
import { fileURLToPath } from 'node:url';

const FRONT = new URL('../front/', import.meta.url);
const ENTRY = new URL('app.ts', FRONT);
export const DIST_APP = new URL('dist/app.js', FRONT);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export async function serveFront(req: Request): Promise<Response> {
  const path = decodeURIComponent(new URL(req.url).pathname);
  if (path === '/app.js') return serveApp();
  const file = await readFront(path) ?? await readFront('/index.html');
  if (!file) return new Response('front/index.html is missing', { status: 500 });
  return new Response(file.body, { headers: { 'content-type': file.type } });
}

async function readFront(path: string) {
  if (path.includes('..')) return null; // never leave front/
  const ext = path.slice(path.lastIndexOf('.'));
  const type = TYPES[ext];
  if (!type) return null; // not a file we serve → fall back to index.html
  try {
    const body = await Deno.readFile(new URL('.' + path, FRONT));
    return { body, type };
  } catch {
    return null;
  }
}

async function serveApp(): Promise<Response> {
  const headers = { 'content-type': TYPES['.js'], 'cache-control': 'no-cache' };
  if (Deno.env.get('BOXING_DEV')) {
    try {
      return new Response(await bundleFront({ sourcemap: 'inline' }), { headers });
    } catch (err) {
      // The error on the page's console, not a half-bundled app.
      const message = err instanceof Error ? err.message : String(err);
      return new Response(message, { status: 500 });
    }
  }
  try {
    return new Response(await Deno.readFile(DIST_APP), { headers });
  } catch {
    return new Response('front/dist/app.js is missing: run `deno task build`', { status: 500 });
  }
}

// front/app.ts and all it imports as one browser module. Deno's own bundler
// (esbuild under the hood, behind the "bundle" unstable flag in deno.json),
// so dev and deploy build the same way and nothing is added to the stack.
export async function bundleFront(
  options: { minify?: boolean; sourcemap?: 'inline' } = {},
): Promise<string> {
  const result = await Deno.bundle({
    entrypoints: [fileURLToPath(ENTRY)],
    platform: 'browser',
    external: ['lit-html', 'lit-html/*'], // the browser's import map resolves these
    write: false,
    ...options,
  });
  if (!result.success || !result.outputFiles?.length) {
    throw new Error(result.errors.map((e) => e.text).join('\n') || 'bundling failed');
  }
  return result.outputFiles[0].text();
}
