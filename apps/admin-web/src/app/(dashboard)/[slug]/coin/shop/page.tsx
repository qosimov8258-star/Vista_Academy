"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus, Store } from "lucide-react";
import { api } from "@/lib/api";
import type { Organization, Product } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteTeaching } from "@/lib/permissions";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosButton } from "@/components/ios/button";
import { Group, Row } from "@/components/ios/group";
import { Segmented } from "@/components/ios/form";
import { IosSheet } from "@/components/ios/sheet";
import { EmptyState, ErrorState } from "@/components/ios/states";
import { CheckIcon } from "@/components/ios/icons";
import { GROUP_BLOCK, ROW_SEPARATOR } from "@/components/ios/tokens";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { PricePill, ProductDetailSheet, ProductFormSheet, StockPill, productImagePositions, productImageUrl } from "@/features/products/product-sheets";
import { useTr } from "@/i18n/tr";

/** Ko'p bo'lmasa filial segment bilan, aks holda ro'yxat varag'ida tanlanadi */
const SEGMENT_MAX = 4;

/**
 * Yulduzcha — Do'kon: bolalar yulduzchalarini sarflaydigan tovarlar.
 * Telefonda 2 ustunli kartalar; karta bosilsa tovar varag'i (suratlar
 * surib ko'riladi), tahrirlash va o'chirish o'sha varaqdan.
 */
export default function CoinShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);

  // Ochiq varaq: tovar ko'rinishi yoki forma (yangi / tahrirlash)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"detail" | "form" | null>(null);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });
  const branches = orgQuery.data?.branches ?? [];

  useEffect(() => {
    if (forcedBranchId) {
      setBranchId(forcedBranchId);
      return;
    }
    if (!branchId && branches.length > 0) {
      setBranchId(branches[0].id);
    }
  }, [forcedBranchId, branchId, branches]);

  const productsQuery = useQuery({
    queryKey: ["products", slug, branchId],
    queryFn: () => api.get<Product[]>(`/app/products?branchId=${branchId}`),
    enabled: !!branchId,
  });
  const products = productsQuery.data ?? [];
  const selected = selectedId ? (products.find((p) => p.id === selectedId) ?? null) : null;
  const outOfStock = products.filter((p) => p.quantity <= 0).length;

  const openCreate = () => {
    setSelectedId(null);
    setView("form");
  };

  const showBranchPicker = !forcedBranchId && branches.length > 1;
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  return (
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        <PageHeaderCard
          icon={Store}
          tint="pink"
          title={tr("Yulduzcha — Do'kon")}
          count={productsQuery.data ? tr("{0} ta tovar", products.length) : undefined}
          subtitle={tr("Bolalar yulduzchalarini sarflaydigan do'kon")}
          actions={canWrite && branchId ? <IosButton label={tr("Tovar qo'shish")} icon={Plus} variant="primary" compact onClick={openCreate} /> : undefined}
        />

        {showBranchPicker &&
          (branches.length <= SEGMENT_MAX ? (
            <Segmented label={tr("Filial")} value={branchId} onChange={setBranchId} options={branches.map((b) => ({ value: b.id, label: tr(b.name) }))} />
          ) : (
            <Group>
              <Row title={tr("Filial")} value={tr(branchName)} onClick={() => setBranchPickerOpen(true)} />
            </Group>
          ))}

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        <Group
          title={
            <>
              {tr("Tovarlar")}
              {outOfStock > 0 && <span className="font-normal normal-case tracking-normal">· {tr("{0} tasi tugagan", outOfStock)}</span>}
            </>
          }
          refreshing={productsQuery.isFetching && !productsQuery.isLoading}
          bare
        >
          {!branchId && !orgQuery.isLoading ? (
            <EmptyState icon={Store} title="Filial mavjud emas" />
          ) : !branchId || productsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={GROUP_BLOCK}>
                  <div className="aspect-square animate-pulse bg-[#767680]/[0.12]" />
                  <div className="space-y-2 p-3">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#767680]/[0.12]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-[#767680]/[0.12]" />
                  </div>
                </div>
              ))}
            </div>
          ) : productsQuery.isError && !productsQuery.data ? (
            <ErrorState message={tr((productsQuery.error as Error).message)} onRetry={() => productsQuery.refetch()} retrying={productsQuery.isFetching} />
          ) : products.length === 0 ? (
            <div className="space-y-3">
              <EmptyState
                icon={Store}
                title="Hali tovar qo'shilmagan"
                hint={canWrite ? "\"Tovar qo'shish\" tugmasi orqali birinchi tovarni qo'shing" : "Bu filialda hali tovar yo'q"}
              />
              {canWrite && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mx-auto flex h-11 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-[15px] font-semibold text-white transition-transform active:scale-[0.96]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.6} />
                  {tr("Tovar qo'shish")}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const first = productImagePositions(product)[0];
                const soldOut = product.quantity <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(product.id);
                      setView("detail");
                    }}
                    className={clsx(GROUP_BLOCK, "flex flex-col text-left transition-transform active:scale-[0.98]")}
                  >
                    <div className="relative aspect-square w-full bg-[#f2f2f7]">
                      {first ? (
                        // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil
                        <img src={productImageUrl(product, first)} alt={tr(product.name)} className={clsx("h-full w-full object-cover", soldOut && "opacity-50")} />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <Store className="h-10 w-10 text-[#c7c7cc]" strokeWidth={1.6} />
                        </span>
                      )}
                      <span className="absolute left-2 top-2">
                        <StockPill quantity={product.quantity} />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                      <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--color-text)]">{tr(product.name)}</span>
                      {product.color && <span className="truncate text-[13px] text-[#8e8e93]">{tr(product.color)}</span>}
                      <span className="mt-auto pt-1">
                        <PricePill value={product.priceCoins} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Group>
      </div>

      {/* Filial tanlash (ko'p filial bo'lsa) */}
      <IosSheet open={branchPickerOpen} onClose={() => setBranchPickerOpen(false)} cancelLabel="Orqaga" title={tr("Filial")}>
        <div className={GROUP_BLOCK}>
          {branches.map((b) => (
            <div key={b.id} className="group/row relative">
              <button
                type="button"
                role="radio"
                aria-checked={b.id === branchId}
                onClick={() => {
                  setBranchId(b.id);
                  setBranchPickerOpen(false);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
              >
                <span className="min-w-0 flex-1 truncate py-3 text-[15px] text-[var(--color-text)]">{tr(b.name)}</span>
                {b.id === branchId && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
              </button>
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
          ))}
        </div>
      </IosSheet>

      {selected && (
        <ProductDetailSheet open={view === "detail"} onClose={() => setView(null)} product={selected} onEdit={canWrite ? () => setView("form") : undefined} />
      )}
      {canWrite && branchId && (
        <ProductFormSheet
          open={view === "form"}
          // Tahrirlashdan qaytganda tovar varag'i ochiladi, yangi tovardan keyin — ro'yxat
          onClose={() => setView(selected ? "detail" : null)}
          onDeleted={() => {
            setView(null);
            setSelectedId(null);
          }}
          slug={slug}
          branchId={branchId}
          product={selected}
        />
      )}
    </div>
  );
}
