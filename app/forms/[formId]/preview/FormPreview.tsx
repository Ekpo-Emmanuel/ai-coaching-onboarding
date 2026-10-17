"use client";

import { useState } from "react";
import { OnboardingRenderer } from "@/app/onboarding/OnboardingRenderer";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";

export function FormPreview({
  schema,
  branding,
  compact = false,
}: {
  schema: OnboardingSchema;
  branding: { businessName: string; coachName: string; primaryColor: string | null };
  compact?: boolean;
}) {
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile");
  return (
    <div className={`form-preview${compact ? " form-preview--workspace" : ""}`} data-viewport={viewport}>
      <div className="preview-toolbar" role="group" aria-label="Preview viewport">
        <button type="button" aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>
          Mobile
        </button>
        <button type="button" aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>
          Desktop
        </button>
      </div>
      <div className="preview-frame" data-viewport={viewport}>
        <OnboardingRenderer
          schema={schema}
          mode="preview"
          persistAnswers={false}
          branding={branding}
          onSubmit={async () => undefined}
        />
      </div>
    </div>
  );
}
