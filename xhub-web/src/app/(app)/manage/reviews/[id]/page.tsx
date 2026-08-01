import Link from "next/link";
import { notFound } from "next/navigation";
import { getReview } from "@/xoffice/lib/manage-data";
import { ReviewLoop } from "@/xoffice/manage/ReviewLoop";

export const metadata = { title: "Chi tiết rà soát · XHub" };
export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) notFound();
  return (
    <div className="space-y-4">
      <div>
        <Link href="/manage/reviews" className="text-xs text-primary-600 hover:underline">← Rà soát</Link>
        <h1 className="mt-1 font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{review.title ?? review.type}</h1>
      </div>
      <ReviewLoop review={review} />
    </div>
  );
}
