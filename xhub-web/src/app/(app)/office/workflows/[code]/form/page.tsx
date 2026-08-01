import Link from "next/link";

import seedForms from "@/data/xoffice/form-definitions.json";
import { getWorkflow } from "@/xoffice/lib/workflow-data";
import { FormBuilder, type FormTemplate } from "@/xoffice/form-builder/FormBuilder";

export const metadata = { title: "Trình thiết kế biểu mẫu · X.Office" };

interface SeedForm {
  code: string;
  name: string;
  jsonSchema: unknown;
  uiSchema: unknown;
}

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { definition } = await getWorkflow(code);
  const templates: FormTemplate[] = (seedForms as SeedForm[]).map((f) => ({
    code: f.code,
    name: f.name,
    jsonSchema: f.jsonSchema,
    uiSchema: f.uiSchema,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link href={`/office/workflows/${code}/builder`} className="text-sm text-gray-400 transition hover:text-primary-600">
          ← Builder
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">
          Thiết kế biểu mẫu {definition ? `· ${definition.metadata.name}` : ""}
        </h1>
      </div>
      <FormBuilder workflowCode={code} templates={templates} />
    </div>
  );
}
