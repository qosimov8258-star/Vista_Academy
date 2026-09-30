import { SetMetadata } from "@nestjs/common";

export const DENY_CALL_OPERATOR_KEY = "denyCallOperator";

/**
 * Call operator (qo'ng'iroq, ariza va qarzdorlar bilan ishlaydi) bu yo'lga
 * kira olmaydi. Bolalar va guruhlar ro'yxati unga kerak emas — faqat ariza
 * va qarzdor ota-onalar bilan gaplashadi.
 */
export const DenyCallOperator = () => SetMetadata(DENY_CALL_OPERATOR_KEY, true);
