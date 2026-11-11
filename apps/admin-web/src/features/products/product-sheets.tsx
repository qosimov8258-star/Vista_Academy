"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera as CameraIcon, Minus as MinusIcon, Pencil, Plus as PlusIcon, Star, Store, Trash2, X as CloseIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Product } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { FieldRow, FormSection, TextArea, TextInput } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { Spinner } from "@/components/ios/spinner";
import { IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { prepareProductPhoto } from "@/lib/product-photo";
import { useTr } from "@/i18n/tr";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const SLOTS = [1, 2, 3] as const;
type Slot = (typeof SLOTS)[number];

export function productImageUrl(product: Product, position: Slot) {
  return `${API_URL}/app/products/${product.id}/images/${position}?v=${encodeURIComponent(product.imagesUpdatedAt ?? "")}`;
}

export function productImagePositions(product: Product): Slot[] {
  return SLOTS.filter((p) => (p === 1 ? product.hasImage1 : p === 2 ? product.hasImage2 : product.hasImage3));
}

/** Narx kapsulasi: ⭐ 120 */
export function PricePill({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold tabular-nums",
        large ? "h-9 px-3.5 text-[17px]" : "h-7 px-2.5 text-[14px]",
      )}
      style={{ color: IOS.orange, backgroundColor: `${IOS.orange}1f` }}
    >
      <Star className={large ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} fill={IOS.orange} stroke={IOS.orange} />
      {value}
    </span>
  );
}

/** Qoldiq kapsulasi: «12 ta» (yashil) yoki «Tugagan» (qizil) */
export function StockPill({ quantity }: { quantity: number }) {
  const tr = useTr();
  return <Pill color={quantity > 0 ? IOS.green : IOS.red}>{quantity > 0 ? tr("{0} ta", quantity) : tr("Tugagan")}</Pill>;
}

/**
 * Tovar suratlari — telefonda barmoq bilan suriladi (scroll-snap), pastda
 * nuqtalar; kompyuterda chetdagi o'q tugmalari ham bor.
 */
