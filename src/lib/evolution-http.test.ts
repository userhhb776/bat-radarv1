import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evolutionFetch, pingEvolution } from "./evolution-http.server";

vi.mock("@/lib/service-config.server", () => ({
  getEvo: async () => ({ base: "https://evolution.example", key: "test-only" }),
}));

describe("Evolution recovery", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("recovers a read after 429 and honors Retry-After", async () => {
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 429, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(new Response('{"state":"open"}'));
    const request = evolutionFetch("https://evolution.example/instance/fetchInstances");
    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await request).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after three read attempts", async () => {
    fetchMock.mockImplementation(async () => new Response("busy", { status: 503 }));
    const request = evolutionFetch("https://evolution.example/");
    await vi.runAllTimersAsync();
    expect((await request).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry permanent authentication failures", async () => {
    fetchMock.mockResolvedValue(new Response("denied", { status: 401 }));
    expect((await evolutionFetch("https://evolution.example/")).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not replay message sends even on 429", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 429 }));
    expect((await evolutionFetch("https://evolution.example/message/sendText", { method: "POST" })).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not replay a timed-out message send", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(evolutionFetch("https://evolution.example/message/sendText", { method: "POST" })).rejects.toThrow("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry before a long Retry-After outside the time budget", async () => {
    fetchMock.mockResolvedValue(new Response("busy", { status: 429, headers: { "Retry-After": "120" } }));
    expect((await evolutionFetch("https://evolution.example/")).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recovers a temporary read network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(new Response("ready"));
    const request = evolutionFetch("https://evolution.example/");
    await vi.runAllTimersAsync();
    expect((await request).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("pings the server root without querying agents or sending messages", async () => {
    fetchMock.mockResolvedValue(new Response("ready"));
    expect(await pingEvolution()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://evolution.example/");
    expect(fetchMock.mock.calls[0]?.[1]?.method ?? "GET").toBe("GET");
  });
});