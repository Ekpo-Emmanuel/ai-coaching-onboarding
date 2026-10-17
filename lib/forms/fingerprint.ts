import { EMPTY_REVIEW_RULES } from "@/lib/review/types";

export function formSnapshotFingerprint(value: {
  schema: unknown;
  identity: unknown;
  reviewRules: unknown;
}) {
  return JSON.stringify({
    schema: value.schema,
    identity: value.identity ?? null,
    reviewRules: value.reviewRules ?? EMPTY_REVIEW_RULES,
  });
}
