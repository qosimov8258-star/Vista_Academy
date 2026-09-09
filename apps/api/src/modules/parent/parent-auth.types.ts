/**
 * Ota-ona kabineti xodimlar tizimidan butunlay ajratilgan: alohida token,
 * alohida cookie, alohida strategiya. Shu sababli ota-ona tokeni hech
 * qachon `TenantJwtAuthGuard` dan o'tolmaydi va aksincha — bu ajratish
 * tasodifiy sozlamaga emas, tuzilmaga bog'langan.
 */
export interface ParentAccessTokenPayload {
  sub: string;
  organizationId: string;
  organizationSlug: string;
  phone: string;
}

export interface AuthenticatedParent {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  fullName: string;
  phone: string;
}
