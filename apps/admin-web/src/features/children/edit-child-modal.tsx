"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Child, Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { DateOfBirthInput } from "@/components/ui/date-of-birth-input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  groupId: z.string().optional(),
  lastName: z.string().min(2, "Familiya kamida 2 belgi"),
  firstName: z.string().min(2, "Ism kamida 2 belgi"),
  gender: z.enum(["MALE", "FEMALE"], { message: "Jinsini tanlang" }),
  birthDate: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type FormValues = z.infer<typeof schema>;

export function EditChildModal({
  open,
  onClose,
  slug,
  child,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  child: Child;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: child.firstName,
      lastName: child.lastName,
      gender: child.gender ?? "MALE",
      birthDate: child.birthDate ? child.birthDate.slice(0, 10) : "",
      groupId: child.groupId ?? "",
      status: child.status === "QUARANTINED" ? "ACTIVE" : child.status,
    },
  });

  const mutation = useMutation({
    // Karantindagi bola uchun "Holati" tanlagichi ekranda o'chirilgan bo'lsa
    // ham, brauzerning o'zi hali "ACTIVE" qiymatini saqlab turadi — shuni
    // yuborsak, backend butun so'rovni rad etadi (karantinni avval yopish
    // kerak). Shuning uchun bunday holatda `status` maydonini umuman
    // yubormaymiz, qolgan maydonlar (ism, guruh va h.k.) baribir saqlanadi.
    mutationFn: (values: FormValues) =>
      api.patch<Child>(`/app/children/${child.id}`, {
        ...values,
        status: child.status === "QUARANTINED" ? undefined : values.status,
        groupId: values.groupId || null,
        birthDate: values.birthDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child", slug, child.id] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Bolani tahrirlash">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Familiya" error={errors.lastName?.message} {...register("lastName")} />
          <Input label="Ism" error={errors.firstName?.message} {...register("firstName")} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Jinsi" error={errors.gender?.message} {...register("gender")}>
            <option value="MALE">O&apos;g&apos;il bola</option>
            <option value="FEMALE">Qiz bola</option>
          </Select>
          <Select label="Guruh" {...register("groupId")}>
            <option value="">Guruhsiz</option>
            {/* Bolaning joriy guruhi nofaol bo'lsa ham ro'yxatda ko'rinib
                tursin — aks holda tanlov shu guruh emasdek ko'rinardi.
                Boshqa nofaol guruhga o'tkazib bo'lmaydi. */}
            {groups
              ?.filter((group) => group.status === "ACTIVE" || group.id === child.groupId)
              .map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="birthDate"
            render={({ field }) => (
              <DateOfBirthInput
                label="Tug'ilgan sana"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.birthDate?.message}
              />
            )}
          />
          <Select
            label="Holati"
            error={errors.status?.message}
            disabled={child.status === "QUARANTINED"}
            hint={child.status === "QUARANTINED" ? "Karantindagi bolaning holatini avval karantinni yopib o'zgartiring" : undefined}
            {...register("status")}
          >
            <option value="ACTIVE">Faol</option>
            <option value="INACTIVE">Nofaol</option>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
