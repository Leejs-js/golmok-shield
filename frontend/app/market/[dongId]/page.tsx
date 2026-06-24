import { DISTRICTS } from "@/lib/districts";
import ReportClient from "./ReportClient";

export function generateStaticParams() {
  return Object.keys(DISTRICTS).map((dongId) => ({ dongId }));
}

export default function ReportPage() {
  return <ReportClient />;
}
