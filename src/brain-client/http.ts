import {
  BrainNetworkError,
  BrainRateLimitError,
  BrainServerError,
  fromEnvelope,
} from "./errors.js";
import type { ErrorEnvelope } from "./types.js";

export interface FetchOptions {
  url: string;
  token: string | null;
  maxRetries?: number;
  retryBaseMs?: number;
  timeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function brainFetch<T>(
  opts: FetchOptions,
  method: "GET" | "POST" | "PUT" | "DELETE",
  urlPath: string,
  body?: unknown,
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const retryBase = opts.retryBaseMs ?? 100;
  const timeout = opts.timeoutMs ?? 10_000;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let attempt = 0;
  while (true) {
    // Fresh AbortController per attempt so retries don't inherit a fired signal.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let res: Response;
    try {
      res = await fetch(`${opts.url}${urlPath}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      throw new BrainNetworkError((e as Error).message);
    }
    clearTimeout(timer);

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    const bodyText = await res.text();
    let envelope: ErrorEnvelope;
    try {
      envelope = JSON.parse(bodyText) as ErrorEnvelope;
    } catch {
      envelope = {
        error: { code: `HTTP_${res.status}`, message: bodyText, request_id: "" },
      };
    }
    const err = fromEnvelope(res.status, envelope);

    if (err instanceof BrainRateLimitError) {
      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter && /^\d+$/.test(retryAfter)) {
        (err as unknown as { retryAfterMs: number }).retryAfterMs = Number(retryAfter) * 1000;
      }
    }

    const retriable = err instanceof BrainServerError || err instanceof BrainRateLimitError;
    if (retriable && attempt < maxRetries) {
      const delay =
        err instanceof BrainRateLimitError ? err.retryAfterMs : retryBase * Math.pow(2, attempt);
      await sleep(delay);
      attempt++;
      continue;
    }
    throw err;
  }
}
