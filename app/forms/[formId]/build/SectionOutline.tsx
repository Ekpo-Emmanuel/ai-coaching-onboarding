"use client";
import { CaretRight } from "@phosphor-icons/react";
import type { FormSection } from "@/lib/onboarding/schema/types";

export function SectionOutline({
  section,
  index,
  onOpen,
}: {
  section: FormSection;
  index: number;
  onOpen: () => void;
}) {
  const count = section.fields.length;
  return (
    <button type="button" className="bw-section-row" onClick={onOpen}>
      <span className="bw-section-number">{String(index + 1).padStart(2, "0")}</span>
      <span>
        <strong>{section.title || "Untitled section"}</strong>
        <small>
          {count} {count === 1 ? "question" : "questions"}
        </small>
      </span>
      <CaretRight size={16} aria-hidden="true" />
    </button>
  );
}
