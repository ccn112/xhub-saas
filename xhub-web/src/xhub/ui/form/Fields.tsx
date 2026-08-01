"use client";

// Small, dependency-light form primitives for the Tenant Admin "add-new" forms.
// Styled to match the purchased Tailux demo forms (labelled field, helper/error
// row, focus ring using the primary-* token). Reuses Headless UI (already in the
// project) for Switch. No extra dependencies.
import { forwardRef, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Switch } from "@headlessui/react";
import clsx from "clsx";

const controlBase =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-800 shadow-soft transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-700 dark:text-dark-50";
const borderOk = "border-gray-300 focus:border-primary-500 dark:border-dark-500";
const borderErr = "border-error focus:border-error focus:ring-error/30";

function FieldShell({
  label, htmlFor, required, error, hint, children,
}: { label?: string; htmlFor?: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-dark-100">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-400 dark:text-dark-300">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string;
}
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, required, className, id, ...rest }, ref,
) {
  const fieldId = id ?? rest.name;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} error={error} hint={hint}>
      <input ref={ref} id={fieldId} required={required} className={clsx(controlBase, error ? borderErr : borderOk, className)} {...rest} />
    </FieldShell>
  );
});

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string; hint?: string;
}
export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, error, hint, required, className, id, rows = 3, ...rest }, ref,
) {
  const fieldId = id ?? rest.name;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} error={error} hint={hint}>
      <textarea ref={ref} id={fieldId} rows={rows} required={required} className={clsx(controlBase, "resize-y", error ? borderErr : borderOk, className)} {...rest} />
    </FieldShell>
  );
});

export interface SelectFieldOption { value: string; label: string }
export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; hint?: string; options: SelectFieldOption[]; placeholder?: string;
}
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, required, className, id, options, placeholder, ...rest }, ref,
) {
  const fieldId = id ?? rest.name;
  return (
    <FieldShell label={label} htmlFor={fieldId} required={required} error={error} hint={hint}>
      <select ref={ref} id={fieldId} required={required} className={clsx(controlBase, "appearance-none pr-8", error ? borderErr : borderOk, className)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
});

export interface SwitchFieldProps {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}
export function SwitchField({ label, description, checked, onChange, disabled }: SwitchFieldProps) {
  return (
    <Switch.Group as="div" className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-dark-600">
      <span className="min-w-0">
        <Switch.Label as="span" className="block text-sm font-medium text-gray-700 dark:text-dark-100">{label}</Switch.Label>
        {description && <Switch.Description as="span" className="block text-xs text-gray-400 dark:text-dark-300">{description}</Switch.Description>}
      </span>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-primary-600" : "bg-gray-300 dark:bg-dark-500",
        )}
      >
        <span className={clsx("pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
      </Switch>
    </Switch.Group>
  );
}
