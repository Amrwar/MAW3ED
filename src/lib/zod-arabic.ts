import { z } from "zod";

/**
 * Arabic for the errors Zod writes itself.
 *
 * Every schema in validations.ts already carries Arabic messages, but
 * those only fire when a field is present and wrong. When one is
 * missing altogether, or an enum gets a value outside its set, Zod
 * falls back to its own English:
 *
 *   {"error":"Invalid input: expected string, received undefined"}
 *   {"error":"Invalid option: expected one of \"PENDING_PAYMENT\"…"}
 *
 * Those reach people. Routes return `issues[0].message` straight to the
 * client, and the booking widget renders it, so a malformed request
 * showed a developer's sentence — in English — inside an Arabic-first
 * product.
 *
 * Set globally rather than schema by schema. There are dozens of
 * schemas and the gap is in Zod's defaults, not in any one of them;
 * patching each would mean remembering to patch the next one too.
 *
 * Deliberately vague about *which* field. The message is shown to a
 * customer, and "serviceId is required" is a sentence about our data
 * model, not about anything they can act on. The field-specific
 * messages already in the schemas say the useful thing; this is only
 * the floor beneath them.
 */
export function installArabicZodErrors(): void {
  z.config({
    customError: (issue) => {
      switch (issue.code) {
        case "invalid_type":
          // The common case: a required field was not sent at all.
          return issue.input === undefined
            ? "في بيانات ناقصة، راجع الحقول المطلوبة"
            : "في بيانات مش بالشكل المتوقع";

        case "invalid_value":
        case "invalid_union":
          return "القيمة دي مش من الاختيارات المتاحة";

        case "too_small":
          return "القيمة أقصر من المسموح";

        case "too_big":
          return "القيمة أطول من المسموح";

        case "invalid_format":
          return "الصيغة مش صحيحة";

        default:
          return "طلب غير صالح";
      }
    },
  });
}
