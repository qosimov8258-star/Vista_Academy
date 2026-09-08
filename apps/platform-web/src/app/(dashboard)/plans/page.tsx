"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CardsSkeleton, ErrorState, EmptyState } from "@/components/ui/states";
import { BuildingIcon, CardIcon, ChildIcon, DatabaseIcon, PlusIcon, TeamIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";
import { PlanFormModal } from "@/features/plans/plan-form-modal";

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const { data: plans, isLoading, isError, error } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/platform/plans"),
  });

  const toggleActive = useMutation({
    mutationFn: (plan: Plan) => api.patch<Plan>(`/platform/plans/${plan.id}`, { isActive: !plan.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const openCreate = () => {
    setEditingPlan(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tarif rejalar"
        description="SaaS obuna narxlari va limitlari"
        actions={
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />
            Yangi reja
          </Button>
        }
      />

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !plans || plans.length === 0 ? (
        <EmptyState
          icon={CardIcon}
          title="Tarif rejalar yo'q"
          description="Tashkilotlarga obuna biriktirish uchun avval tarif rejasini yarating"
          action={
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              Yangi reja
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              // Nofaol rejalar bir qarashda ajralib tursin
              className={`flex flex-col ${plan.isActive ? "" : "opacity-70"}`}
            >
              <CardBody className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-[var(--color-text)]">{plan.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
                      {plan.code}
                    </p>
                  </div>
                  <Badge dot tone={plan.isActive ? "success" : "neutral"}>
                    {plan.isActive ? "Faol" : "Nofaol"}
                  </Badge>
                </div>

                <p className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-semibold tabular-nums leading-none text-[var(--color-text)]">
                    {formatMoney(plan.priceMonthly, plan.currency)}
                  </span>
                  <span className="text-[13px] text-[var(--color-text-muted)]">/oy</span>
                </p>

                {/* Limitlar — iOS ro'yxati uslubida, emoji o'rniga ikonkalar bilan */}
                <ul className="space-y-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-3.5 py-3 text-[13px] text-[var(--color-text-muted)]">
                  <li className="flex items-center gap-2.5">
                    <BuildingIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)]" />
                    <span className="tabular-nums">{plan.maxBranches}</span> tagacha filial
                  </li>
                  <li className="flex items-center gap-2.5">
                    <ChildIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)]" />
                    <span className="tabular-nums">{plan.maxChildren}</span> tagacha bola
                  </li>
                  <li className="flex items-center gap-2.5">
                    <TeamIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)]" />
                    <span className="tabular-nums">{plan.maxEmployees}</span> tagacha xodim
                  </li>
                  <li className="flex items-center gap-2.5">
                    <DatabaseIcon className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)]" />
                    <span className="tabular-nums">{plan.maxStorageGb}</span> GB xotira
                  </li>
                </ul>

                <div className="mt-auto flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setEditingPlan(plan);
                      setModalOpen(true);
                    }}
                  >
                    Tahrirlash
                  </Button>
                  <Button
                    size="sm"
                    variant={plan.isActive ? "secondary" : "primary"}
                    className={plan.isActive ? "flex-1 text-[var(--color-danger)]" : "flex-1"}
                    onClick={() => toggleActive.mutate(plan)}
                    loading={toggleActive.isPending && toggleActive.variables?.id === plan.id}
                  >
                    {plan.isActive ? "Faolsizlantirish" : "Faollashtirish"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <PlanFormModal open={modalOpen} onClose={() => setModalOpen(false)} plan={editingPlan} />
    </div>
  );
}
