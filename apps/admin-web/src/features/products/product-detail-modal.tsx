"use client";

import { useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ChevronRightIcon, CoinIcon, ShopIcon } from "@/components/ui/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function imagePositions(product: Product): (1 | 2 | 3)[] {
  const positions: (1 | 2 | 3)[] = [];
  if (product.hasImage1) positions.push(1);
  if (product.hasImage2) positions.push(2);
  if (product.hasImage3) positions.push(3);
  return positions;
}

/** Mahsulot suratlari — chapda miniatyuralar, o'ngda katta rasm; o'q tugmalari yoki surish (swipe) bilan almashtiriladi. */
function ProductImageGallery({ product, positions }: { product: Product; positions: (1 | 2 | 3)[] }) {
  const [index, setIndex] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const hasMultiple = positions.length > 1;

  const imageUrl = (pos: 1 | 2 | 3) =>
    `${API_URL}/app/products/${product.id}/images/${pos}?v=${encodeURIComponent(product.imagesUpdatedAt ?? "")}`;

  const goTo = (next: number) => setIndex((next + positions.length) % positions.length);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(delta > 0 ? index - 1 : index + 1);
  };

  return (
    <div className="flex gap-3">
      {hasMultiple && (
        <div className="flex shrink-0 flex-col gap-2">
          {positions.map((pos, i) => (
            <button
              key={pos}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}-rasm`}
              className={`h-14 w-14 cursor-pointer overflow-hidden rounded-[var(--radius-md)] border-2 transition-colors ${
                i === index
                  ? "border-[var(--color-primary)]"
                  : "border-transparent opacity-70 hover:border-[var(--color-border)] hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan */}
              <img src={imageUrl(pos)} alt={`${product.name} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div
        className="relative min-w-0 flex-1 touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={() => (dragStartX.current = null)}
      >
        <div className="aspect-square overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-sunken)] shadow-[var(--shadow-xs)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan */}
          <img
            key={positions[index]}
            src={imageUrl(positions[index])}
            alt={product.name}
            draggable={false}
            className="h-full w-full object-cover"
          />
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              className="absolute left-0 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-raised)] transition-transform hover:scale-105"
              aria-label="Oldingi rasm"
            >
              <ChevronRightIcon className="h-4 w-4 -scale-x-100" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className="absolute right-0 top-1/2 flex h-8 w-8 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-raised)] transition-transform hover:scale-105"
              aria-label="Keyingi rasm"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ProductDetailModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
}) {
  const positions = imagePositions(product);
  const inStock = product.quantity > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product.name}
      widthClassName={positions.length > 1 ? "max-w-md" : "max-w-sm"}
    >
      <div className="space-y-4">
        {positions.length > 0 ? (
          <ProductImageGallery product={product} positions={positions} />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-surface-sunken)]">
            <ShopIcon className="h-14 w-14 text-[var(--color-text-muted)]" />
          </div>
        )}

        <div>
          <h3 className="text-[17px] font-semibold text-[var(--color-text)]">{product.name}</h3>
          {product.color && <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{product.color}</p>}
        </div>

        {product.description && (
          <p className="text-[14px] leading-relaxed text-[var(--color-text-muted)]">{product.description}</p>
        )}

        <div className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--color-text)]">
          Qiymati: {product.priceCoins}
          <CoinIcon className="h-4 w-4 text-[var(--color-warning)]" />
        </div>

        <Badge tone={inStock ? "success" : "danger"} className="w-full justify-center py-2 text-[14px]">
          {inStock ? "Yetarli" : "Yetarli emas"}
        </Badge>
      </div>
    </Modal>
  );
}
