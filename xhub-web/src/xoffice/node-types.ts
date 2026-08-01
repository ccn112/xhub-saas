export type WorkflowNodeType =
  | 'start' | 'end' | 'approval' | 'humanTask' | 'form'
  | 'condition' | 'parallelSplit' | 'parallelJoin' | 'timer'
  | 'notification' | 'serviceCall' | 'subflow' | 'aiAssist';

export interface NodeTypeDefinition {
  type: WorkflowNodeType;
  label: string;
  category: string;
  configSchemaId: string;
  allowedIncoming: number | 'many';
  allowedOutgoing: number | 'many';
  aiCapabilities?: string[];
}
