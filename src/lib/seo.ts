/**
 * Central SEO metadata helpers.
 *
 * `pageMeta()` guarantees that every route produces a complete, accurate
 * social preview even when it only supplies a title. Anything not given
 * explicitly falls back in this order:
 *
 *   og:title        <- title (site suffix stripped) -> SITE.title
 *   og:description  <- description                  -> SITE.description
 *   og:image        <- image                        -> SITE.image
 *   twitter:*       <- the resolved og:* values
 *   og:url          <- absoluteUrl(path)
 *   canonical       <- absoluteUrl(path)
 */

import { BASE_URL } from "./public-routes";

export const SITE = {
  /** Single source of truth: src/config/robots-rules.json -> baseUrl */
  url: BASE_URL,
  name: "FrontDesk AI",
  title: "FrontDesk AI — The receptionist who never misses a call",
  description:
    "FrontDesk AI answers your phone and Instagram & Facebook DMs, then books appointments into your calendar. Built for local businesses.",
  socialTitle: "FrontDesk AI — AI receptionist for local businesses",
  socialDescription:
    "Answer every call and DM. Book every appointment. Lose nothing while you work.",
  image: `${BASE_URL}/og/default.jpg`,
  imageWidth: "1200",
  imageHeight: "630",
} as const;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** "Sign in — FrontDesk AI" -> "Sign in to FrontDesk AI" reads badly, so we just
 * drop the suffix and let the site name come from og:site_name. */
function stripSiteSuffix(title: string): string {
  return title.replace(/\s*[—|-]\s*FrontDesk AI\s*$/i, "").trim() || title;
}

export type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

export interface PageMetaInput {
  /** Full <title>. Defaults to the site title. */
  title?: string;
  /** Meta description. Defaults to the site description. */
  description?: string;
  /** Path or absolute URL for og:url / canonical. */
  path?: string;
  /** Overrides for the social card only. */
  ogTitle?: string;
  ogDescription?: string;
  /** Absolute or root-relative image URL. Defaults to the branded site card. */
  image?: string;
  imageWidth?: string;
  imageHeight?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
}

export function pageMeta(input: PageMetaInput = {}): MetaTag[] {
  const title = input.title ?? SITE.title;
  const description = input.description ?? SITE.description;

  const ogTitle =
    input.ogTitle ??
    (input.title ? stripSiteSuffix(title) : SITE.socialTitle);
  const ogDescription =
    input.ogDescription ??
    (input.description ? description : SITE.socialDescription);

  const image = absoluteUrl(input.image ?? SITE.image);
  const isDefaultImage = image === SITE.image;

  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },

    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDescription },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:site_name", content: SITE.name },
    { property: "og:image", content: image },
    {
      property: "og:image:width",
      content: input.imageWidth ?? (isDefaultImage ? SITE.imageWidth : "1200"),
    },
    {
      property: "og:image:height",
      content: input.imageHeight ?? (isDefaultImage ? SITE.imageHeight : "630"),
    },
    { property: "og:image:alt", content: ogTitle },

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: ogTitle },
    { name: "twitter:description", content: ogDescription },
    { name: "twitter:image", content: image },
  ];

  if (input.path) {
    meta.splice(6, 0, { property: "og:url", content: absoluteUrl(input.path) });
  }
  if (input.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  return meta;
}

/** Self-referencing canonical link for a leaf route. */
export function canonicalLink(path: string) {
  return { rel: "canonical", href: absoluteUrl(path) };
}