function Gallery({ product }: { product: Product }) {
  const tr = useTr();
  const positions = productImagePositions(product);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const go = (next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const i = (next + positions.length) % positions.length;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  };

  if (positions.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[18px] bg-white">
        <Store className="h-14 w-14 text-[#c7c7cc]" strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex aspect-square snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-[18px] bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {positions.map((pos, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil
          <img key={pos} src={productImageUrl(product, pos)} alt={`${product.name} ${i + 1}`} draggable={false} className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {positions.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {positions.map((pos, i) => (
              <span key={pos} className={clsx("h-1.5 rounded-full bg-white shadow transition-all", i === index ? "w-4" : "w-1.5 opacity-60")} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={tr("Oldingi rasm")}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--color-text)] shadow sm:flex"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={tr("Keyingi rasm")}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--color-text)] shadow sm:flex"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/** Tovar varag'i — suratlar, nom, narx, qoldiq, izoh; yozish huquqi bo'lsa «Tahrirlash». */
export function ProductDetailSheet({
  open,
  onClose,
  product,
  onEdit,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  onEdit?: () => void;
}) {
  const tr = useTr();
  return (
    <IosSheet open={open} onClose={onClose} cancelLabel="Yopish" title={tr("Tovar")}>
      <Gallery product={product} />

      <div className="px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[20px] font-bold leading-tight text-[var(--color-text)]">{tr(product.name)}</p>
            {product.color && <p className="mt-0.5 text-[15px] text-[#8e8e93]">{tr(product.color)}</p>}
          </div>
          <PricePill value={product.priceCoins} large />
        </div>
      </div>

      <SheetSection>
        <Row title={tr("Qoldiq")} value={<StockPill quantity={product.quantity} />} />
        <Row title={tr("Narxi")} value={tr("{0} ta yulduzcha", product.priceCoins)} />
      </SheetSection>

      {product.description && (
        <SheetSection title={tr("Izoh")}>
          <p className="whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed text-[var(--color-text)]">{tr(product.description)}</p>
        </SheetSection>
      )}

      {onEdit && (
        <SheetSection>
          <Row leading={<IosIcon icon={Pencil} tint="blue" size={30} />} title={tr("Tahrirlash")} subtitle={tr("Nomi, narxi, soni, suratlari")} onClick={onEdit} />
        </SheetSection>
      )}
    </IosSheet>
  );
}

type SlotState = { status: "empty" } | { status: "existing" } | { status: "new"; image: string } | { status: "removed" };

/**
 * Yangi tovar / tovarni tahrirlash — bitta iOS varaq. Tepada 3 ta surat
 * katakchasi, keyin nom, izoh, rang, narx va soni (−/+ bilan, telefonda
 * qulay). Tahrirlashda pastda «Tovarni o'chirish» — varaq ichida tasdiqlanadi.
 */
export function ProductFormSheet({
  open,
  onClose,
  slug,
  branchId,
  product,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string;
  /** Berilsa — tahrirlash, aks holda yangi tovar */
  product?: Product | null;
  /** Tovar o'chirilgach (berilmasa — onClose) */
  onDeleted?: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const editing = !!product;
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [slots, setSlots] = useState<Record<number, SlotState>>({ 1: { status: "empty" }, 2: { status: "empty" }, 3: { status: "empty" } });
  const [checkingSlot, setCheckingSlot] = useState<number | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setColor(product?.color ?? "");
    setPrice(product ? String(product.priceCoins) : "");
    setQuantity(product ? String(product.quantity) : "1");
    setSlots(
      Object.fromEntries(
        SLOTS.map((p) => [p, product && productImagePositions(product).includes(p) ? { status: "existing" } : { status: "empty" }]),
      ) as Record<number, SlotState>,
    );
    setImageError(null);
    setTried(false);
    setConfirmDelete(false);
  }, [open, product]);

  const errors = {
    name: name.trim().length < 2 ? "Nomi kamida 2 belgi" : undefined,
    description: description.length > 500 ? "Izoh 500 belgidan oshmasin" : undefined,
    price: price === "" ? "Yulduzcha miqdorini kiriting" : undefined,
    quantity: quantity === "" ? "Sonini kiriting" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        priceCoins: Number(price),
        quantity: Number(quantity),
      };
      let id = product?.id;
      if (editing) {
        await api.patch(`/app/products/${id}`, { ...body, description: description.trim() || null, color: color.trim() || null });
      } else {
        // branchId yuborilmaydi — server uni foydalanuvchi scope'idan oladi
        const created = await api.post<Product>("/app/products", { ...body, description: description.trim() || undefined, color: color.trim() || undefined });
        id = created.id;
      }
      // Suratlar alohida so'rovlar bilan; biri yiqilsa ham tovar saqlangan bo'ladi
      await Promise.all(
        SLOTS.map((position) => {
          const slot = slots[position];
          if (slot.status === "new") return api.put(`/app/products/${id}/images/${position}`, { image: slot.image }).catch(() => {});
          if (slot.status === "removed") return api.delete(`/app/products/${id}/images/${position}`).catch(() => {});
          return Promise.resolve();
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", slug, branchId] });
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/app/products/${product!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", slug, branchId] });
      (onDeleted ?? onClose)();
    },
  });

  const { reset: resetSave } = save;
  const { reset: resetRemove } = remove;
  useEffect(() => {
    if (open) {
      resetSave();
      resetRemove();
    }
  }, [open, resetSave, resetRemove]);

  const pick = async (position: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageError(null);
    setCheckingSlot(position);
    try {
      const result = await prepareProductPhoto(file);
      if (result.ok) setSlots((prev) => ({ ...prev, [position]: { status: "new", image: result.image } }));
      else setImageError(result.reason);
    } finally {
      setCheckingSlot(null);
    }
  };

  const clearSlot = (position: number) =>
    setSlots((prev) => ({ ...prev, [position]: prev[position].status === "existing" || prev[position].status === "removed" ? { status: "removed" } : { status: "empty" } }));

  const submit = () => {
    setTried(true);
    if (!valid || save.isPending) return;
    save.mutate();
  };
  const busy = save.isPending || remove.isPending;
  const step = (value: string, delta: number) => String(Math.max(0, (Number(value) || 0) + delta));

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={editing ? tr("Tovarni tahrirlash") : tr("Yangi tovar")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!valid}>
          {editing ? tr("Saqlash") : tr("Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      {/* Suratlar: 3 ta katakcha */}
      <section>
        <div className="grid grid-cols-3 gap-2.5">
          {SLOTS.map((position) => {
            const slot = slots[position];
            const src =
              slot.status === "new" ? slot.image : slot.status === "existing" && product ? productImageUrl(product, position) : null;
            const checking = checkingSlot === position;
            return (
              <div key={position} className="relative aspect-square">
                {src ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- tashqi/data: manzil */}
                    <img src={src} alt={`${tr("Surat")} ${position}`} className="h-full w-full rounded-[14px] bg-white object-cover" />
                    <button
                      type="button"
                      onClick={() => clearSlot(position)}
                      aria-label={tr("Rasmni olib tashlash")}
                      className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f2f2f7] bg-[#ff3b30] text-white"
                    >
                      <CloseIcon className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRefs.current[position]?.click()}
                    disabled={checking}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[14px] bg-white text-[var(--color-primary)] transition-transform active:scale-[0.97] disabled:cursor-wait"
                  >
                    {checking ? <Spinner className="h-5 w-5" /> : <CameraIcon className="h-6 w-6" />}
                    <span className="text-[12.5px] font-medium">{position === 1 ? tr("Asosiy") : tr("Qo'shish")}</span>
                  </button>
                )}
                <input
                  ref={(el) => {
                    fileRefs.current[position] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => pick(position, e)}
                />
              </div>
            );
          })}
        </div>
        <p className={clsx("px-4 pt-2 text-[12.5px] leading-snug", imageError ? "text-[#ff3b30]" : "text-[#8e8e93]")}>
          {imageError ? tr(imageError) : tr("3 tagacha surat. Birinchisi ro'yxatda ko'rinadi.")}
        </p>
      </section>

      <FormSection>
        <FieldRow label={tr("Nomi")} htmlFor="product-name" error={show("name")}>
          <TextInput id="product-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={tr("Konstruktor to'plami")} />
        </FieldRow>
        <FieldRow label={tr("Rangi")} htmlFor="product-color">
          <TextInput id="product-color" value={color} onChange={(e) => setColor(e.target.value)} maxLength={60} placeholder={tr("Ixtiyoriy")} />
        </FieldRow>
        <FieldRow label={tr("Izoh")} htmlFor="product-description" error={show("description")} stacked>
          <TextArea
            id="product-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={tr("Nima uchun ekanligi haqida qisqacha (ixtiyoriy)")}
          />
        </FieldRow>
      </FormSection>

      <FormSection title={tr("Narx va soni")}>
        <StepperRow
          label={tr("Narxi")}
          suffix={<Star className="h-4 w-4 shrink-0" fill={IOS.orange} stroke={IOS.orange} />}
          value={price}
          onChange={setPrice}
          onStep={(d) => setPrice((v) => step(v, d * 5))}
          error={show("price")}
          id="product-price"
        />
        <StepperRow
          label={tr("Soni")}
          suffix={<span className="text-[13px] text-[#8e8e93]">{tr("ta")}</span>}
          value={quantity}
          onChange={setQuantity}
          onStep={(d) => setQuantity((v) => step(v, d))}
          error={show("quantity")}
          id="product-quantity"
        />
      </FormSection>

      {editing && (
        <SheetSection>
          {!confirmDelete ? (
            <Row
              leading={<IosIcon icon={Trash2} tint="red" size={30} />}
              title={<span className="text-[#ff3b30]">{tr("Tovarni o'chirish")}</span>}
              onClick={() => setConfirmDelete(true)}
              chevron={false}
            />
          ) : (
            <div className="space-y-3 bg-[#ff3b30]/[0.06] px-4 py-3.5">
              <p className="text-[13.5px] leading-snug text-[#ff3b30]">
                <b>{tr(product!.name)}</b> {tr("do'kondan butunlay o'chiriladi.")}
              </p>
              {remove.isError && <p className="text-[12.5px] text-[#ff3b30]">{tr("Kutilmagan xatolik yuz berdi")}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => setConfirmDelete(false)}
                  className="h-10 flex-1 rounded-full bg-white text-[15px] font-semibold text-[var(--color-text)] transition-transform active:scale-[0.97]"
                >
                  {tr("Qoldirish")}
                </button>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                  className="flex h-10 flex-1 items-center justify-center rounded-full bg-[#ff3b30] text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {remove.isPending ? <Spinner className="h-4 w-4 text-white" /> : tr("O'chirish")}
                </button>
              </div>
            </div>
          )}
        </SheetSection>
      )}

      {save.error && (
        <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
          {save.error instanceof ApiError ? tr(save.error.message) : tr("Kutilmagan xatolik yuz berdi")}
        </p>
      )}
    </IosSheet>
  );
}

/** Son qatori: chapda yorliq, o'ngda −  [son]  + (bosh barmoq bilan qulay, 44px) */
function StepperRow({
  label,
  value,
  onChange,
  onStep,
  suffix,
  error,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onStep: (delta: 1 | -1) => void;
  suffix: React.ReactNode;
  error?: string;
  id: string;
}) {
  const tr = useTr();
  return (
    <div className={clsx("group/row relative px-4", error && "bg-[#ff3b30]/[0.06]")}>
      <div className="flex min-h-[56px] items-center gap-2">
        <label htmlFor={id} className="w-[72px] shrink-0 text-[15px] text-[var(--color-text)]">
          {label}
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={!value || Number(value) <= 0}
            aria-label={tr("Kamaytirish")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[var(--color-text)] transition-opacity active:opacity-60 disabled:opacity-35"
          >
            <MinusIcon className="h-4 w-4" strokeWidth={2.6} />
          </button>
          <div className="flex w-[92px] items-center justify-center gap-1">
            <input
              id={id}
              inputMode="numeric"
              value={value}
              onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="0"
              className="w-[60px] bg-transparent text-center text-[20px] font-semibold tabular-nums text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
            />
            {suffix}
          </div>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label={tr("Ko'paytirish")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[var(--color-text)] transition-opacity active:opacity-60"
          >
            <PlusIcon className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="-mt-1 pb-2.5 text-[12.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </p>
      )}
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}
