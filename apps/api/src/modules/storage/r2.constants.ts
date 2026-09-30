/** Imzolangan (presigned) R2 havolasi qancha vaqt amal qiladi. */
export const R2_PRESIGN_EXPIRY_SECONDS = 300;

/** Obyekt kaliti yo'lidagi "tur" segmenti: `${R2_KEY_PREFIX}<organizationId>/<tur>/<uuid>`. */
export const R2_CATEGORY = {
  TENANT_USER_AVATAR: "avatar",
  BRANCH_AVATAR: "branch-avatar",
  CHILD_AVATAR: "child-avatar",
  EMPLOYEE_AVATAR: "employee-avatar",
  MENU_PHOTO: "menu-photo",
  PRODUCT_IMAGE: "product-image",
  PAYMENT_RECEIPT: "payment-receipt",
  DIARY_MEDIA: "diary-media",
  DIARY_POSTER: "diary-poster",
} as const;
