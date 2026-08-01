"use client";
import dynamic from "next/dynamic";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function BarChart({
  categories,
  values,
  seriesName = "Giá trị",
  unitLabel = "tỷ",
  horizontal = false,
  height = 320,
}: {
  categories: string[];
  values: number[];
  seriesName?: string;
  unitLabel?: string;
  horizontal?: boolean;
  height?: number;
}) {
  const options: ApexCharts.ApexOptions = {
    chart: { type: "bar", height, toolbar: { show: false }, fontFamily: "inherit" },
    plotOptions: { bar: { horizontal, borderRadius: 6, columnWidth: "55%", distributed: horizontal } },
    dataLabels: { enabled: false },
    colors: ["#1769e0", "#16b8d4", "#22a06b", "#f59e0b", "#7c5cfc", "#ef4444"],
    legend: { show: false },
    xaxis: { categories },
    yaxis: { labels: { formatter: (v: number) => `${v} ${unitLabel}` } },
    tooltip: { y: { formatter: (v: number) => `${v} ${unitLabel}` } },
    grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
  };
  return <ReactApexChart options={options} series={[{ name: seriesName, data: values }]} type="bar" height={height} />;
}
