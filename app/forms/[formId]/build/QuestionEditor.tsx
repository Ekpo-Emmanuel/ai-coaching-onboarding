"use client";
import { useState } from "react";
import { Bell, BracketsCurly, Copy, Eye, Funnel, Plus } from "@phosphor-icons/react";
import { FieldRenderer } from "@/app/onboarding/FieldRenderer";
import { allFields } from "@/lib/onboarding/schema/visibility";
import type { FieldType, FormField, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { FIELD_TYPES } from "@/lib/forms/schema-ops";
import { newEntityId, toSnakeKey, uniqueKey } from "@/lib/forms/keys";
import { EMPTY_REVIEW_RULES, type ReviewRuleSet } from "@/lib/review/types";
import { ConditionEditor, firstCompareValue } from "./ConditionEditor";

export const TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long answer",
  email: "Email",
  phone: "Phone",
  date: "Date",
  number: "Number",
  single_select: "Single choice",
  multi_select: "Multiple choice",
  boolean: "Yes / no",
  scale: "Scale",
  acknowledgement: "Acknowledgement",
  unit_number: "Number with units",
};

const PLACEHOLDER_TYPES: FieldType[] = ["short_text", "long_text", "email", "phone", "number"];

export function QuestionEditor({
  field,
  schema,
  onChange,
  reviewRules,
  onRulesChange,
  onDelete,
}: {
  field: FormField;
  schema: OnboardingSchema;
  onChange: (patch: Partial<FormField> & { type?: FieldType }) => void;
  reviewRules: ReviewRuleSet | null;
  onRulesChange: (next: ReviewRuleSet) => void;
  onDelete: () => void;
}) {
  const [answerKey, setAnswerKey] = useState(field.key);
  const [copied, setCopied] = useState(false);
  const others = allFields(schema).filter((item) => item.id !== field.id);
  const rules = reviewRules ?? EMPTY_REVIEW_RULES;
  const linked = rules.rules.filter((rule) => rule.sourceFieldKeys.includes(field.key));
  const logicMode = field.logic ? "On" : "Off";

  function addReviewRule() {
    const id = newEntityId("rule");
    onRulesChange({
      version: "review_rules_v1",
      rules: [
        ...rules.rules,
        {
          id,
          code: uniqueKey(toSnakeKey("Coach review needed"), new Set(rules.rules.map((rule) => rule.code))),
          label: "Coach review needed",
          conditions: {
            all: [{ fieldKey: field.key, operator: field.type === "multi_select" ? "contains" : "equals", value: firstCompareValue(field) }],
          },
          sourceFieldKeys: [field.key],
        },
      ],
    });
  }

  function copyKey() {
    void navigator.clipboard.writeText(field.key).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="bw-question-editor">
      <section className="bw-q-card">
        <label>
          <span className="bw-field-caption">Question <span className="bw-required" aria-hidden="true">*</span></span>
          <textarea rows={2} value={field.label} required onChange={(event) => onChange({ label: event.target.value })} />
        </label>
        <label>
          <span className="bw-field-caption">Helper text <span className="bw-optional">(optional)</span></span>
          <textarea rows={3} value={field.description ?? ""} onChange={(event) => onChange({ description: event.target.value })} />
        </label>
        {PLACEHOLDER_TYPES.includes(field.type) ? (
          <label>
            Placeholder example
            <input value={field.placeholder ?? ""} onChange={(event) => onChange({ placeholder: event.target.value })} />
          </label>
        ) : null}
        <label>
          Answer type
          <select value={field.type} onChange={(event) => onChange({ type: event.target.value as FieldType })}>
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
        </label>
        {field.type === "single_select" || field.type === "multi_select" ? (
          <fieldset className="bw-options-editor">
            <legend>Answer choices</legend>
            <p className="bw-note">{field.type === "single_select" ? "Clients choose one answer." : "Clients can choose more than one answer."}</p>
            {field.options.map((option, index) => (
              <div className="bw-option-row" key={option.value}>
                <span>{index + 1}</span>
                <input aria-label={"Choice " + (index + 1)} value={option.label} onChange={(event) => onChange({ options: field.options.map((item, i) => i === index ? { ...item, label: event.target.value } : item) })} />
                <button type="button" className="bw-icon-button" aria-label={"Remove choice " + (index + 1)} disabled={field.options.length <= 1} onClick={() => onChange({ options: field.options.filter((_, i) => i !== index) })}>×</button>
              </div>
            ))}
            <button type="button" className="bw-secondary" onClick={() => onChange({ options: [...field.options, { label: "New choice", value: uniqueKey("choice", new Set(field.options.map((option) => option.value))) }] })}>Add choice</button>
          </fieldset>
        ) : null}
        {field.type === "scale" ? (
          <fieldset>
            <legend>Scale range</legend>
            <div className="bw-two">
              <label>Lowest number<input type="number" value={field.min} onChange={(event) => onChange({ min: Number(event.target.value) })} /></label>
              <label>Highest number<input type="number" value={field.max} onChange={(event) => onChange({ max: Number(event.target.value) })} /></label>
              <label>Low-end meaning<input value={field.lowLabel} onChange={(event) => onChange({ lowLabel: event.target.value })} /></label>
              <label>High-end meaning<input value={field.highLabel} onChange={(event) => onChange({ highLabel: event.target.value })} /></label>
            </div>
          </fieldset>
        ) : null}
        {field.type === "number" ? (
          <fieldset>
            <legend>Allowed answers</legend>
            <div className="bw-q-bounds">
              <label>Minimum<input type="number" value={field.validation?.min ?? ""} onChange={(event) => onChange({ validation: { ...field.validation, min: event.target.value === "" ? undefined : Number(event.target.value) } })} /></label>
              <label>Maximum<input type="number" value={field.validation?.max ?? ""} onChange={(event) => onChange({ validation: { ...field.validation, max: event.target.value === "" ? undefined : Number(event.target.value) } })} /></label>
            </div>
            <label className="bw-check"><input type="checkbox" checked={field.validation?.integer ?? false} onChange={(event) => onChange({ validation: { ...field.validation, integer: event.target.checked } })} />Whole numbers only</label>
          </fieldset>
        ) : null}
        {field.type === "unit_number" ? (
          <fieldset>
            <legend>Units and ranges</legend>
            <label>Starting unit<select value={field.defaultUnit} onChange={(event) => onChange({ defaultUnit: event.target.value })}>{field.units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label>
            {field.units.map((unit, index) => (
              <details className="bw-disclosure" key={unit.value}>
                <summary>{unit.label}</summary>
                <div className="bw-two">
                  <label>Unit label<input value={unit.label} onChange={(event) => onChange({ units: field.units.map((item, i) => i === index ? { ...item, label: event.target.value } : item) })} /></label>
                  <label>Minimum<input type="number" value={unit.min} onChange={(event) => onChange({ units: field.units.map((item, i) => i === index ? { ...item, min: Number(event.target.value) } : item) })} /></label>
                  <label>Maximum<input type="number" value={unit.max} onChange={(event) => onChange({ units: field.units.map((item, i) => i === index ? { ...item, max: Number(event.target.value) } : item) })} /></label>
                </div>
              </details>
            ))}
          </fieldset>
        ) : null}
        {field.type === "acknowledgement" ? <label>Statement to confirm<textarea rows={3} value={field.statement} onChange={(event) => onChange({ statement: event.target.value })} /></label> : null}
        <div className="bw-q-required">
          <span>
            Required response
            <small>Clients must answer this question to proceed</small>
          </span>
          <label className="bw-switch-wrap">
            <input className="bw-switch" type="checkbox" role="switch" aria-checked={field.required} checked={field.required} onChange={(event) => onChange({ required: event.target.checked })} />
            <span className="sr-only">Required response</span>
          </label>
        </div>
      </section>

      <section className="bw-q-card bw-q-preview" aria-label="Client preview">
        <div className="bw-q-preview-bar">
          <p className="eyebrow"><Eye size={14} aria-hidden="true" /> Client preview</p>
          <span className="status-badge" data-status="published">Live preview</span>
        </div>
        <fieldset disabled className="bw-q-preview-live">
          <FieldRenderer field={field} answers={{}} onChange={() => undefined} />
        </fieldset>
      </section>

      <details className="bw-q-card bw-q-fold">
        <summary>
          <span className="bw-q-fold-title"><Funnel size={16} aria-hidden="true" /> Conditional visibility</span>
          <span className="bw-q-meta">{logicMode}</span>
        </summary>
        <div>
          <p className="bw-note">Show or hide this question depending on answers given to previous questions.</p>
          <label className="bw-check">
            <input
              type="checkbox"
              checked={Boolean(field.logic)}
              disabled={!others.length}
              onChange={(event) => onChange({
                logic: event.target.checked
                  ? { action: "show", all: [{ fieldKey: others[0].key, operator: others[0].type === "multi_select" ? "contains" : "equals", value: firstCompareValue(others[0]) }] }
                  : undefined,
              })}
            />
            Only show this question for certain answers
          </label>
          {field.logic ? <ConditionEditor fields={others} value={field.logic} onChange={(next) => onChange({ logic: { action: "show", ...next } })} /> : <p className="bw-note">{others.length ? "Every client sees this question." : "Add another question to use conditional visibility."}</p>}
        </div>
      </details>

      <details className="bw-q-card bw-q-fold">
        <summary>
          <span className="bw-q-fold-title"><Bell size={16} aria-hidden="true" /> Review rules</span>
          <span className="bw-q-meta">{linked.length} {linked.length === 1 ? "rule" : "rules"}</span>
        </summary>
        <div>
          <p className="bw-note">Flag the submission for your attention when this question matches a condition. These rules do not assess medical risk.</p>
          {linked.map((rule) => (
            <div className="bw-q-rule" key={rule.id}>
              <strong>{rule.label}</strong>
              <button type="button" className="bw-icon-button" aria-label={"Remove " + rule.label} onClick={() => onRulesChange({ version: "review_rules_v1", rules: rules.rules.filter((item) => item.id !== rule.id) })}>×</button>
            </div>
          ))}
          <button type="button" className="bw-quiet" onClick={addReviewRule}><Plus size={16} aria-hidden="true" /> Configure another review rule</button>
        </div>
      </details>

      <details className="bw-q-card bw-q-fold">
        <summary>
          <span className="bw-q-fold-title"><BracketsCurly size={16} aria-hidden="true" /> Advanced identifier</span>
          <Copy size={16} aria-hidden="true" />
        </summary>
        <div>
          <p className="bw-note">Key used in exports and integrations. Changing it can affect conditional rules and saved answers.</p>
          <div className="bw-q-key">
            <input value={answerKey} aria-label="Answer key" onChange={(event) => setAnswerKey(event.target.value)} />
            <button type="button" className="bw-secondary" onClick={copyKey}>{copied ? "Copied" : <><Copy size={16} aria-hidden="true" />Copy</>}</button>
          </div>
          <button type="button" className="bw-secondary" disabled={answerKey === field.key} onClick={() => { if (window.confirm("Change the answer key? Existing rules and saved answers may depend on it.")) onChange({ key: answerKey }); }}>Update answer key</button>
        </div>
      </details>
      <button type="button" className="bw-text-danger" onClick={onDelete}>Delete question</button>
    </div>
  );
}
