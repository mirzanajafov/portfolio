export async function fetchApplicationCv(
  code: string,
  { webUrl, token }: { webUrl: string; token: string },
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const response = await fetchImpl(`${webUrl}/internal/cv/${code}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`the site answered ${String(response.status)} for the CV of ${code}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
