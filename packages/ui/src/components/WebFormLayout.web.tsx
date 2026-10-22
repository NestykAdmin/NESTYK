import React from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "../icons/MobileIcon";
import type {
  WebFormSectionProps,
  WebFormSlotProps,
} from "./WebFormLayout.types";
import "./web-form-layout.css";

export function WebFormSection({
  children,
  enabled = true,
  title,
  description,
  steps,
  activeStep,
  onStepChange,
  busy,
  variant = "room",
}: WebFormSectionProps) {
  const { locale } = useLocale();
  if (!enabled) return <>{children}</>;
  return (
    <div className={`awf-layout awf-${variant}`} data-testid="agent-web-form">
      <aside className="awf-guide">
        <span className="awf-eyebrow">
          {locale === "th" ? "รายละเอียด" : "DETAILS"}
        </span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        <nav aria-label={title}>
          {steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              aria-current={activeStep === step.key ? "step" : undefined}
              disabled={busy || step.disabled || !onStepChange}
              onClick={() => onStepChange?.(step.key)}
            >
              <span
                className={`awf-step-index ${step.complete ? "is-complete" : ""} ${step.error ? "is-error" : ""}`}
              >
                {step.complete ? (
                  <MobileIcon name="check" size={14} color="currentColor" />
                ) : (
                  index + 1
                )}
              </span>
              <span>
                <strong>{step.label}</strong>
                {step.description && <small>{step.description}</small>}
              </span>
              {activeStep === step.key && <span className="awf-current-dot" />}
            </button>
          ))}
        </nav>
        <div className="awf-guide-note">
          <MobileIcon name="info" size={18} color="#aa8743" />
          <p>
            {locale === "th"
              ? "ตรวจสอบข้อมูลก่อนกดปุ่มบันทึก ข้อมูลจะถูกบันทึกเมื่อคุณยืนยันเท่านั้น"
              : "Review your details before saving. Your information is saved when you confirm."}
          </p>
        </div>
      </aside>
      <div className="awf-fields">{children}</div>
    </div>
  );
}
export function WebFormTabs({ children, enabled = true }: WebFormSlotProps) {
  return enabled ? null : <>{children}</>;
}
export function WebFormActions({ children, enabled = true }: WebFormSlotProps) {
  return enabled ? (
    <div className="awf-actions">{children}</div>
  ) : (
    <>{children}</>
  );
}
