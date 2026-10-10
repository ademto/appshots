/**
 * Cloudflare R2 storage via the S3-compatible API, signed with aws4fetch.
 *
 * R2 credentials are validated lazily here (on first use) rather than at
 * startup, so the API can run without R2 configured until upload is exercised.
 */
import { AwsClient } from "aws4fetch";
import { env } from "../env";

let client: AwsClient | null = null;

function endpoint(): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function getClient(): AwsClient {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and " +
        "R2_SECRET_ACCESS_KEY in the environment.",
    );
  }
  if (!env.R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL is not set; uploaded images can't be served.");
  }
  if (!client) {
    client = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });
  }
  return client;
}

export interface PutResult {
  key: string;
  url: string;
}

/**
 * Uploads bytes to R2 under the given key and returns its public URL.
 */
export async function putObject(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<PutResult> {
  const aws = getClient();
  const url = `${endpoint()}/${env.R2_BUCKET}/${key}`;

  const res = await aws.fetch(url, {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 upload failed (${res.status}): ${text}`);
  }

  const publicBase = env.R2_PUBLIC_URL.replace(/\/$/, "");
  return { key, url: `${publicBase}/${key}` };
}
