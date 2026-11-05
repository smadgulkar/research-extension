#!/usr/bin/env node
// Upload a package to an EXISTING Microsoft Edge Add-ons listing and submit it for review.
// Uses the Edge Add-ons REST API v1.1 (API-key auth).
// Docs: https://learn.microsoft.com/microsoft-edge/extensions/update/api/using-addons-api
//
// Usage: node scripts/publish-edge.mjs <package.zip> [release notes]
// Env:   EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY
//
// The first submission of a new extension must be done by hand in Partner Center;
// the API can only update an existing product.

import { readFile } from 'node:fs/promises';

// EDGE_API_BASE override exists only for testing against a mock server.
const BASE = process.env.EDGE_API_BASE || 'https://api.addons.microsoftedge.microsoft.com';
const { EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY } = process.env;
const [zipPath, notes = 'Bug fixes and improvements.'] = process.argv.slice(2);

if (!zipPath || !EDGE_PRODUCT_ID || !EDGE_CLIENT_ID || !EDGE_API_KEY) {
  console.error('Usage: node scripts/publish-edge.mjs <zip> [notes]  (needs EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY)');
  process.exit(2);
}

const auth = { Authorization: `ApiKey ${EDGE_API_KEY}`, 'X-ClientID': EDGE_CLIENT_ID };
const product = `${BASE}/v1/products/${EDGE_PRODUCT_ID}`;

// The Location header carries the operation ID; accept either a bare ID or a URL ending in it.
function operationId(res) {
  const loc = res.headers.get('location');
  if (!loc) throw new Error(`No Location header in ${res.status} response`);
  return loc.replace(/\/+$/, '').split('/').pop();
}

async function expect202(res, step) {
  if (res.status !== 202) {
    throw new Error(`${step} failed: HTTP ${res.status} ${await res.text()}`);
  }
  return operationId(res);
}

async function poll(url, step, { tries = 60, delayMs = Number(process.env.EDGE_POLL_MS) || 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: auth });
    if (!res.ok && res.status !== 202) {
      throw new Error(`${step} status check failed: HTTP ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    if (body.status === 'Succeeded') {
      console.log(`${step}: ${body.message}`);
      return body;
    }
    if (body.status === 'Failed') {
      throw new Error(`${step} failed: ${body.errorCode} ${body.message} ${JSON.stringify(body.errors)}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`${step} did not finish in time`);
}

const zip = await readFile(zipPath);

console.log(`Uploading ${zipPath} (${zip.length} bytes) to Edge product ${EDGE_PRODUCT_ID}...`);
const uploadOp = await expect202(
  await fetch(`${product}/submissions/draft/package`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/zip' },
    body: zip,
  }),
  'Upload'
);
await poll(`${product}/submissions/draft/package/operations/${uploadOp}`, 'Upload');

console.log('Submitting for certification...');
const publishOp = await expect202(
  await fetch(`${product}/submissions`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  }),
  'Publish'
);
await poll(`${product}/submissions/operations/${publishOp}`, 'Publish');
console.log('Edge submission sent for review.');
