import {
  NOTIF_API_SERVER,
  fetchNotifications,
} from "@/xhub/lib/notifications";
import { NotificationsClient } from "./NotificationsClient";

export const metadata = { title: "Thông báo · XHub" };
export const dynamic = "force-dynamic"; // reads the live X.Office feed

export default async function NotificationsPage() {
  // Fallback to empty on any failure — never crash the route.
  const items = await fetchNotifications(NOTIF_API_SERVER);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">
          Thông báo
        </h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">
          Trung tâm thông báo hợp nhất từ X.Office
          {items.length === 0 ? " · (chưa có thông báo hoặc chưa kết nối API)" : ""}
        </p>
      </div>
      <NotificationsClient initialItems={items} />
    </div>
  );
}
