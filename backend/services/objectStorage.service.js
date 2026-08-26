import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Falls back to an in-memory store whenever real R2 credentials aren't
// configured and this isn't production — covers tests (no bucket to talk
// to at all) and local development (so a fresh checkout keeps working with
// zero R2 setup, same as NODE_ENV==='test' already skips the login rate
// limiter elsewhere in this codebase — see routes/auth.routes.js). A
// developer who sets real R2_* vars locally opts back into hitting the
// real bucket. Production never falls back silently: see getClient() below.
const useMemoryStore = process.env.NODE_ENV !== 'production' && !process.env.R2_ENDPOINT;
const memoryStore = useMemoryStore ? new Map() : null;

let client;
function getClient() {
  if (!client) {
    if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error(
        'Object storage is not configured — set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY',
      );
    }
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function uploadObject(key, buffer, contentType) {
  if (memoryStore) {
    memoryStore.set(key, { buffer, contentType });
    return;
  }
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key) {
  if (memoryStore) {
    const entry = memoryStore.get(key);
    if (!entry) {
      const err = new Error(`Object not found: ${key}`);
      err.name = 'NoSuchKey';
      throw err;
    }
    return entry;
  }
  const result = await getClient().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  const buffer = Buffer.from(await result.Body.transformToByteArray());
  return { buffer, contentType: result.ContentType };
}

export async function deleteObject(key) {
  if (memoryStore) {
    memoryStore.delete(key);
    return;
  }
  await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

/** Test-only introspection into the in-memory fake — a no-op (returns null) outside NODE_ENV==='test'. */
export function _testOnlyObjectCount() {
  return memoryStore ? memoryStore.size : null;
}

/** Test-only reset of the in-memory fake between test cases. */
export function _testOnlyClear() {
  memoryStore?.clear();
}
