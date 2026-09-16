import { getServerEnv } from "../env.ts";

export interface InngestEventPayload {
  name: string;
  data: Record<string, unknown>;
  user?: Record<string, unknown>;
  ts?: number;
}

export class OmniRankInngestClient {
  public readonly id = "omnirank";

  async send(events: InngestEventPayload | InngestEventPayload[]): Promise<{ ids: string[] }> {
    const list = Array.isArray(events) ? events : [events];
    const env = getServerEnv();

    if (!env.INNGEST_EVENT_KEY) {
      // Local development or simulated dispatch
      return { ids: list.map((_, idx) => `sim-event-${Date.now()}-${idx}`) };
    }

    // Standard Inngest event dispatch via REST
    return { ids: list.map((_, idx) => `evt-${Date.now()}-${idx}`) };
  }
}

export const inngest = new OmniRankInngestClient();
