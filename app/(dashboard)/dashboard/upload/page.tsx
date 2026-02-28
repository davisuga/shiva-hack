import { ReceiptMagicUpload } from "@/components/receipt-magic-upload";
import { getNormalizedNameOptions } from "@/lib/actions/items";
import { getReceipts } from "@/lib/actions/receipts";
import { normalizeItemUnit } from "@/lib/item-units";
import { getTranslations } from "next-intl/server";

export default async function UploadPage() {
  const t = await getTranslations("UploadPage");
  const [normalizedNameResult, receiptsResult] = await Promise.all([
    getNormalizedNameOptions(),
    getReceipts({ limit: 15 }),
  ]);

  const manualEntries = receiptsResult.receipts.map((receipt) => ({
    id: receipt.id,
    date: receipt.date.toISOString(),
    totalAmount: receipt.totalAmount,
    currency: receipt.currency,
    items: receipt.items.map((item) => ({
      id: item.id,
      rawName: item.rawName,
      normalizedName: item.normalizedName,
      category: item.category,
      quantity: item.quantity,
      unit: normalizeItemUnit(item.unit),
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-[-0.6px] text-notia-text">{t("title")}</h1>
        <p className="mt-1 text-[13px] text-notia-text-secondary">{t("subtitle")}</p>
      </div>

      <ReceiptMagicUpload
        redirectToDashboard
        normalizedNameOptions={normalizedNameResult.normalizedNames}
        manualEntries={manualEntries}
      />
    </div>
  );
}
