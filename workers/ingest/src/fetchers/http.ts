export async function readTextLimited(response: Response, maxBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  let reachedEnd = false;

  try {
    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        reachedEnd = true;
        break;
      }
      const remaining = maxBytes - bytesRead;
      const selected = value.byteLength <= remaining ? value : value.slice(0, remaining);
      bytesRead += selected.byteLength;
      chunks.push(decoder.decode(selected, { stream: true }));
      if (selected.byteLength < value.byteLength) {
        await reader.cancel();
        reachedEnd = true;
        break;
      }
    }
  } finally {
    if (!reachedEnd && bytesRead >= maxBytes) await reader.cancel();
    reader.releaseLock();
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}
