"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Employee, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { CreateEmployeeModal } from "@/features/employees/create-employee-modal";
import { EditSalarySchemeModal } from "@/features/hr/edit-salary-scheme-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";

export default function EmployeesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);
  const [schemeEmployeeId, setSchemeEmployeeId] = useState<string | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Xodimlar
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Tarbiyachilar va boshqa xodimlar</p>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi xodim</Button>}
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {employeesQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : employeesQuery.isError ? (
        <ErrorState message={(employeesQuery.error as Error).message} />
      ) : !employeesQuery.data || employeesQuery.data.length === 0 ? (
        <EmptyState title="Xodim topilmadi" description={canWrite ? "Yangi xodim qo'shish uchun tugmani bosing" : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>To'liq ism</Th>
                <Th>Lavozim</Th>
                <Th>Kabinet va guruhlar</Th>
                {!forcedBranchId && <Th>Filial</Th>}
                <Th>Holat</Th>
                <Th>Maosh sxemasi</Th>
              </tr>
            </THead>
            <TBody>
              {employeesQuery.data.map((employee) => (
                <Tr key={employee.id}>
                  <Td className="font-medium">{employee.fullName}</Td>
                  <Td className="text-[var(--color-text-muted)]">{employee.position}</Td>
                  <Td>
                    {employee.tenantUser ? (
                      <div className="space-y-1.5">
                        <p className="text-[12.5px] text-[var(--color-text-muted)]">{employee.tenantUser.email}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {employee.teachingGroups?.length ? (
                            employee.teachingGroups.map((link) => (
                              <Badge key={link.groupId} tone="primary">
                                {link.group?.name ?? "Guruh"}
                              </Badge>
                            ))
                          ) : (
                            <Badge tone="warning">Guruh biriktirilmagan</Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">Kabinet yo&apos;q</span>
                    )}
                  </Td>
                  {!forcedBranchId && <Td className="text-[var(--color-text-muted)]">{branchName(employee.branchId)}</Td>}
                  <Td>
                    <Badge tone={employee.isActive ? "success" : "neutral"}>
                      {employee.isActive ? "Faol" : "Nofaol"}
                    </Badge>
                  </Td>
                  <Td>
                    {canWrite && (
                      <Button size="sm" variant="outline" onClick={() => setSchemeEmployeeId(employee.id)}>
                        Sozlash
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
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
