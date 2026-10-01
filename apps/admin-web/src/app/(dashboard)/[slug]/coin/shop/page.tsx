"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Organization, Product } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteTeaching } from "@/lib/permissions";
import { ShopIcon, PlusIcon } from "@/components/ui/icons";
import { CreateProductModal } from "@/features/products/create-product-modal";
import { ProductCard } from "@/features/products/product-card";
import { useTr } from "@/i18n/tr";

export default function CoinShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);
  const [createOpen, setCreateOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 md:flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Yulduzcha — Do'kon")}</h1>
          <p className="text-[14px] text-[var(--color-text-muted)]">{tr("Bolalar yulduzchalarini sarflaydigan do'kon")}</p>
        </div>
        {canWrite && branchId && (
          <Button className="shrink-0 max-md:!h-auto max-md:!py-2" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4 shrink-0" />
            <span className="max-md:text-center max-md:leading-tight max-md:whitespace-normal">
              {tr("Tovar")}<br className="md:hidden" /> {tr("qo'shish")}
            </span>
          </Button>
        )}
      </div>

      {!forcedBranchId && branches.length > 1 && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row">
          <Select label={tr("Filial")} value={branchId} onChange={(e) => setBranchId(e.target.value)} className="sm:max-w-xs">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {tr(branch.name)}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {orgQuery.isLoading || (!branchId && branches.length > 0) ? (
        <LoadingState rows={3} />
      ) : !branchId ? (
        <EmptyState title={tr("Filial mavjud emas")} />
      ) : productsQuery.isLoading ? (
        <LoadingState />
      ) : productsQuery.isError ? (
        <ErrorState message={tr((productsQuery.error as Error).message)} />
      ) : !productsQuery.data || productsQuery.data.length === 0 ? (
        <EmptyState
          icon={<ShopIcon className="h-8 w-8" />}
          title={tr("Hali tovar qo'shilmagan")}
          description={canWrite ? tr("\"Tovar qo'shish\" tugmasi orqali birinchi tovarni qo'shing") : tr("Bu filialda hali tovar yo'q")}
          action={
            canWrite ? (
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                {tr("Tovar qo'shish")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {productsQuery.data.map((product) => (
            <ProductCard key={product.id} slug={slug} branchId={branchId} product={product} canWrite={canWrite} />
          ))}
        </div>
      )}

      {branchId && <CreateProductModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} branchId={branchId} />}
    </div>
  );
}
