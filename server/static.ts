// Serves front/ as static files with index.html as the fallback for any path
// that is not a file, so the browser router (task 06) owns the URL space.
//
// Why not Atrium's makeSpaHandler: a chamber that imports ../../core/ only
// works when it sits inside Atrium's tree, and this repo must also run with
// `deno serve mod.ts` on its own. Thirty lines here cost less than that
// coupling (D1 keeps auth, TLS and the import map on Atrium's side; static
// files were never part of the contract).

const FRONT = new URL('../front/', import.meta.url);

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
