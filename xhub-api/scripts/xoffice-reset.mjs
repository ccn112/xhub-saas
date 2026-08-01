// One-off: clear X.Office workflow/runtime rows so a reseed yields exactly the
// 12 pilot procedures (removes stale WF-* codes). Tenants are kept.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

await prisma.connectorCommand.deleteMany({});
await prisma.workflowEvent.deleteMany({});
await prisma.approvalTask.deleteMany({});
await prisma.workflowInstance.deleteMany({});
await prisma.auditLog.deleteMany({});
await prisma.workflowEdge.deleteMany({});
await prisma.workflowNode.deleteMany({});
await prisma.workflowVersion.deleteMany({});
await prisma.workflow.deleteMany({});

console.log('RESET OK | workflow + runtime rows cleared');
await prisma.$disconnect();
