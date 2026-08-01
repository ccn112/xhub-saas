# Prisma delta notes

Add design-time models:

- WorkflowDefinition
- WorkflowVersion
- WorkflowPublishRequest
- FormDefinition
- FormVersion
- WorkflowTemplate

Add runtime models:

- WorkflowInstance
- WorkflowTask
- WorkflowToken
- WorkflowTimer
- WorkflowEvent
- WorkflowDelegation

Prefer `definition Json` and `compiledPlan Json` in WorkflowVersion for MVP. Runtime tables are normalized. Add RLS for every tenant-owned table.
