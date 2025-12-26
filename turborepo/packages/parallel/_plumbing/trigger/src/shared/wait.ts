import { wait } from "@trigger.dev/sdk";

export type WaitTokenResult<Output> =
  | {
      ok: true;
      output: Output;
    }
  | {
      ok: false;
      error: Error;
    };

export type CreateWaitWebhookOptions = {
  timeout?: string;
  tags?: string[];
  idempotencyKey?: string;
  idempotencyKeyTTL?: string;
};

export async function createWaitWebhook(
  options: CreateWaitWebhookOptions = {}
) {
  return wait.createToken({
    timeout: options.timeout,
    tags: options.tags,
    idempotencyKey: options.idempotencyKey,
    idempotencyKeyTTL: options.idempotencyKeyTTL,
  });
}

export async function awaitWaitToken<Output>(
  tokenId: string
): Promise<WaitTokenResult<Output>> {
  return wait.forToken<Output>(tokenId);
}

export async function completeWaitToken<Output>(
  tokenId: string,
  output: Output
) {
  await wait.completeToken(tokenId, output);
}

export async function pauseWithWaitToken(seconds: number) {
  if (seconds <= 0) {
    return;
  }

  const timeoutInSeconds = Math.max(seconds * 2, seconds + 10);
  const token = await wait.createToken({ timeout: `${timeoutInSeconds}s` });

  let shouldComplete = true;

  const timer = setTimeout(() => {
    if (!shouldComplete) {
      return;
    }
    shouldComplete = false;
    void wait.completeToken(token.id, null).catch(() => {
      // Ignore completion errors; token may already be completed or cancelled.
    });
  }, seconds * 1000);

  try {
    await wait.forToken(token.id);
    shouldComplete = false;
  } finally {
    clearTimeout(timer);
  }
}
