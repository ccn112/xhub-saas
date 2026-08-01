// X.Office golden-path E2E smoke test (hits the live backend on :4000).
// Run: node scripts/xoffice-e2e-smoke.mjs  (server must be running)
// Asserts the full lifecycle: list → validate → simulate → publish(immutable)
// → request → task → act → audit → connector command.
const BASE = process.env.XOFFICE_BASE || "http://localhost:4000";
const H = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" };
const CODE = process.env.XOFFICE_CODE || "PILOT-01";

let failed = 0;
const ok = (c, m) => { if (c) console.log("  ✓ " + m); else { console.error("  ✗ " + m); failed++; } };
const j = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { headers: H, ...opts });
  return { status: r.status, body: await r.json().catch(() => null) };
};

console.log("X.Office golden-path E2E smoke @ " + BASE);

// 1. list + definition
const list = await j("/api/xoffice/workflows");
ok(list.status === 200 && Array.isArray(list.body) && list.body.length >= 3, `list workflows (${list.body?.length})`);
const def = await j(`/api/xoffice/workflows/${CODE}`);
ok(def.status === 200 && Array.isArray(def.body?.nodes), `get definition (${def.body?.nodes?.length} nodes)`);

// 2. validate + simulate
const val = await j(`/api/xoffice/workflows/${CODE}/validate`, { method: "POST", body: JSON.stringify(def.body) });
ok(val.status < 400 && Array.isArray(val.body?.issues), `validate (${val.body?.issues?.length} issues)`);
const sim = await j(`/api/xoffice/workflows/${CODE}/simulate`, { method: "POST", body: JSON.stringify({ definition: def.body, testData: { request: { amount: 250000000 } } }) });
ok(sim.status < 400 && sim.body?.reachedEnd === true, "simulate reaches end");

// 3. publish twice → version increments, old immutable
const p1 = await j(`/api/xoffice/workflows/${CODE}/publish`, { method: "POST", body: JSON.stringify(def.body) });
const p2 = await j(`/api/xoffice/workflows/${CODE}/publish`, { method: "POST", body: JSON.stringify(def.body) });
ok(p1.body?.version && p2.body?.version && p2.body.version > p1.body.version, `publish increments version (${p1.body?.version}→${p2.body?.version})`);
const versions = await j(`/api/xoffice/workflows/${CODE}/versions`);
ok(versions.status === 200 && Array.isArray(versions.body) && versions.body.length >= 2, `versions listed (${versions.body?.length})`);

// 4. request → task → act → audit
const req = await j(`/api/xoffice/workflows/${CODE}/requests`, { method: "POST", body: JSON.stringify({ title: "E2E smoke request", variables: { request: { title: "Mua server", amount: 250000000, purpose: "E2E" }, requesterEmail: "nam@xtech.local" } }) });
ok(req.status < 400 && req.body?.instance, "create request → instance");
const firstTask = req.body?.task?.id;
ok(!!firstTask, "first approval task created");
let acted = firstTask ? await j(`/api/xoffice/tasks/${firstTask}/act`, { method: "POST", body: JSON.stringify({ action: "approve", note: "E2E" }) }) : { body: null };
ok(acted.body?.instance, "act on task → instance advances");
const audit = await j("/api/xoffice/audit");
ok(audit.status === 200 && Array.isArray(audit.body) && audit.body.length > 0, `audit log has entries (${audit.body?.length})`);

// 5. connectors catalog reachable
const conn = await j("/api/xoffice/connectors");
const catalog = conn.body?.connectors ?? conn.body;
ok(conn.status === 200 && Array.isArray(catalog) && catalog.length >= 3, `connector catalog (${catalog?.length})`);

// 6. UnifiedWorkItem projection (SoR read model) — rebuildable + SourceReference
const wi = await j("/api/xoffice/work-items");
const xofficeItem = Array.isArray(wi.body) ? wi.body.find((i) => i.sourceSystem === "XOFFICE") : null;
ok(wi.status === 200 && Array.isArray(wi.body) && wi.body.length >= 1, `work-items projection (${wi.body?.length})`);
ok(!!xofficeItem && !!xofficeItem.sourceId && !!xofficeItem.ownerSystem && Array.isArray(xofficeItem.allowedActionsSnapshot),
   "work-item carries SourceReference (sourceSystem=XOFFICE)");
const rb1 = await j("/api/xoffice/work-items/rebuild", { method: "POST" });
const rb2 = await j("/api/xoffice/work-items/rebuild", { method: "POST" });
ok(rb1.body?.count >= 1 && rb1.body.count === rb2.body?.count, `rebuild stable count (${rb1.body?.count}→${rb2.body?.count})`);

