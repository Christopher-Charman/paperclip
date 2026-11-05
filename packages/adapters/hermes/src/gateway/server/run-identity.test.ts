import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { execute } from "./execute.js";

function context(): AdapterExecutionContext {
  const config = { apiBaseUrl: "http://127.0.0.1:8642", apiKey: "test-only-key", timeoutSec: 5, pollIntervalMs: 250 };
  return {
    runId: "pc-run-1",
    agent: { id: "agent-1", companyId: "company-1", name: "Hermes", adapterType: "hermes_gateway", adapterConfig: config },
    runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
    config,
    context: { issueId: "issue-1", wakeReason: "manual" },
    onLog: vi.fn(async () => undefined),
    onMeta: vi.fn(async () => undefined),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Hermes gateway run identity", () => {
  it("does not accept a different run's terminal SSE event", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/v1/runs")) return Response.json({ run_id: "run-expected", status: "started" });
      if (String(url).endsWith("/events")) {
        const events = [
          "event: run.completed",
          'data: {"run_id":"run-foreign","status":"completed","output":"wrong"}',
          "",
          "event: run.completed",
          'data: {"run_id":"run-expected","runId":"run-foreign","status":"completed","output":"conflicting"}',
          "",
          "event: run.completed",
          'data: {"run_id":"run-expected","status":"completed","output":"right"}',
          "",
          "",
        ].join("\n");
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new TextEncoder().encode(events));
          controller.close();
        }}), { headers: { "content-type": "text/event-stream" } });
      }
      return Response.json({ run_id: "run-expected", status: "running" });
    }));
    const result = await execute(context());
    expect(result.exitCode).toBe(0);
    expect(result.summary).toBe("right");
  });

  it("ignores another run's terminal polling result", async () => {
    let polls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/v1/runs")) return Response.json({ run_id: "run-expected", status: "started" });
      if (String(url).endsWith("/events")) return new Response("unavailable", { status: 503 });
      polls += 1;
      return Response.json(polls === 1
        ? { run_id: "run-foreign", status: "completed", output: "wrong" }
        : { run_id: "run-expected", status: "completed", output: "right" });
    }));
    const result = await execute(context());
    expect(result.exitCode).toBe(0);
    expect(result.summary).toBe("right");
    expect(polls).toBeGreaterThanOrEqual(2);
  });
});
