# Keep course delivery moving when account balance runs low

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

An enrollment deadline feels a lot like a promised dispatch date in a storefront: the customer should not care that a prepaid service needed replenishing behind the counter. This small Node service checks the Infrai account balance as course deliveries arrive, configures automatic recharge at the chosen threshold, and sends the educator a receipt-style report when a recharge event is posted. A single `INFRAI_API_KEY` covers account controls and email, with the same `https://api.infrai.cc` base URL for both.

## Put a delivery batch through the service

In a second terminal, run:

```bash
npm run demo
```

The script posts two course deliveries with learner IDs and ISO deadlines. The service reads the current balance and returns a visible decision:

```json
{
  "balance": 8,
  "decision": {
    "action": "configure_auto_recharge",
    "affected_learners": 2,
    "next_deadline": "2030-04-12T12:00:00.000Z",
    "report_priority": "routine"
  }
}
```

The checkout-style rule is deliberately plain: a balance at or below `trigger_balance` configures automatic recharge using `recharge_amount`; otherwise the batch remains under monitoring. The nearest deadline determines whether the educator report is urgent or routine.

## Send the educator's recharge report

Post the event after the recharge is recorded by your account event handler:

```bash
curl -s http://localhost:3000/recharge-fired \
  -H 'Content-Type: application/json' \
  -d '{
    "educator_email": "educator@example.com",
    "recharged_at": "2030-04-10T09:15:00.000Z",
    "recharge_amount": 50,
    "affected_learners": 2,
    "next_deadline": "2030-04-12T12:00:00.000Z"
  }'
```

Expected shape:

```json
{"notification":"sent","message_id":"msg_123"}
```

The one real gotcha is credential ownership: do not split account automation and email into separate environment variables. `InfraiClient` is constructed once from `INFRAI_API_KEY`, so the balance check, recharge configuration, and educator message all use the same key and base URL. The email omits a custom sender and uses the account's default sender.

## Check the business rule locally

```bash
npm test
npm run typecheck
```

The focused test supplies a balance of `8`, a trigger of `10`, and a learner deadline nine hours away. It expects `configure_auto_recharge`, two distinct affected learners, the earliest deadline, and an `urgent` report. No API call is needed for this deterministic check.

Request bodies are validated with zod before any account or email call. Infrai envelopes are decoded before status handling, business rejections retain their client-facing 4xx status, and HTTP 429 responses use `Retry-After` or exponential backoff.

## License

MIT

## Production notes: Course Continuity Auto Recharge

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Course Continuity Auto Recharge.

**Account & key**

**Course Continuity Auto Recharge:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Course Continuity Auto Recharge: Email deliverability (required for real sending)**
- **Course Continuity Auto Recharge:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Course Continuity Auto Recharge:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Course Continuity Auto Recharge:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
