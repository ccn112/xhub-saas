import type { NodeTypeDefinition } from './node-types';

export const nodeRegistry: NodeTypeDefinition[] = [
  { type: 'start', label: 'Bắt đầu', category: 'Luồng', configSchemaId: 'start', allowedIncoming: 0, allowedOutgoing: 1 },
  { type: 'approval', label: 'Phê duyệt', category: 'Con người', configSchemaId: 'approval', allowedIncoming: 'many', allowedOutgoing: 'many', aiCapabilities: ['suggest-assignment','suggest-sla'] },
  { type: 'condition', label: 'Điều kiện', category: 'Điều hướng', configSchemaId: 'condition', allowedIncoming: 'many', allowedOutgoing: 'many', aiCapabilities: ['natural-language-to-condition'] },
  { type: 'serviceCall', label: 'Gọi hệ thống', category: 'Tích hợp', configSchemaId: 'service-call', allowedIncoming: 'many', allowedOutgoing: 'many', aiCapabilities: ['suggest-mapping'] },
  { type: 'end', label: 'Kết thúc', category: 'Luồng', configSchemaId: 'end', allowedIncoming: 'many', allowedOutgoing: 0 }
];
