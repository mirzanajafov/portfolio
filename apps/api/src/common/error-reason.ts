export function reasonOf(error: unknown): string {
  const failure = error instanceof Error && error.cause !== undefined ? error.cause : error;
  if (failure instanceof Error && 'code' in failure && typeof failure.code === 'string') {
    return failure.code;
  }
  return failure instanceof Error ? failure.message : String(failure);
}
