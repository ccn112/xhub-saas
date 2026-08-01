"use client";

// Sectioned block inside a form (Tailux "add-product-form" pattern): a titled
// group with optional description, and a vertical stack of fields.
import type { ReactNode } from "react";
import clsx from "clsx";

export function FormSection({
  title, description, children, className,
}: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && <h3 className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-100">{title}</h3>}
          {description && <p className="text-xs text-gray-400 dark:text-dark-300">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
