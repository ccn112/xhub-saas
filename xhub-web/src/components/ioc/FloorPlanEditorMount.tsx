"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type FloorPlanEditor from "./FloorPlanEditor.client";

/**
 * Client-side mount shim for the Konva editor (ADR-0001).
 *
 * `dynamic(..., { ssr: false })` is only legal inside a Client Component, and it
 * is REQUIRED here: konva's node entry point pulls in the optional `canvas`
 * native package, which Turbopack cannot resolve during server rendering. This
 * boundary keeps the editor strictly browser-side while the page around it stays
 * a Server Component.
 */
const Editor = dynamic(() => import("./FloorPlanEditor.client"), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center text-sm text-gray-400">Đang tải trình vẽ…</div>,
});

export default function FloorPlanEditorMount(props: ComponentProps<typeof FloorPlanEditor>) {
  return <Editor {...props} />;
}
