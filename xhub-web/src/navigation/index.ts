import { NavigationTree } from "@/@types/navigation";

// Bottom "settings" entry for the icon rail (kept minimal — no settings screens yet).
export const settings: NavigationTree = {
  id: "settings",
  type: "item",
  path: "/home/executive",
  title: "Thiết lập",
  icon: "settings",
};

// Icon rail (root segments) → each opens a prime panel of its `childs`.
export const navigation: NavigationTree[] = [
  {
    id: "home",
    type: "root",
    path: "/home",
    title: "Trang chủ",
    icon: "home",
    childs: [
      {
        id: "home.executive",
        type: "item",
        path: "/home/executive",
        title: "Tổng quan điều hành",
      },
      {
        id: "home.sales",
        type: "item",
        path: "/home/sales",
        title: "Bảng điều hành kinh doanh",
      },
      {
        id: "home.me",
        type: "item",
        path: "/home/me",
        title: "Không gian của tôi",
      },
    ],
  },
  {
    id: "inbox",
    type: "root",
    path: "/inbox",
    title: "Hộp việc & phê duyệt",
    icon: "inbox",
    childs: [
      {
        id: "inbox.unified",
        type: "item",
        path: "/inbox",
        title: "Hộp việc hợp nhất",
      },
      {
        id: "inbox.approvals",
        type: "item",
        path: "/approvals",
        title: "Trung tâm phê duyệt",
      },
    ],
  },
  {
    id: "work",
    type: "root",
    path: "/work",
    title: "Công việc & dự án",
    icon: "work",
    childs: [
      {
        id: "work.tasks",
        type: "item",
        path: "/work",
        title: "Công việc & chỉ đạo",
      },
      {
        id: "work.projects",
        type: "item",
        path: "/projects/project-finerp-minhphat",
        title: "Tổng quan dự án",
      },
    ],
  },
  {
    id: "space",
    type: "root",
    path: "/space",
    title: "X.Space — Trao đổi",
    icon: "space",
    childs: [
      {
        id: "space.home",
        type: "item",
        path: "/space/home",
        title: "Trang chủ X.Space",
      },
      {
        id: "space.channel",
        type: "collapse",
        path: "/space/channels/trien-khai-finerp-minh-phat",
        title: "Channel triển khai FinERP",
        childs: [
          {
            id: "space.channel.conversation",
            type: "item",
            path: "/space/channels/trien-khai-finerp-minh-phat",
            title: "Hội thoại",
          },
          {
            id: "space.channel.overview",
            type: "item",
            path: "/space/channels/trien-khai-finerp-minh-phat/overview",
            title: "Tổng quan dự án",
          },
        ],
      },
      {
        id: "space.customer",
        type: "item",
        path: "/space/channels/kh-minh-phat/customer",
        title: "Channel khách hàng (360)",
      },
      {
        id: "space.dm",
        type: "item",
        path: "/space/dm/user-thuha",
        title: "Tin nhắn trực tiếp",
      },
    ],
  },
  {
    id: "apps",
    type: "root",
    path: "/apps",
    title: "Ứng dụng",
    icon: "apps",
    childs: [
      {
        id: "apps.catalog",
        type: "item",
        path: "/apps",
        title: "Danh mục ứng dụng",
      },
    ],
  },
  {
    id: "ai",
    type: "root",
    path: "/ai",
    title: "X.AI",
    icon: "ai",
    childs: [
      {
        id: "ai.assistant",
        type: "item",
        path: "/home/executive",
        title: "Trợ lý X.AI (sắp có)",
      },
    ],
  },
];
