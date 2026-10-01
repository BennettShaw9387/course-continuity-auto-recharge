import assert from "node:assert/strict";
import test from "node:test";
import { decideContinuity } from "../src/continuity_decision.js";

test("low balance with a near learner deadline requests recharge and an urgent report", () => {
  const decision = decideContinuity(
    [
      { course_id: "catalog-ops", learner_id: "learner-a", deadline: "2030-04-10T18:00:00.000Z" },
      { course_id: "checkout-ops", learner_id: "learner-b", deadline: "2030-04-12T09:00:00.000Z" },
      { course_id: "checkout-ops", learner_id: "learner-a", deadline: "2030-04-11T09:00:00.000Z" },
    ],
    8,
    10,
    new Date("2030-04-10T09:00:00.000Z"),
  );

  assert.deepEqual(decision, {
    action: "configure_auto_recharge",
    affected_learners: 2,
    next_deadline: "2030-04-10T18:00:00.000Z",
    report_priority: "urgent",
  });
});
