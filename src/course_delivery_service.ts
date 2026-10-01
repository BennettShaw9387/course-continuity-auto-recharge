import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { decideContinuity, type CourseDelivery } from "./continuity_decision.js";
import { InfraiClient, InfraiError } from "./infrai_client.js";

const deliveryBody = z.object({
  deliveries: z.array(z.object({
    course_id: z.string().min(1),
    learner_id: z.string().min(1),
    deadline: z.string().datetime(),
  })).min(1),
  trigger_balance: z.number().nonnegative(),
  recharge_amount: z.number().positive(),
});

const rechargeEventBody = z.object({
  educator_email: z.string().email(),
  recharged_at: z.string().datetime(),
  recharge_amount: z.number().positive(),
  affected_learners: z.number().int().nonnegative(),
  next_deadline: z.string().datetime(),
});

type DeliveryRequest = {
  deliveries: CourseDelivery[];
  trigger_balance: number;
  recharge_amount: number;
};

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createCourseDeliveryServer(infrai: InfraiClient) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "POST" && request.url === "/course-deliveries") {
        const input = deliveryBody.parse(await readJson(request)) as DeliveryRequest;
        const current = await infrai.getBalance();
        const decision = decideContinuity(input.deliveries, current.balance, input.trigger_balance, new Date());
        if (decision.action === "configure_auto_recharge") {
          await infrai.configureAutoRecharge({
            trigger_balance: input.trigger_balance,
            recharge_amount: input.recharge_amount,
          });
        }
        json(response, 200, { balance: current.balance, decision });
        return;
      }

      if (request.method === "POST" && request.url === "/recharge-fired") {
        const event = rechargeEventBody.parse(await readJson(request));
        const sent = await infrai.sendEmail({
          to: event.educator_email,
          subject: `Course delivery balance restored for ${event.affected_learners} learners`,
          body: [
            `Recharge recorded at ${event.recharged_at}.`,
            `Amount: ${event.recharge_amount}.`,
            `Next learner deadline: ${event.next_deadline}.`,
          ].join("\n"),
        });
        json(response, 200, { notification: "sent", message_id: sent.message_id });
        return;
      }

      json(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        json(response, 400, { error: "Invalid request body", issues: error.issues });
        return;
      }
      if (error instanceof InfraiError) {
        const status = error.status >= 400 && error.status < 500 ? error.status : 502;
        json(response, status, { error: error.message, code: error.code });
        return;
      }
      json(response, 500, { error: "Request processing failed" });
    }
  });
}

if (process.env.NODE_ENV !== "test") {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const port = Number(process.env.PORT ?? "3000");
  createCourseDeliveryServer(new InfraiClient(apiKey)).listen(port, () => {
    console.log(`Course continuity service listening on http://localhost:${port}`);
  });
}
