/**
 * Shared JSON-LD nodes for public (crawlable) pages.
 *
 * Every public route embeds the same Organization + LocalBusiness + WebSite
 * graph so search engines can consolidate brand signals and surface the
 * business in local results.
 */

export const SITE_URL = "https://chat-schedule-charm.lovable.app";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const LOCAL_BUSINESS_ID = `${SITE_URL}/#localbusiness`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

const DESCRIPTION =
  "FrontDesk AI is an AI receptionist for local businesses. It answers phone calls, Instagram and Facebook DMs, qualifies customers, and books appointments straight into your calendar.";

export const organizationNode = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "FrontDesk AI",
  alternateName: "FrontDesk",
  url: `${SITE_URL}/`,
  description: DESCRIPTION,
  slogan: "The receptionist who never misses a call",
  areaServed: [
    { "@type": "Country", name: "United States" },
    { "@type": "Country", name: "Canada" },
    { "@type": "Country", name: "United Kingdom" },
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      url: `${SITE_URL}/signup`,
      availableLanguage: ["English", "Spanish"],
    },
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${SITE_URL}/`,
      availableLanguage: ["English", "Spanish"],
    },
  ],
};

export const localBusinessNode = {
  "@type": "LocalBusiness",
  "@id": LOCAL_BUSINESS_ID,
  name: "FrontDesk AI",
  url: `${SITE_URL}/`,
  description: DESCRIPTION,
  parentOrganization: { "@id": ORGANIZATION_ID },
  priceRange: "$49-$199",
  currenciesAccepted: "USD",
  paymentAccepted: "Credit Card",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
  ],
  areaServed: [
    { "@type": "Country", name: "United States" },
    { "@type": "Country", name: "Canada" },
    { "@type": "Country", name: "United Kingdom" },
  ],
  makesOffer: [
    {
      "@type": "Offer",
      name: "The Soloist",
      price: "49.00",
      priceCurrency: "USD",
      url: `${SITE_URL}/signup`,
    },
    {
      "@type": "Offer",
      name: "Professional Shop",
      price: "99.00",
      priceCurrency: "USD",
      url: `${SITE_URL}/signup`,
    },
    {
      "@type": "Offer",
      name: "Multi-Location",
      price: "199.00",
      priceCurrency: "USD",
      url: `${SITE_URL}/signup`,
    },
  ],
};

export const webSiteNode = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: "FrontDesk AI",
  url: `${SITE_URL}/`,
  publisher: { "@id": ORGANIZATION_ID },
};

/** Organization + LocalBusiness + WebSite graph shared by all public routes. */
export const brandGraph = [organizationNode, localBusinessNode, webSiteNode];

/** Build a head() script entry containing the brand graph plus page-specific nodes. */
export function brandJsonLd(...extraNodes: Record<string, unknown>[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [...brandGraph, ...extraNodes],
    }),
  };
}
