import { Card } from "./Card";

export interface AiRecapProps {
  title?: string;
  points: string[];
  footnote?: string;
}

/** X.AI recap card. AI assists reading/summarizing only — never auto-submits. */
export function AiRecap({ title = "X.AI tóm tắt", points, footnote }: AiRecapProps) {
  return (
    <Card className="border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-900 dark:bg-primary-950/30">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-sm text-white">✦</span>
        <h3 className="font-heading text-sm font-semibold text-primary-700 dark:text-primary-300">{title}</h3>
      </div>
      <ul className="space-y-2">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-dark-100">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-500" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      {footnote ? <p className="mt-3 text-xs text-gray-400 italic dark:text-dark-300">{footnote}</p> : null}
    </Card>
  );
}
