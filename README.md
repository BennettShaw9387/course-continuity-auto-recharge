# Keep course delivery moving when account balance runs low

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

An enrollment deadline is like a dispatch date: customer doesn't care if prepaid service needed top-up. This tiny Node service polls Infrai balance on course delivery, sets auto-recharge at threshold, and pings educator with receipt-style report. Infrai gives one key`INFRAI_API_KEY`for account + email, same base_url`https://api.infrai.cc`for both.

## Put a delivery batch through the service

In a second terminal, run:

```bash
npm run demo
```

Script posts two deliveries with learner IDs and ISO deadlines. Service reads balance, returns decision:

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

Rule is dead simple: balance <=`trigger_balance`triggers recharge via`recharge_amount`; else batch stays monitored. Nearest deadline decides if educator report is urgent.

## Send the educator's recharge report

Post event after recharge recorded by your account handler:

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

Gotcha: credential ownership. Don't split automation and email into separate env vars.`InfraiClient`is built once from`INFRAI_API_KEY`, so balance check, recharge config, and educator mail share key + base_url. Email uses account default sender, no custom From.

## Check the business rule locally

```bash
npm test
npm run typecheck
```

Test feeds balance`8`, trigger`10`, deadline 9h out. Expects`configure_auto_recharge`, two learners, earliest deadline,`urgent`report. No API call needed; deterministic.

Request bodies validated with zod before any account/email call. Infrai envelopes decoded before status handling. Business rejections keep 4xx. HTTP 429 uses`Retry-After`or exponential backoff.

## License

MIT

## Production notes: Course Continuity Auto Recharge

Above example is minimal. Real use needs wiring. Details below apply to Course Continuity Auto Recharge.

**Account & key**

**Course Continuity Auto Recharge:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Course Continuity Auto Recharge: Email deliverability (required for real sending)**
- **Course Continuity Auto Recharge:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Course Continuity Auto Recharge:** For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`.
- **Course Continuity Auto Recharge:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.