"use client";
import { useState } from "react";
import { CaretDown, CaretRight, CaretUp, GearSix, Plus } from "@phosphor-icons/react";
import { Sheet } from "@/components/product/Sheet";
import type { FormSection, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { TYPE_LABELS } from "./QuestionEditor";

export function SectionInspector({
  section,
  schema,
  onOpenQuestion,
  onAddQuestion,
  onRename,
  onIntro,
  onMove,
  onDelete,
}: {
  section: FormSection;
  schema: OnboardingSchema;
  onOpenQuestion: (id: string) => void;
  onAddQuestion: () => void;
  onRename: (title: string) => void;
  onIntro: (description: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [details, setDetails] = useState(false);
  const index = schema.sections.findIndex((item) => item.id === section.id);
  const count = section.fields.length;
  const last = schema.sections.length - 1;
  return (
    <div className="bw-section-view">
      <div className="bw-section-head">
        <div>
          <h2 tabIndex={-1}>{section.title || "Untitled section"}</h2>
          {section.description ? <p className="bw-section-intro">{section.description}</p> : null}
        </div>
        <button type="button" className="bw-icon-button bw-section-gear" aria-label="Section details" onClick={() => setDetails(true)}>
          <GearSix size={20} />
        </button>
      </div>
      <p className="bw-count-pill">{count} {count === 1 ? "question" : "questions"}</p>
      {count ? <div className="bw-question-list">
        {section.fields.map((field, fieldIndex) => (
          <button type="button" className="bw-question-row" key={field.id} onClick={() => onOpenQuestion(field.id)}>
            <span className="bw-question-number">{String(fieldIndex + 1).padStart(2, "0")}</span>
            <span>
              <strong>{field.label || "Untitled question"}</strong>
              <small>
                {TYPE_LABELS[field.type]}
                <span className="status-badge" data-status={field.required ? "published" : "changes"}>{field.required ? "Required" : "Optional"}</span>
                {field.logic ? <span className="status-badge" data-status="proposed">Conditional</span> : null}
              </small>
            </span>
            <CaretRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div> : null}
      <button type="button" className="bw-add-question" onClick={onAddQuestion}>
        <Plus size={16} aria-hidden="true" />
        <span className="bw-add-short">Add question</span>
        <span className="bw-add-full">Add question to section</span>
      </button>
      <div className="bw-section-foot">
        <div className="bw-section-move">
          <button type="button" className="bw-quiet" disabled={index <= 0} onClick={() => onMove(-1)}><CaretUp size={14} aria-hidden="true" />Move up</button>
          <button type="button" className="bw-quiet" disabled={index < 0 || index >= last} onClick={() => onMove(1)}><CaretDown size={14} aria-hidden="true" />Move down</button>
        </div>
        <button type="button" className="bw-text-danger" disabled={schema.sections.length <= 1} onClick={onDelete}>Delete section</button>
      </div>
      <details className="bw-disclosure bw-section-details">
        <summary>Section details</summary>
        <div>
          {sectionFields(section, schema.sections.length, onRename, onIntro, onDelete)}
        </div>
      </details>
      {details ? (
        <Sheet titleId="section-details-title" onClose={() => setDetails(false)}>
          <form className="bw-section-form" onSubmit={(event) => { event.preventDefault(); setDetails(false); }}>
            <p className="eyebrow">Form structure</p>
            <h2 id="section-details-title">Section details</h2>
            {sectionFields(section, schema.sections.length, onRename, onIntro, onDelete)}
            <div className="bw-dialog-actions"><button type="submit" className="bw-primary">Done</button></div>
          </form>
        </Sheet>
      ) : null}
    </div>
  );
}

function sectionFields(
  section: FormSection,
  count: number,
  onRename: (title: string) => void,
  onIntro: (description: string) => void,
  onDelete: () => void,
) {
  return <>
    <label>Section name<input value={section.title} onChange={(event) => onRename(event.target.value)} /></label>
    <label>Section introduction<textarea rows={3} value={section.description ?? ""} onChange={(event) => onIntro(event.target.value)} /></label>
    <button type="button" className="bw-text-danger bw-details-delete" disabled={count <= 1} onClick={onDelete}>Delete section</button>
  </>;
}
