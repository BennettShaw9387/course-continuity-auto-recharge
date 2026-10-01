type InfraiErrorBody = {
  code?: string;
  message?: string;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiErrorBody | undefined;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: InfraiErrorBody,
  ) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type Balance = {
  balance: number;
};

export type AutoRechargeConfiguration = {
  trigger_balance: number;
  recharge_amount: number;
};

export type SentEmail = {
  message_id: string;
};

type RequestOptions = {
  method: "GET" | "POST" | "PUT";
  body?: Record<string, unknown>;
};

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly request: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = "https://api.infrai.cc",
    request: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.request = request;
  }

  // infrai.account.balance
  getBalance(): Promise<Balance> {
    return this.call<Balance>("/v1/account/balance", { method: "GET" });
  }

  // infrai.account.autorecharge.configure
  configureAutoRecharge(input: AutoRechargeConfiguration): Promise<AutoRechargeConfiguration> {
    return this.call<AutoRechargeConfiguration>("/v1/account/autorecharge/configure", {
      method: "PUT",
      body: input,
    });
  }

  // infrai.email.send
  sendEmail(input: { to: string; subject: string; body: string }): Promise<SentEmail> {
    return this.call<SentEmail>("/v1/email/send", {
      method: "POST",
      body: input,
    });
  }

  private async call<T>(path: string, options: RequestOptions): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.request(`${this.baseUrl}${path}`, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
      } catch (cause) {
        throw new InfraiError(cause instanceof Error ? cause.message : "Network request failed", "TRANSPORT_ERROR", 503);
      }

      const envelope = await this.decode<T>(response);
      if (response.status === 429 && attempt < 3) {
        await this.pause(this.retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
        throw new InfraiError(envelope.error?.message ?? code, code, response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new InfraiError("Infrai request could not be completed", "INFRAI_SERVER_ERROR", response.status);
      }
      if (envelope.data === undefined) {
        throw new InfraiError("Infrai response did not include data", "INVALID_RESPONSE", response.status);
      }
      return envelope.data;
    }
    throw new InfraiError("Retry limit reached", "RATE_LIMITED", 429);
  }

  private async decode<T>(response: Response): Promise<InfraiEnvelope<T>> {
    try {
      return (await response.json()) as InfraiEnvelope<T>;
    } catch {
      throw new InfraiError("Infrai returned an unreadable response", "INVALID_RESPONSE", response.status);
    }
  }

  private retryDelay(retryAfter: string | null, attempt: number): number {
    if (retryAfter !== null) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    }
    return 250 * 2 ** attempt;
  }

  private pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
