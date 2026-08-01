"use client";

import { useState, type ReactNode } from "react";
import { SectionCard } from "@/xhub/ui/Card";
import { TwinViewer } from "./TwinViewer.client";
import { ZoneDrilldownPanel } from "./ZoneDrilldownPanel.client";
import type { RuntimeScene, ZoneMetric, InsightZone, FlowEdge } from "@/xoffice/lib/ioc-data";

/**
 * Owns the ONE piece of client state a zone drill-down needs: which zone is
 * selected. Lives above both the twin (left column) and the AI Brief / panel
 * (right column) so a click in either 2D or 3D can swap the right column's
 * content — TwinViewer itself has no opinion about what replaces AI Brief.
 */
export function OfficeTwinWorkspace({
  dashboardCode,
  scene,
  zones,
  insightZones,
  flows,
  plan2d,
  aiBriefPanel,
}: {
  dashboardCode: string;
  scene: RuntimeScene | null;
  zones: ZoneMetric[];
  insightZones?: InsightZone[];
  flows?: FlowEdge[];
  plan2d: ReactNode;
  aiBriefPanel: ReactNode;
}) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const selectedLabel = selectedZoneId ? insightZones?.find((z) => z.zoneId === selectedZoneId)?.label : undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <SectionCard title="Bản sao số văn phòng" accent="primary" bodyClassName="space-y-3">
        {scene ? (
          <TwinViewer
            scene={scene}
            zones={zones}
            insightZones={insightZones}
            flows={flows}
            plan2d={plan2d}
            selectedZoneId={selectedZoneId}
            onZoneClick={(id) => setSelectedZoneId((cur) => (cur === id ? null : id))}
          />
        ) : (
          <p className="text-sm text-gray-400">Scene chưa được xuất bản — hãy xuất bản trong Twin Studio.</p>
        )}
      </SectionCard>

      <SectionCard title={selectedZoneId ? `Chi tiết vùng${selectedLabel ? `: ${selectedLabel}` : ""}` : "AI Twin Brief"} accent="primary" bodyClassName="space-y-3">
        {selectedZoneId ? <ZoneDrilldownPanel dashboardCode={dashboardCode} zoneId={selectedZoneId} onClose={() => setSelectedZoneId(null)} /> : aiBriefPanel}
      </SectionCard>
    </div>
  );
}
