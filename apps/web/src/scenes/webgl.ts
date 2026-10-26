let available: boolean | undefined;

function probe(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}

export function webglAvailable(): boolean {
  available ??= probe();
  return available;
}
