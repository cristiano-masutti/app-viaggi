/**
 * Il minimo di Supabase che serve a pannello, app e backend durante gli e2e:
 * GoTrue (login con password, refresh, logout, JWKS, creazione utenti dello
 * staff) e Storage (upload, URL firmati, download, rimozione).
 *
 * I file dei dati demo non vengono caricati: un PDF o un'immagine che non
 * esiste viene generato al volo, sempre uguale. Uso: node fake-supabase.mjs <porta>
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';

import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import { ACCOUNTS } from './stack.mjs';

const PORT = Number(process.argv[2] ?? 54321);
const BASE = `http://127.0.0.1:${PORT}`;
const ISSUER = `${BASE}/auth/v1`;
const KID = 'e2e-key';
const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
const jwk = { ...(await exportJWK(publicKey)), kid: KID, alg: 'ES256', use: 'sig' };

const users = new Map(Object.values(ACCOUNTS).map((account) => [account.email, { ...account }]));
const refreshTokens = new Map();
const objects = new Map();

/** Un PDF di una pagina e un'immagine 8×8 color ardesia: i "file" dei dati demo. */
const PLACEHOLDER_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 120]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);
const PLACEHOLDER_PNG = solidPng(48, 32, [42, 58, 74]);

/** Un PNG a tinta unita, costruito a mano (zlib e CRC32 di Node): nessun file binario nel repository. */
function solidPng(width, height, [red, green, blue]) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: width }, () => [red, green, blue]).flat()),
  ]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function stored(key) {
  if (objects.has(key)) return objects.get(key);
  if (key.endsWith('.pdf')) return { body: PLACEHOLDER_PDF, contentType: 'application/pdf' };
  if (/\.(jpe?g|png|webp)$/.test(key)) return { body: PLACEHOLDER_PNG, contentType: 'image/png' };
  return undefined;
}

function account(user) {
  const stamp = new Date().toISOString();
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: stamp,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: user.metadata ?? {},
    identities: [],
    created_at: stamp,
    updated_at: stamp,
    is_anonymous: false,
  };
}

async function session(user) {
  const expiresIn = 3600;
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({
    role: 'authenticated',
    email: user.email,
    is_anonymous: false,
    aal: 'aal1',
    session_id: randomUUID(),
  })
    .setProtectedHeader({ alg: 'ES256', kid: KID, typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(privateKey);
  const refreshToken = randomBytes(16).toString('hex');
  refreshTokens.set(refreshToken, user);
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    refresh_token: refreshToken,
    user: account(user),
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, apikey, x-client-info, content-type, x-supabase-api-version, x-upsert, cache-control, x-metadata',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
const send = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', ...CORS });
  response.end(body === undefined ? '' : JSON.stringify(body));
};
const read = (request) =>
  new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
  });
const json = async (request) => JSON.parse((await read(request)).toString() || '{}');

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', BASE);
  const path = url.pathname;
  if (request.method === 'OPTIONS') return send(response, 204);

  if (path === '/auth/v1/.well-known/jwks.json') return send(response, 200, { keys: [jwk] });

  if (path === '/auth/v1/token' && request.method === 'POST') {
    const body = await json(request);
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const user = users.get(String(body.email).toLowerCase());
      if (!user || user.password !== body.password)
        return send(response, 400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        });
      return send(response, 200, await session(user));
    }
    if (grant === 'refresh_token') {
      const user = refreshTokens.get(body.refresh_token);
      if (!user)
        return send(response, 400, {
          code: 400,
          error_code: 'refresh_token_not_found',
          msg: 'Invalid Refresh Token',
        });
      refreshTokens.delete(body.refresh_token);
      return send(response, 200, await session(user));
    }
  }
  if (path === '/auth/v1/logout') return send(response, 204);

  // Admin API (service role): lo staff crea account già confermati, e li annulla.
  if (path === '/auth/v1/admin/users' && request.method === 'POST') {
    const body = await json(request);
    const email = String(body.email).toLowerCase();
    if (users.has(email))
      return send(response, 422, {
        code: 422,
        error_code: 'email_exists',
        msg: 'A user with this email address has already been registered',
      });
    const user = { id: randomUUID(), email, password: body.password, metadata: body.user_metadata };
    users.set(email, user);
    return send(response, 200, account(user));
  }
  const adminUser = path.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
  if (adminUser && request.method === 'DELETE') {
    for (const [email, user] of users) if (user.id === adminUser[1]) users.delete(email);
    return send(response, 200, {});
  }

  // Storage: firme singole e multiple, download firmato, upload, rimozione.
  const signMany = path.match(/^\/storage\/v1\/object\/sign\/([^/]+)$/);
  if (signMany && request.method === 'POST') {
    const { paths } = await json(request);
    return send(
      response,
      200,
      paths.map((key) => {
        const exists = stored(`${signMany[1]}/${key}`) !== undefined;
        return {
          path: key,
          error: exists ? null : 'Object not found',
          signedURL: exists ? `/object/sign/${signMany[1]}/${key}?token=e2e` : null,
        };
      }),
    );
  }
  const sign = path.match(/^\/storage\/v1\/object\/sign\/(.+)$/);
  if (sign && request.method === 'POST') {
    if (!stored(sign[1]))
      return send(response, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    return send(response, 200, { signedURL: `/object/sign/${sign[1]}?token=e2e` });
  }
  if (sign && request.method === 'GET') {
    const object = stored(decodeURIComponent(sign[1]));
    if (!object) return send(response, 404, { message: 'not found' });
    response.writeHead(200, { 'content-type': object.contentType, ...CORS });
    return response.end(object.body);
  }
  const bucket = path.match(/^\/storage\/v1\/object\/([^/]+)$/);
  if (bucket && request.method === 'DELETE') {
    const { prefixes } = await json(request);
    const removed = prefixes.filter((key) => objects.delete(`${bucket[1]}/${key}`));
    return send(
      response,
      200,
      removed.map((name) => ({ name })),
    );
  }
  const upload = path.match(/^\/storage\/v1\/object\/(.+)$/);
  if (upload && (request.method === 'POST' || request.method === 'PUT')) {
    const key = decodeURIComponent(upload[1]);
    if (objects.has(key) && request.headers['x-upsert'] !== 'true')
      return send(response, 400, {
        statusCode: '409',
        error: 'Duplicate',
        message: 'The resource already exists',
      });
    objects.set(key, {
      body: await read(request),
      contentType: request.headers['content-type'] ?? 'application/octet-stream',
    });
    return send(response, 200, { Key: key, Id: randomUUID() });
  }

  send(response, 404, { message: `fake supabase: no route for ${request.method} ${path}` });
}).listen(PORT, '127.0.0.1', () => console.log(`fake supabase on ${BASE}`));
