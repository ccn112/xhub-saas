"use client";
import dynamic from "next/dynamic";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export function AreaChart({ categories, values, unitLabel = "tỷ" }: { categories: string[]; values: number[]; unitLabel?: string }) {
  const options: ApexCharts.ApexOptions = {
    chart: { type: "area", height: 320, toolbar: { show: false }, fontFamily: "inherit" },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 3 },
    colors: ["#1769e0"],
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] } },
    xaxis: { categories },
    yaxis: { labels: { formatter: (v: number) => `${v} ${unitLabel}` } },
    tooltip: { y: { formatter: (v: number) => `${v} ${unitLabel}` } },
    grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
  };
  return <ReactApexChart options={options} series={[{ name: "Doanh thu", data: values }]} type="area" height={320} />;
}
