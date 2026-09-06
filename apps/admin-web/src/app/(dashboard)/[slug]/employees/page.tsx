"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Employee, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { CreateEmployeeModal } from "@/features/employees/create-employee-modal";
import { EditSalarySchemeModal } from "@/features/hr/edit-salary-scheme-modal";
import { useBranchContext } from "@/lib/use-branch-context";

export default function EmployeesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);
  const [schemeEmployeeId, setSchemeEmployeeId] = useState<string | null>(null);
  const { user } = useAuth();
  const canWrite = user?.role !== "NETWORK_ADMIN";
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  const branches = orgQuery.data?.branches ?? [];
  const branchName = (branchId: string) => branches.find((b) => b.id === branchId)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Xodimlar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Tarbiyachilar va boshqa xodimlar</p>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi xodim</Button>}
      </div>

      {!canWrite && <ViewOnlyNote />}

      {employeesQuery.isLoading ? (
        <LoadingState />
      ) : employeesQuery.isError ? (
        <ErrorState message={(employeesQuery.error as Error).message} />
      ) : !employeesQuery.data || employeesQuery.data.length === 0 ? (
        <EmptyState title="Xodim topilmadi" description={canWrite ? "Yangi xodim qo'shish uchun tugmani bosing" : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">To'liq ism</th>
                  <th className="px-5 py-3 font-medium">Lavozim</th>
                  {!forcedBranchId && <th className="px-5 py-3 font-medium">Filial</th>}
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium">Maosh sxemasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {employeesQuery.data.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-[var(--color-text)]">{employee.fullName}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{employee.position}</td>
                    {!forcedBranchId && (
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{branchName(employee.branchId)}</td>
                    )}
                    <td className="px-5 py-3">
                      <Badge tone={employee.isActive ? "success" : "neutral"}>
                        {employee.isActive ? "Faol" : "Nofaol"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {canWrite && (
                        <Button size="sm" variant="secondary" onClick={() => setSchemeEmployeeId(employee.id)}>
                          Sozlash
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canWrite && <CreateEmployeeModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
      {canWrite && schemeEmployeeId && (
        <EditSalarySchemeModal
          open={!!schemeEmployeeId}
          onClose={() => setSchemeEmployeeId(null)}
          slug={slug}
          employeeId={schemeEmployeeId}
          employeeName={employeesQuery.data?.find((e) => e.id === schemeEmployeeId)?.fullName}
        />
      )}
    </div>
  );
}