// 7. idempotency — same idempotencyKey → exactly one instance created
const idemKey = "e2e-idem-" + Date.now();
const IH = { ...H, "x-idempotency-key": idemKey };
const reqBody = JSON.stringify({ title: "E2E idem", variables: { request: { title: "Idem", amount: 1000, purpose: "idem" } } });
const before = await j("/api/xoffice/instances");
const iA = await fetch(BASE + `/api/xoffice/workflows/${CODE}/requests`, { method: "POST", headers: IH, body: reqBody }).then((r) => r.json());
const iB = await fetch(BASE + `/api/xoffice/workflows/${CODE}/requests`, { method: "POST", headers: IH, body: reqBody }).then((r) => r.json());
const after = await j("/api/xoffice/instances");
ok(iA?.instance?.instanceCode && iA.instance.instanceCode === iB?.instance?.instanceCode, "idempotent replay returns same instance");
ok((after.body?.length ?? 0) === (before.body?.length ?? 0) + 1, `idempotent key creates exactly 1 instance (${before.body?.length}→${after.body?.length})`);

// 8. workflow count (12 pilots + 1 complex demo = 13)
ok(Array.isArray(list.body) && list.body.length === 13, `workflows count = 13 (${list.body?.length})`);

// ---- OPERATIONAL LAYER (P0) --------------------------------------------
// helper that lets us override x-user-id per call
const ju = async (path, uid, opts = {}) =>
  j(path, { ...opts, headers: { ...H, "x-user-id": uid, ...(opts.headers ?? {}) } });

// 9. assignment resolution + delegation
const req9 = await j(`/api/xoffice/workflows/${CODE}/requests`, { method: "POST", body: JSON.stringify({ title: "E2E assign", variables: { request: { title: "Assign", amount: 5000, purpose: "assign" } } }) });
const mgrTask = req9.body?.task?.id;
ok(!!mgrTask, "req9 → first task (MGR queue)");
// approve MGR as user-nam (queue task → any actor allowed) → next task = IT (mapped role)
const r9a = await j(`/api/xoffice/tasks/${mgrTask}/act`, { method: "POST", body: JSON.stringify({ action: "approve" }) });
const itTask = r9a.body?.nextTask;
ok(!!itTask?.assigneeUserId, `task resolved to real user (assigneeUserId=${itTask?.assigneeUserId})`);
const assignee = itTask?.assigneeUserId;
// intruder (not assignee, no delegation) is rejected
const intruder = await ju(`/api/xoffice/tasks/${itTask?.id}/act`, "user-intruder", { method: "POST", body: JSON.stringify({ action: "approve" }) });
ok(intruder.status === 403, `intruder blocked (status ${intruder.status})`);
// create delegation assignee → delegate-bob, then bob acts on behalf
const del = await j(`/api/xoffice/delegations`, { method: "POST", body: JSON.stringify({ fromUserId: assignee, toUserId: "delegate-bob" }) });
ok(del.status < 400 && del.body?.id, "delegation created");
const r9b = await ju(`/api/xoffice/tasks/${itTask?.id}/act`, "delegate-bob", { method: "POST", body: JSON.stringify({ action: "approve", note: "via delegation" }) });
ok(!!r9b.body?.instance, "delegate acted on behalf of assignee");
const auditD = await j("/api/xoffice/audit");
ok(Array.isArray(auditD.body) && auditD.body.some((a) => /on behalf of/i.test(a.detail)), "audit records onBehalfOf");
const delList = await j("/api/xoffice/delegations");
ok(Array.isArray(delList.body) && delList.body.length >= 1, `delegations listed (${delList.body?.length})`);

// 10. assigned notification + read receipt (for the resolved assignee)
const notifs = await ju("/api/xoffice/notifications", assignee);
ok(Array.isArray(notifs.body) && notifs.body.some((n) => n.type === "task.assigned"), `assignee has 'assigned' notification (${notifs.body?.length})`);
const uc0 = await ju("/api/xoffice/notifications/unread-count", assignee);
const firstNotif = notifs.body?.find((n) => !n.readAt);
const rd = firstNotif ? await ju(`/api/xoffice/notifications/${firstNotif.id}/read`, assignee, { method: "POST" }) : { body: null };
ok(!!rd.body?.readAt, "mark notification read");
const uc1 = await ju("/api/xoffice/notifications/unread-count", assignee);
ok((uc1.body?.count ?? 99) === (uc0.body?.count ?? 0) - 1, `unread-count decreased (${uc0.body?.count}→${uc1.body?.count})`);

