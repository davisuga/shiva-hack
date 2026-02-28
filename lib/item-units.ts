export const ITEM_UNITS = [
  "UNIT",
  "MILLILITER",
  "LITER",
  "GRAM",
  "KILOGRAM",
] as const;

export type ItemUnit = (typeof ITEM_UNITS)[number];

export const DEFAULT_ITEM_UNIT: ItemUnit = "UNIT";

const UNIT_SHORT_LABELS: Record<ItemUnit, { pt: string; en: string }> = {
  UNIT: { pt: "un", en: "unit" },
  MILLILITER: { pt: "ml", en: "ml" },
  LITER: { pt: "L", en: "L" },
  GRAM: { pt: "g", en: "g" },
  KILOGRAM: { pt: "kg", en: "kg" },
};

export function isItemUnit(value: unknown): value is ItemUnit {
  return (
    typeof value === "string" &&
    ITEM_UNITS.includes(value as ItemUnit)
  );
}

export function normalizeItemUnit(value: unknown): ItemUnit {
  if (isItemUnit(value)) {
    return value;
  }
  return DEFAULT_ITEM_UNIT;
}

export function getItemUnitShortLabel(unit: ItemUnit, locale?: string) {
  const lang = locale?.toLowerCase().startsWith("pt") ? "pt" : "en";
  return UNIT_SHORT_LABELS[unit][lang];
}
