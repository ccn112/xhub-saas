import Link from "next/link";
import { notFound } from "next/navigation";

import { getWorkflow, xofficeContext } from "@/xoffice/lib/workflow-data";
import {
  findFormNode,
  formCodeOf,
  getFormDefinition,
  inferFormNamespace,
} from "@/xoffice/lib/form-data";
import { RequestForm } from "@/xoffice/runtime/RequestForm";
import { SectionCard } from "@/xhub/ui/Card";

export const metadata = { title: "Tạo request · X.Office" };
export const dynamic = "force-dynamic";

export default async function CreateRequestPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { definition } = await getWorkflow(code);
  if (!definition) notFound();

  const ctx = xofficeContext();
  const identity = { tenantId: ctx.tenantId, userId: ctx.userId };

  const header = (
    <div className="flex items-center gap-2">
      <Link
        href={`/office/workflows/${code}/builder`}
        className="text-sm text-gray-400 transition hover:text-primary-600"
      >
        ← Builder
      </Link>
      <span className="text-gray-300">/</span>
      <div>
        <h1 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">
          Tạo request · {definition.metadata.name}
        </h1>
        <p className="font-mono text-tiny text-gray-400">{definition.metadata.code}</p>
      </div>
    </div>
  );

  const formNode = findFormNode(definition);
  const formCode = formNode ? formCodeOf(formNode) : null;

  if (!formNode || !formCode) {
    return (
      <div className="space-y-3">
        {header}
        <SectionCard title="Không có biểu mẫu">
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Quy trình này chưa có node biểu mẫu (<span className="font-mono">form</span>) nên chưa thể
            tạo request qua biểu mẫu. Hãy thêm node biểu mẫu trong builder hoặc dùng Giám sát vận hành.
          </p>
        </SectionCard>
      </div>
    );
  }

  const { form, source } = await getFormDefinition(formCode);
  if (!form) {
    return (
      <div className="space-y-3">
        {header}
        <SectionCard title="Không tìm thấy định nghĩa biểu mẫu">
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Node biểu mẫu trỏ tới <span className="font-mono">{formCode}</span> nhưng không tìm thấy
            định nghĩa tương ứng trong backend hoặc seed.
          </p>
        </SectionCard>
      </div>
    );
  }

  const namespace = inferFormNamespace(definition, form.jsonSchema);

  return (
    <div className="space-y-3">
      {header}
      <RequestForm
        workflowCode={code}
        workflowName={definition.metadata.name}
        formName={form.name}
        formCode={form.code}
        jsonSchema={form.jsonSchema}
        uiSchema={form.uiSchema}
        namespace={namespace}
        identity={identity}
        source={source}
      />
    </div>
  );
}
