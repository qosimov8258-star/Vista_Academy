"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild, ParentPurchaseResult, ParentShop, Product } from "@/lib/types";
import { CoinIcon, ShopIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";

function firstImagePosition(product: Product): 1 | 2 | 3 | null {
  if (product.hasImage1) return 1;
  if (product.hasImage2) return 2;
  if (product.hasImage3) return 3;
  return null;
}

function productImageUrl(product: Product): string | null {
  const position = firstImagePosition(product);
  if (!position) return null;
  return `${PARENT_API_URL}/app/parent/products/${product.id}/images/${position}?v=${encodeURIComponent(product.imagesUpdatedAt ?? "")}`;
}

/**
 * Coin do'koni. Bolangiz yig'gan coinlarga tovar sotib olinadi — zaxira va
 * balans yetarli bo'lsagina xarid o'tadi, aks holda sabab shu yerda aytiladi.
 */
export default function ParentShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });

  useEffect(() => {
    if (meQuery.isError && meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/ota-ona/${slug}/kirish`);
    }
  }, [meQuery.isError, meQuery.error, router, slug]);

  const children = meQuery.data?.children ?? [];
  const childId = activeChildId ?? children[0]?.id ?? null;

  const shopQuery = useQuery({
    queryKey: ["parent-shop", childId],
    queryFn: () => parentApi.get<ParentShop>(`/app/parent/children/${childId}/products`),
    enabled: !!childId,
  });

  // Bola almashtirilsa — ochiq tovar oynasi eskirgan bo'lishi mumkin
  useEffect(() => {
    setSelected(null);
  }, [childId]);

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--p-ink)]">Do&apos;kon</h1>
        {shopQuery.data && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--p-sun)]/16 px-3.5 py-2 text-[15px] font-bold text-[var(--p-sun-ink)]">
            <CoinIcon className="h-4 w-4" />
            {shopQuery.data.balance}
          </div>
        )}
      </header>

      {children.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChildId(c.id)}
              className={clsx(
                "shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors",
                c.id === childId ? "bg-[var(--p-coral)] text-white" : "bg-[var(--p-panel)] text-[var(--p-muted)]",
              )}
            >
              {c.fullName.split(" ").slice(-1)[0]}
            </button>
          ))}
        </div>
      )}

      {shopQuery.isLoading ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-[var(--p-radius)] bg-[var(--p-card)]/60" />
          ))}
        </div>
      ) : shopQuery.data && shopQuery.data.products.length === 0 ? (
        <p className="mt-10 text-center text-[15px] text-[var(--p-muted)]">
          Hozircha do&apos;konda tovar yo&apos;q — tarbiyachi tez orada qo&apos;shadi.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {shopQuery.data?.products.map((product) => (
            <ProductTile key={product.id} product={product} onOpen={() => setSelected(product)} />
          ))}
        </div>
      )}

      {selected && childId && (
        <ProductSheet
          product={selected}
          childId={childId}
          balance={shopQuery.data?.balance ?? 0}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ProductTile({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const imageUrl = productImageUrl(product);
  const inStock = product.quantity > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] text-left shadow-[var(--p-shadow)] transition-transform active:scale-[0.98]"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--p-sunken)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <ShopIcon className="h-9 w-9 text-[var(--p-muted)]" />
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate text-[14px] font-semibold text-[var(--p-ink)]">{product.name}</p>
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1 text-[13px] font-bold text-[var(--p-sun-ink)]">
            <CoinIcon className="h-3.5 w-3.5" />
            {product.priceCoins}
          </span>
          {!inStock && (
            <span className="rounded-full bg-[var(--p-coral)]/14 px-2 py-0.5 text-[11px] font-bold text-[var(--p-coral)]">
              Tugagan
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ProductSheet({
  product,
  childId,
  balance,
  onClose,
}: {
  product: Product;
  childId: string;
  balance: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ParentPurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const current = result?.product ?? product;
  const currentBalance = result?.balance ?? balance;
  const imageUrl = productImageUrl(current);
  const inStock = current.quantity > 0;
  const canAfford = currentBalance >= current.priceCoins;

  const purchase = useMutation({
    mutationFn: () => parentApi.post<ParentPurchaseResult>(`/app/parent/children/${childId}/products/${product.id}/purchase`),
    onSuccess: (data) => {
      setError(null);
      setResult(data);
      queryClient.setQueryData<ParentShop | undefined>(["parent-shop", childId], (prev) =>
        prev
          ? { balance: data.balance, products: prev.products.map((p) => (p.id === data.product.id ? data.product : p)) }
          : prev,
      );
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const buttonLabel = purchase.isPending
    ? "Yuborilmoqda…"
    : result
      ? "Sotib olindi!"
      : !inStock
        ? "Tovar tugagan"
        : !canAfford
          ? "Coin yetarli emas"
          : "Sotib olish";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={current.name}>
      <button type="button" aria-label="Yopish" onClick={onClose} className={`${styles.fadeIn} absolute inset-0 cursor-default bg-black/45`} />
      <div
        className={`${styles.sheetIn} relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[30px] bg-[var(--p-card)] px-5 pt-3 shadow-[var(--p-shadow)]`}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-full bg-[var(--p-muted)]/30" />

        <div className="mt-3 flex aspect-square items-center justify-center overflow-hidden rounded-[22px] bg-[var(--p-sunken)]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil, Next optimizatsiyasi sozlanmagan
            <img src={imageUrl} alt={current.name} className="h-full w-full object-cover" />
          ) : (
            <ShopIcon className="h-14 w-14 text-[var(--p-muted)]" />
          )}
        </div>

        <h2 className="mt-4 text-[19px] font-bold text-[var(--p-ink)]">{current.name}</h2>
        {current.color && <p className="mt-0.5 text-[13.5px] text-[var(--p-muted)]">{current.color}</p>}
        {current.description && (
          <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--p-ink)]">{current.description}</p>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-[16px] font-bold text-[var(--p-ink)]">
          Qiymati: {current.priceCoins}
          <CoinIcon className="h-4 w-4 text-[var(--p-sun-ink)]" />
        </div>

        {error && (
          <div className="mt-3 rounded-[16px] bg-[var(--p-coral)]/12 px-4 py-2.5 text-[14px] font-medium text-[var(--p-coral)]">
            {error}
          </div>
        )}

        <div
          className={clsx(
            "mt-3 rounded-[16px] px-4 py-2.5 text-center text-[14px] font-bold",
            inStock ? "bg-[var(--p-mint)]/14 text-[var(--p-mint)]" : "bg-[var(--p-coral)]/14 text-[var(--p-coral)]",
          )}
        >
          {inStock ? "Yetarli" : "Tovar tugagan"}
        </div>

        <button
          type="button"
          onClick={() => purchase.mutate()}
          disabled={!inStock || !canAfford || purchase.isPending || !!result}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--p-coral)] py-4 text-[16px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(255,122,102,0.9)] transition-transform active:scale-[0.98] disabled:cursor-default disabled:opacity-50"
        >
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-1.5 w-full cursor-pointer rounded-full py-3 text-[15px] font-bold text-[var(--p-muted)] transition-colors active:bg-[var(--p-sunken)]"
        >
          Yopish
        </button>
      </div>
    </div>
  );
}
