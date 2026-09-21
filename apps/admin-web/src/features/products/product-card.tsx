"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoinIcon, PencilIcon, ShopIcon } from "@/components/ui/icons";
import { EditProductModal } from "./edit-product-modal";
import { ProductDetailModal } from "./product-detail-modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function firstImagePosition(product: Product): 1 | 2 | 3 | null {
  if (product.hasImage1) return 1;
  if (product.hasImage2) return 2;
  if (product.hasImage3) return 3;
  return null;
}

export function ProductCard({
  slug,
  branchId,
  product,
  canWrite,
}: {
  slug: string;
  branchId: string;
  product: Product;
  canWrite: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const imagePosition = firstImagePosition(product);

  return (
    <Card interactive className="cursor-pointer overflow-hidden" onClick={() => setDetailOpen(true)}>
      <div className="flex aspect-square items-center justify-center bg-[var(--color-surface-sunken)]">
        {imagePosition ? (
          // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan
          <img
            src={`${API_URL}/app/products/${product.id}/images/${imagePosition}?v=${encodeURIComponent(product.imagesUpdatedAt ?? "")}`}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <ShopIcon className="h-9 w-9 text-[var(--color-text-muted)]" />
        )}
      </div>
      <div className="space-y-2 p-3.5">
        <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{product.name}</p>
        {product.color && <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">{product.color}</p>}
        <Badge tone={product.quantity > 0 ? "success" : "danger"}>
          {product.quantity > 0 ? `${product.quantity} ta` : "Tugagan"}
        </Badge>
        <div className="flex items-center gap-1.5 pt-1">
          <div className="flex flex-1 items-center justify-center gap-1 rounded-full bg-[var(--color-warning-bg)] px-3 py-2 text-[14px] font-semibold text-[var(--color-warning)]">
            <CoinIcon className="h-4 w-4" />
            {product.priceCoins}
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              aria-label="Tovarni tahrirlash"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {detailOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProductDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} product={product} />
        </div>
      )}

      {editOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <EditProductModal open={editOpen} onClose={() => setEditOpen(false)} slug={slug} branchId={branchId} product={product} />
        </div>
      )}
    </Card>
  );
}