// 11. SLA escalation via scheduler tick (fixed clock → force overdue)
const req11 = await j(`/api/xoffice/workflows/${CODE}/requests`, { method: "POST", body: JSON.stringify({ title: "E2E escalate", variables: { request: { title: "Escalate", amount: 5000, purpose: "escalate" } } }) });
const r11a = await j(`/api/xoffice/tasks/${req11.body?.task?.id}/act`, { method: "POST", body: JSON.stringify({ action: "approve" }) });
const itTask11 = r11a.body?.nextTask?.id;
const tick = await j("/api/xoffice/scheduler/tick", { method: "POST", body: JSON.stringify({ simulateOverdueTaskId: itTask11 }) });
ok(tick.status < 400 && (tick.body?.escalations ?? 0) >= 1, `tick produced escalation (${tick.body?.escalations})`);
const tasks11 = await j("/api/xoffice/tasks");
const escTask = Array.isArray(tasks11.body) ? tasks11.body.find((t) => t.id === itTask11) : null;
ok(!!escTask && escTask.escalated === true, "escalated task flagged escalated=true");
const escNotifs = await ju("/api/xoffice/notifications", r11a.body?.nextTask?.assigneeUserId ?? assignee);
ok(Array.isArray(escNotifs.body) && escNotifs.body.some((n) => n.type === "task.escalated"), "escalation notification dispatched");

// 12. tenant isolation — demo-isolation must 404 on the new surfaces
const DH = { ...H, "x-tenant-id": "tenant-demo-isolation" };
const isoN = await fetch(BASE + "/api/xoffice/notifications", { headers: DH }).then((r) => r.status);
const isoD = await fetch(BASE + "/api/xoffice/delegations", { headers: DH }).then((r) => r.status);
ok(isoN === 404, `notifications demo-isolation → 404 (${isoN})`);
ok(isoD === 404, `delegations demo-isolation → 404 (${isoD})`);

// ---- COMPLEX ENGINE (condition + parallel split/join + subflow) --------
const CX = "WF-COMPLEX-DEMO";
console.log("\n-- complex engine: " + CX + " --");

// 13. definition + validate (parallelJoin with 2 incoming must NOT error)
const cxDef = await j(`/api/xoffice/workflows/${CX}`);
ok(cxDef.status === 200 && Array.isArray(cxDef.body?.nodes), `complex definition (${cxDef.body?.nodes?.length} nodes)`);
const cxVal = await j(`/api/xoffice/workflows/${CX}/validate`, { method: "POST", body: JSON.stringify(cxDef.body) });
const cxErrors = (cxVal.body?.issues ?? []).filter((i) => i.level === "error");
ok(cxVal.status < 400 && cxErrors.length === 0, `complex validate: 0 errors (${cxErrors.length})`);

// 14. condition YES branch → parallelSplit → 2 parallel approval tasks
const cxYes = await j(`/api/xoffice/workflows/${CX}/requests`, { method: "POST", body: JSON.stringify({ title: "CX parallel", variables: { request: { title: "Big buy", amount: 500000, purpose: "cx" } } }) });
const cxTasks = cxYes.body?.tasks ?? (cxYes.body?.task ? [cxYes.body.task] : []);
ok(cxYes.status < 400 && cxTasks.length >= 2, `parallelSplit → ${cxTasks.length} parallel tasks (≥2)`);
ok(cxYes.body?.instance?.status === "running", "instance running after split");

// each parallel branch is assigned to a distinct real user → act as the assignee
const actAs = (task, note) =>
  ju(`/api/xoffice/tasks/${task?.id}/act`, task?.assigneeUserId ?? "user-nam", { method: "POST", body: JSON.stringify({ action: "approve", note }) });

// 15. parallelJoin waits: approve FIRST branch → still running, not completed
const jA = await actAs(cxTasks[0], "branch A");
ok(jA.body?.instance?.status === "running", "join parks: instance still running after 1st branch");

// 16. approve SECOND branch → join fires → subflow → completed
const jB = await actAs(cxTasks[1], "branch B");
ok(jB.body?.instance?.status === "completed", "join fires + subflow → instance completed");

// 17. subflow created a child instance (PILOT-02) referenced in audit
const insts = await j("/api/xoffice/instances");
const child = Array.isArray(insts.body) ? insts.body.find((i) => i.workflowCode === "PILOT-02" && /^SUB-/.test(i.instanceCode)) : null;
ok(!!child, `subflow spawned child instance (${child?.instanceCode})`);
ok(!!child && child.status === "completed", "child subflow instance completed");
const cxAudit = await j("/api/xoffice/audit");
ok(Array.isArray(cxAudit.body) && cxAudit.body.some((a) => /subflow/i.test(a.action)), "audit records subflow.completed");

