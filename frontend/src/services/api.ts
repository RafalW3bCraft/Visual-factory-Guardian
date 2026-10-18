import { z } from "zod";
const id = z.string().min(1);
const time = z.iso.datetime({ offset: true });
export const eventSchema = z.object({
  schema_version: z.literal("1.0"),
  event_id: id,
  timestamp: time,
  scenario_id: id,
  line_id: id,
  image_id: id,
  source: z.enum(["public_dataset", "simulated", "real", "recorded"]),
  detection: z
    .object({
      model: id,
      anomaly_score: z.number().finite(),
      localization_ref: z.string().nullable().optional(),
    })
    .nullable(),
});
export const sensorSchema = z.object({
  timestamp: time,
  scenario_id: id,
  line_id: id,
  sensor_id: id,
  metric: z.enum(["temperature", "vibration", "current"]),
  value: z.number().finite(),
  unit: id,
  source: z.enum(["simulated", "real"]),
  fault_state: z.string().nullable().optional(),
});
export const analysisSchema = z.object({
  event_id: id,
  scenario_id: id,
  line_id: id,
  explanation: z.string(),
  sensor_evidence: z.array(
    z.object({ evidence_id: id, metric: id, summary: z.string() }),
  ),
  candidate_causes: z.array(
    z.object({ label: id, evidence_ids: z.array(id), uncertainty: z.string() }),
  ),
  manual_citations: z.array(
    z.object({ title: id, reference: id, excerpt: z.string() }),
  ),
  recommended_action: z.string().nullable(),
});
export type ApiEvent = z.infer<typeof eventSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export const healthSchema = z.object({
  status: z.literal("ok"),
  capabilities: z.array(z.string()),
});
export const requiredCapabilities = [
  "scenarios",
  "events",
  "sensors",
  "analysis",
];
export class GuardianApi {
  readonly base: string;
  constructor(
    base: string,
    private fetcher: typeof fetch = fetch,
    /**
     * Per-request HTTP timeout in milliseconds. Most endpoints are fast
     * (sub-second) and use the default 8 s ceiling. The analysis endpoint
     * can involve a remote LLM call that legitimately takes longer, so we
     * expose a separate timeout for that call only. Both are still bounded
     * so a hung backend does not stall the operator UI indefinitely.
     */
    private timeoutMs: number = 8000,
    private analysisTimeoutMs: number = 30000,
  ) {
    if (!base)
      throw new Error(
        "Live backend is not configured. Set VITE_API_BASE_URL and rebuild.",
      );
    const url = new URL(base);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Backend URL must use HTTP or HTTPS.");
    this.base = base.replace(/\/$/, "");
  }
  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<T> {
    const controller = new AbortController();
    const ms = timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), ms);
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    try {
      const response = await this.fetcher(`${this.base}/api/v1${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`Backend returned HTTP ${response.status}.`);
      const result = schema.safeParse(await response.json());
      if (!result.success)
        throw new Error(
          "Backend response does not match the documented frontend contract.",
        );
      return result.data;
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error("Backend request timed out or was cancelled.");
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  async health(signal?: AbortSignal) {
    const health = await this.request(
      "/health",
      healthSchema,
      "GET",
      undefined,
      signal,
    );
    if (!requiredCapabilities.every((x) => health.capabilities.includes(x)))
      throw new Error(
        "Backend is reachable, but the complete investigation API is not ready.",
      );
    return health;
  }
  start(signal?: AbortSignal) {
    return this.request(
      "/scenarios/start",
      z.object({ scenario_id: id, line_id: id }),
      "POST",
      { scenario_id: "thermal-drift-001" },
      signal,
    );
  }
  stop(scenario_id: string, signal?: AbortSignal) {
    return this.request(
      "/scenarios/stop",
      z.object({ status: z.literal("stopped") }),
      "POST",
      { scenario_id },
      signal,
    );
  }
  events(scenario_id: string, signal?: AbortSignal) {
    return this.request(
      `/events?scenario_id=${encodeURIComponent(scenario_id)}`,
      z.array(eventSchema),
      "GET",
      undefined,
      signal,
    );
  }
  sensors(scenario_id: string, line_id: string, signal?: AbortSignal) {
    return this.request(
      `/sensors?scenario_id=${encodeURIComponent(scenario_id)}&line_id=${encodeURIComponent(line_id)}`,
      z.array(sensorSchema),
      "GET",
      undefined,
      signal,
    );
  }
  analysis(event: ApiEvent, signal?: AbortSignal) {
    return this.request(
      `/analysis/${encodeURIComponent(event.event_id)}`,
      analysisSchema,
      "GET",
      undefined,
      signal,
      // Allow the analysis call more wall-clock time than the default 8 s
      // ceiling. A remote LLM explanation is the legitimate slow path;
      // 30 s is still bounded so a hung backend does not stall the UI.
      this.analysisTimeoutMs,
    ).then((data) => {
      if (
        data.event_id !== event.event_id ||
        data.scenario_id !== event.scenario_id ||
        data.line_id !== event.line_id
      )
        throw new Error("Analysis identity does not match the selected event.");
      return data;
    });
  }
}
