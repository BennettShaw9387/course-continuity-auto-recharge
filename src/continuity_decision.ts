export type CourseDelivery = {
  course_id: string;
  learner_id: string;
  deadline: string;
};

export type ContinuityDecision = {
  action: "configure_auto_recharge" | "monitor";
  affected_learners: number;
  next_deadline: string;
  report_priority: "urgent" | "routine";
};

export function decideContinuity(
  deliveries: CourseDelivery[],
  balance: number,
  triggerBalance: number,
  now: Date,
): ContinuityDecision {
  const ordered = [...deliveries].sort((left, right) => Date.parse(left.deadline) - Date.parse(right.deadline));
  const next = ordered[0];
  if (!next) throw new Error("At least one course delivery is required");

  const hoursUntilDeadline = (Date.parse(next.deadline) - now.getTime()) / 3_600_000;
  return {
    action: balance <= triggerBalance ? "configure_auto_recharge" : "monitor",
    affected_learners: new Set(deliveries.map((delivery) => delivery.learner_id)).size,
    next_deadline: next.deadline,
    report_priority: hoursUntilDeadline <= 24 ? "urgent" : "routine",
  };
}
