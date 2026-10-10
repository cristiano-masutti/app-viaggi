import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildOpenApiDocument } from './openapi-document.js';

/** `npm run openapi`: riscrive `openapi.json`, il contratto da cui il mobile genera i tipi. */
const target = fileURLToPath(new URL('../openapi.json', import.meta.url));
writeFileSync(target, await buildOpenApiDocument());
console.log(`OpenAPI written to ${target}`);
