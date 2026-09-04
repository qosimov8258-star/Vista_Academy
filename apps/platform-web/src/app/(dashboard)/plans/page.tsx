"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Tarif rejalar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">SaaS obuna narxlari va limitlari</p>
        </div>
        <Button
          onClick={() => {
            setEditingPlan(null);
            setModalOpen(true);
          }}
        >
          + Yangi reja
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !plans || plans.length === 0 ? (
        <EmptyState title="Tarif rejalar yo'q" description="Birinchi tarif rejasini yarating" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-[var(--color-text)]">{plan.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{plan.code}</p>
                  </div>
                  <Badge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Faol" : "Nofaol"}</Badge>
                </div>
                <p className="text-2xl font-semibold text-[var(--color-text)]">
                  {formatMoney(plan.priceMonthly, plan.currency)}
                  <span className="text-sm font-normal text-[var(--color-text-muted)]"> /oy</span>
                </p>
                <ul className="space-y-1 text-sm text-[var(--color-text-muted)]">
                  <li>🏢 {plan.maxBranches} tagacha filial</li>
                  <li>🧒 {plan.maxChildren} tagacha bola</li>
                  <li>👥 {plan.maxEmployees} tagacha xodim</li>
                  <li>💾 {plan.maxStorageGb} GB storage</li>
                </ul>
                <div className="mt-auto flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingPlan(plan);
                      setModalOpen(true);
                    }}
                  >
                    Tahrirlash
                  </Button>
                  <Button
                    size="sm"
                    variant={plan.isActive ? "danger" : "primary"}
                    onClick={() => toggleActive.mutate(plan)}
                    loading={toggleActive.isPending}
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
