/** Retry reads only: replaying a send after a timeout can duplicate messages. */
export async function evolutionFetch(url: string, init: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
  const readOnly = (init.method ?? "GET").toUpperCase() === "GET";
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; ; attempt++) {
    const remaining = Math.max(1, deadline - Date.now());
    let response: Response | undefined;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.min(readOnly ? 30000 : remaining, remaining)) });
      if (!readOnly || ![429, 502, 503, 504].includes(response.status) || attempt >= 2) return response;
    } catch (error) {
      if (!readOnly || attempt >= 2 || init.signal?.aborted) throw error;
      if (Date.now() >= deadline) throw error;
    }
    const retryAfter = response?.headers.get("Retry-After");
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    const requested = retryAfter
      ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now())
      : 2000 * (attempt + 1);
    const wait = Math.max(1000, Number.isFinite(requested) ? requested : 2000 * (attempt + 1));
    // Never ignore a long Retry-After or extend the request's total time budget.
    if (wait + 1000 >= deadline - Date.now()) {
      if (response) return response;
      throw new Error("Servidor do WhatsApp está temporariamente indisponível. Tente novamente em instantes.");
    }
    await response?.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/** Independent of agents/campaigns; does not send WhatsApp messages. */
export async function pingEvolution(): Promise<boolean> {
  const { base, key } = await (await import("@/lib/service-config.server")).getEvo();
  if (!base || !key) return false;
  const response = await evolutionFetch(`${base.replace(/\/$/, "")}/`, { headers: { apikey: key } }, 60000);
  await response.body?.cancel();
  return response.ok;
}