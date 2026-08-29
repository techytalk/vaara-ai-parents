import type { Listing } from "@/lib/api";

export function listingPriceLabel(listing: Listing): string {
  if (listing.kind === "free") return "Free";
  if (listing.kind === "wanted") return "Wanted";
  if (listing.priceAmount != null) {
    return `₹${listing.priceAmount.toLocaleString("en-IN")}`;
  }
  return "Price on request";
}

export function listingKindLabel(kind: Listing["kind"]): string {
  if (kind === "free") return "Free";
  if (kind === "wanted") return "Wanted";
  return "For sale";
}
