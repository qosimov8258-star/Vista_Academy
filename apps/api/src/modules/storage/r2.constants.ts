/** Imzolangan (presigned) R2 havolasi qancha vaqt amal qiladi. */
export const R2_PRESIGN_EXPIRY_SECONDS = 300;

/** Obyekt kaliti yo'lidagi "tur" segmenti: `${R2_KEY_PREFIX}<organizationId>/<tur>/<uuid>`. */
export const R2_CATEGORY = {
  TENANT_USER_AVATAR: "avatar",
  BRANCH_AVATAR: "branch-avatar",
  CHILD_AVATAR: "child-avatar",
  GROUP_AVATAR: "group-avatar",
  ORGANIZATION_LOGO: "organization-logo",
  EMPLOYEE_AVATAR: "employee-avatar",
  MENU_PHOTO: "menu-photo",
  PRODUCT_IMAGE: "product-image",
  PAYMENT_RECEIPT: "payment-receipt",
  DIARY_MEDIA: "diary-media",
  DIARY_POSTER: "diary-poster",
  STAFF_DOCUMENT: "staff-document",
  GROUP_MATERIAL: "group-material",
  ARTICLE_COVER: "article-cover",
  GALLERY_IMAGE: "gallery-image",
} as const;
