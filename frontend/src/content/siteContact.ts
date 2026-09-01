/** Public contact channels — phone only (no email on marketing pages). */
export const SITE_PHONE_DISPLAY = "0571-88776688";
export const SITE_PHONE_TEL = "057188776688";

export function phoneTelHref(phone?: string | null) {
  const raw = (phone || SITE_PHONE_DISPLAY).trim();
  const digits = raw.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : `tel:${SITE_PHONE_TEL}`;
}

export function phoneLabel(phone?: string | null) {
  const raw = (phone || "").trim();
  return raw || SITE_PHONE_DISPLAY;
}

export const MESSAGE_CATEGORIES = [
  { value: "research", label: "科研合作" },
  { value: "product", label: "检测产品" },
  { value: "interpret", label: "产品解读" },
  { value: "deploy", label: "私有化部署" },
  { value: "career", label: "加入我们" },
  { value: "other", label: "其他留言" },
] as const;

export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number]["value"];

export function categoryFromConsultName(name: string): MessageCategory {
  const map: Record<string, MessageCategory> = {
    科研合作: "research",
    检测产品: "product",
    产品解读: "interpret",
    私有化部署: "deploy",
    加入我们: "career",
  };
  return map[name] || "other";
}

/** Open bottom-right support panel for product interpretation booking. */
export function supportInterpretHref(pathname: string, product?: string) {
  const params = new URLSearchParams({ support: "interpret" });
  if (product) params.set("product", product);
  return `${pathname}?${params.toString()}`;
}

export const CONTACT_CONSULT_HREF = "/contact?intent=consult#consultation-form";
