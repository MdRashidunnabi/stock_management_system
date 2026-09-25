export const SHOP_TEMPLATE_IDS = [
  "market",
  "noir",
  "linen",
  "harbor",
  "blossom",
  "harvest",
  "metro",
  "grove",
  "sunset",
  "slate",
] as const;

export type ShopTemplateId = (typeof SHOP_TEMPLATE_IDS)[number];

export type ShopTemplate = {
  id: ShopTemplateId;
  name: string;
  blurb: string;
  bestFor: string;
  nav: "side" | "top";
  hero: "gradient" | "solid" | "panel";
  header: "bar" | "plain" | "centered";
  density: "compact" | "regular" | "airy";
  preview: {
    bg: string;
    fg: string;
    accent: string;
    card: string;
  };
};

export const SHOP_TEMPLATES: ShopTemplate[] = [
  {
    id: "market",
    name: "Market",
    blurb: "Fresh grocery look — teal, round cards, categories on the left.",
    bestFor: "Greengrocers and convenience shops",
    nav: "side",
    hero: "gradient",
    header: "bar",
    density: "regular",
    preview: { bg: "#f4f8fb", fg: "#0f172a", accent: "#059669", card: "#ffffff" },
  },
  {
    id: "noir",
    name: "Noir",
    blurb: "Dark and gold. Square edges, quiet header, luxury grocery or deli.",
    bestFor: "Wine, deli, specialty",
    nav: "side",
    hero: "solid",
    header: "plain",
    density: "compact",
    preview: { bg: "#0b0b0d", fg: "#f5f0e6", accent: "#d4a017", card: "#16161a" },
  },
  {
    id: "linen",
    name: "Linen",
    blurb: "Warm cream and terracotta, airy layout, bakery-style type.",
    bestFor: "Bakeries and farm shops",
    nav: "side",
    hero: "panel",
    header: "centered",
    density: "airy",
    preview: { bg: "#f7f1e8", fg: "#3f2e22", accent: "#c45c26", card: "#fffaf3" },
  },
  {
    id: "harbor",
    name: "Harbor",
    blurb: "Navy and sky blue, clean stripes, coastal fishmonger or grocer.",
    bestFor: "Seafood and coastal shops",
    nav: "side",
    hero: "gradient",
    header: "bar",
    density: "regular",
    preview: { bg: "#f0f7fb", fg: "#0c2744", accent: "#0369a1", card: "#ffffff" },
  },
  {
    id: "blossom",
    name: "Blossom",
    blurb: "Soft blush boutique. Top category chips, compact product tiles.",
    bestFor: "Florists, gifts, cosmetics",
    nav: "top",
    hero: "panel",
    header: "centered",
    density: "compact",
    preview: { bg: "#fdf4f7", fg: "#4a2030", accent: "#db2777", card: "#ffffff" },
  },
  {
    id: "harvest",
    name: "Harvest",
    blurb: "Amber and olive — rustic farm-stand energy.",
    bestFor: "Produce markets and bulk stores",
    nav: "side",
    hero: "solid",
    header: "bar",
    density: "regular",
    preview: { bg: "#fbf6ea", fg: "#3b2a14", accent: "#b45309", card: "#fff8e7" },
  },
  {
    id: "metro",
    name: "Metro",
    blurb: "High-contrast black and white. Top nav, tight grid, city shop.",
    bestFor: "Urban convenience and fashion grocery",
    nav: "top",
    hero: "solid",
    header: "plain",
    density: "compact",
    preview: { bg: "#f4f4f5", fg: "#09090b", accent: "#18181b", card: "#ffffff" },
  },
  {
    id: "grove",
    name: "Grove",
    blurb: "Deep forest green, large photos, calm organic store.",
    bestFor: "Health food and organic",
    nav: "side",
    hero: "gradient",
    header: "plain",
    density: "airy",
    preview: { bg: "#f3f6f1", fg: "#142117", accent: "#3f6212", card: "#ffffff" },
  },
  {
    id: "sunset",
    name: "Sunset",
    blurb: "Coral and orange, bold hero, friendly neighbourhood shop.",
    bestFor: "Takeaway, spice shops, cafés",
    nav: "top",
    hero: "gradient",
    header: "bar",
    density: "regular",
    preview: { bg: "#fff7ed", fg: "#431407", accent: "#ea580c", card: "#ffffff" },
  },
  {
    id: "slate",
    name: "Slate",
    blurb: "Cool grey and indigo. Structured, professional, quiet.",
    bestFor: "Pharmacies and hardware",
    nav: "side",
    hero: "panel",
    header: "plain",
    density: "regular",
    preview: { bg: "#f1f5f9", fg: "#0f172a", accent: "#4338ca", card: "#ffffff" },
  },
];

export const DEFAULT_SHOP_TEMPLATE: ShopTemplateId = "market";

export function parseShopTemplateId(value: unknown): ShopTemplateId {
  if (typeof value === "string" && (SHOP_TEMPLATE_IDS as readonly string[]).includes(value)) {
    return value as ShopTemplateId;
  }
  return DEFAULT_SHOP_TEMPLATE;
}

export function getShopTemplate(id: unknown): ShopTemplate {
  const parsed = parseShopTemplateId(id);
  return SHOP_TEMPLATES.find((t) => t.id === parsed) ?? SHOP_TEMPLATES[0]!;
}
