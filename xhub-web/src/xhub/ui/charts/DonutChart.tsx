"use client";
import dynamic from "next/dynamic";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const PALETTE = ["#1769e0", "#16b8d4", "#22a06b", "#f59e0b", "#7c5cfc", "#ef4444"];

export function DonutChart({ labels, values, unit = "tỷ", height = 300 }: { labels: string[]; values: number[]; unit?: string; height?: number }) {
  const options: ApexCharts.ApexOptions = {
    chart: { type: "donut", height, fontFamily: "inherit" },
    labels,
    colors: PALETTE,
    legend: { position: "bottom" },
    dataLabels: { enabled: true, formatter: (val: number) => `${Math.round(val as number)}%` },
    tooltip: { y: { formatter: (v: number) => `${v} ${unit}` } },
    stroke: { width: 2 },
  };
  return <ReactApexChart options={options} series={values} type="donut" height={height} />;
}