// 18. condition NO branch → single simple approval → completed (no parallel)
const cxNo = await j(`/api/xoffice/workflows/${CX}/requests`, { method: "POST", body: JSON.stringify({ title: "CX simple", variables: { request: { title: "Small buy", amount: 100, purpose: "cx" } } }) });
const cxNoTasks = cxNo.body?.tasks ?? (cxNo.body?.task ? [cxNo.body.task] : []);
ok(cxNoTasks.length === 1, `condition NO branch → single task (${cxNoTasks.length})`);
const noAct = await j(`/api/xoffice/tasks/${cxNoTasks[0]?.id}/act`, { method: "POST", body: JSON.stringify({ action: "approve" }) });
ok(noAct.body?.instance?.status === "completed", "NO branch completes after single approval");

// ---- EXTERNAL ACTION (MANUAL_TASK) — no fake ERP document (P0) ---------
console.log("\n-- external action: PILOT-01 serviceCall → ExternalExecution MANUAL_TASK --");

// 19. drive PILOT-01 through ALL approvals; the finerp serviceCall must PARK
//     (MANUAL_TASK) instead of fabricating a Material Request.
const exReq = await j(`/api/xoffice/workflows/${CODE}/requests`, { method: "POST", body: JSON.stringify({ title: "E2E external", variables: { request: { title: "Mua server thật", amount: 250000000, business_justification: "E2E ext", department: "IT" }, requesterEmail: "nam@xtech.local" } }) });
const exCode = exReq.body?.instance?.instanceCode;
ok(!!exCode, `external request created (${exCode})`);
let cur = exReq.body?.task;
let guard = 0;
let lastAct = null;
while (cur && guard++ < 12) {
  const r = await ju(`/api/xoffice/tasks/${cur.id}/act`, cur.assigneeUserId ?? "user-nam", { method: "POST", body: JSON.stringify({ action: "approve", note: "drive to external" }) });
  lastAct = r;
  cur = r.body?.nextTask ?? null;
}
// after the final approval the instance parks on the serviceCall (running, no next task)
ok(lastAct?.body?.instance?.status === "running", `instance PARKED (running) at serviceCall, not auto-completed (${lastAct?.body?.instance?.status})`);

// 20. connector command for this instance is manual_pending — NO fabricated MR / FinERP
const exCmds = await j(`/api/xoffice/instances/${exCode}/commands`);
const manualCmd = Array.isArray(exCmds.body) ? exCmds.body.find((c) => c.actionCode === "create_material_request") : null;
ok(!!manualCmd && manualCmd.status === "manual_pending", `connector command status manual_pending (${manualCmd?.status})`);
const fabricated = Array.isArray(exCmds.body) && exCmds.body.some((c) => {
  const r = JSON.stringify(c.result ?? {});
  return /"materialRequestId"\s*:\s*"MR-/.test(r) || /"system"\s*:\s*"FinERP"/.test(r);
});
ok(!fabricated, "NO fabricated ERP document (no materialRequestId / system:FinERP)");

// 21. GET external-executions → MANUAL_TASK pending for this instance
const exList = await j(`/api/xoffice/external-executions?instanceCode=${exCode}`);
const pendingEE = Array.isArray(exList.body) ? exList.body.find((e) => e.status === "pending") : null;
ok(!!pendingEE && pendingEE.mode === "MANUAL_TASK", `ExternalExecution pending + mode MANUAL_TASK (${pendingEE?.mode}/${pendingEE?.status})`);
ok(!!pendingEE && !JSON.stringify(pendingEE).includes("MR-") && !JSON.stringify(pendingEE).includes("FinERP"), "pending ExternalExecution carries NO fake reference");

// 22. enter the REAL reference code → completed + instance completed
const realRef = "MR-2026-000123";
const refRes = await j(`/api/xoffice/external-executions/${pendingEE.id}/reference`, { method: "POST", body: JSON.stringify({ referenceCode: realRef, referenceSystem: "FINERP", note: "đã tạo trong FinERP" }) });
ok(refRes.body?.externalExecution?.status === "completed", `reference entered → ExternalExecution completed (${refRes.body?.externalExecution?.status})`);
ok(refRes.body?.externalExecution?.sourceRef?.sourceId === realRef, "sourceRef built from REAL entered code (not fabricated)");
ok(refRes.body?.instance?.status === "completed", `instance advances to completed after external step (${refRes.body?.instance?.status})`);

// 23. audit records the external execution lifecycle
const exAudit = await j("/api/xoffice/audit");
ok(Array.isArray(exAudit.body) && exAudit.body.some((a) => /external_execution/i.test(a.action)), "audit contains external_execution entry");

console.log(failed === 0 ? "\nE2E SMOKE PASSED" : `\nE2E SMOKE FAILED (${failed})`);
process.exit(failed === 0 ? 0 : 1);
