import { SetMetadata } from "@nestjs/common";

export const ALLOW_CHEF_KEY = "allowChef";

/**
 * Oshpaz (CHEF) faqat shu belgi qo'yilgan endpointlarga kira oladi —
 * controller'ga qo'yilsa uning hamma yo'llariga, metodga qo'yilsa faqat
 * o'shanga. Qolgan hamma tenant endpointlari (keyin qo'shiladiganlari ham)
 * oshpazga avtomatik yopiq: tekshiruv `TenantJwtAuthGuard` ichida.
 */
export const AllowChef = () => SetMetadata(ALLOW_CHEF_KEY, true);
