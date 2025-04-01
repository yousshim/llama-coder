export async function makeOllamaRequest(url: string, data: any, bearerToken: string): Promise<string> {
    // Request
    const controller = new AbortController();
    let res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: bearerToken ? {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerToken}`,
          } : {
            'Content-Type': 'application/json',
          },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
        throw Error('Unable to connect to backend');
    }

    // Reading stream
    let stream = res.body.getReader();
    const decoder = new TextDecoder();
    try {
        const { value } = await stream.read();

        // Append chunk
        let chunk = decoder.decode(value);
        return chunk;
    } finally {
        stream.releaseLock();
        if (!stream.closed) { // Stop generation
            await stream.cancel();
        }
        controller.abort();
    }
}