import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../scripts/openapi-document.js';

describe('openapi.json', () => {
  it('matches the routes: after changing an API schema, run `npm run openapi` and commit the file', async () => {
    const committed = readFileSync(new URL('../../openapi.json', import.meta.url), 'utf8');

    expect(committed).toBe(await buildOpenApiDocument());
  });

  it('describes every API route as protected by a bearer token, health checks aside', async () => {
    const document = JSON.parse(await buildOpenApiDocument()) as {
      security: unknown;
      paths: Record<string, Record<string, { security?: unknown[] }>>;
    };

    expect(document.security).toEqual([{ bearerAuth: [] }]);
    const publicOperations = Object.entries(document.paths).flatMap(([path, operations]) =>
      Object.entries(operations)
        .filter(([, operation]) => operation.security?.length === 0)
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    );
    expect(publicOperations).toEqual(['GET /health', 'GET /health/ready']);
  });
});
