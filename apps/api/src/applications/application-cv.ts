import { reasonOf } from '../common/error-reason.js';

export class CvFetchError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export async function fetchApplicationCv(
  code: string,
  { webUrl, token }: { webUrl: string; token: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const fail = (error: unknown): never => {
    throw new CvFetchError(
      code,
      `the site at ${webUrl} did not send the CV of ${code} (${reasonOf(error)})`,
      { cause: error },
    );
  };
  const response = await fetchImpl(`${webUrl}/internal/cv/${code}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(fail);
  if (!response.ok) {
    throw new CvFetchError(
      code,
      `the site answered ${String(response.status)} for the CV of ${code}`,
    );
  }
  return Buffer.from(await response.arrayBuffer().catch(fail));
}
