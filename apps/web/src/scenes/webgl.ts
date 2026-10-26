let available: boolean | undefined;

function probe(): boolean {
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}

export function webglAvailable(): boolean {
  available ??= probe();
  return available;
}
