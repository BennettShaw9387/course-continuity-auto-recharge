const baseUrl = process.env.SERVICE_URL ?? "http://localhost:3000";

const deliveryResponse = await fetch(`${baseUrl}/course-deliveries`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    deliveries: [
      { course_id: "checkout-basics", learner_id: "learner-104", deadline: "2030-04-12T12:00:00.000Z" },
      { course_id: "returns-workshop", learner_id: "learner-219", deadline: "2030-04-13T12:00:00.000Z" },
    ],
    trigger_balance: 10,
    recharge_amount: 50,
  }),
});

console.log(JSON.stringify(await deliveryResponse.json(), null, 2));

export {};
