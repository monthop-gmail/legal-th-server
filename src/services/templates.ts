import { z } from "zod";

const getTemplateInput = z.object({
  template_id: z.string().optional(),
  template_type: z
    .enum([
      "employment",
      "nda",
      "service",
      "lease",
      "sale",
      "loan",
      "partnership",
      "license",
    ])
    .optional(),
  variant: z.enum(["standard", "simplified", "bilingual"]).default("standard"),
  language: z.enum(["th", "en", "bilingual"]).default("th"),
});

/**
 * Retrieve legal document templates.
 */
export async function getTemplate(
  params: Record<string, unknown>
): Promise<unknown> {
  const input = getTemplateInput.parse(params);

  if (!input.template_id && !input.template_type) {
    throw new Error("Either template_id or template_type is required");
  }

  // TODO: implement database query
  // const template = await db.query.templates.findFirst({
  //   where: input.template_id
  //     ? eq(templates.id, input.template_id)
  //     : and(
  //         eq(templates.type, input.template_type!),
  //         eq(templates.variant, input.variant),
  //       ),
  // });

  return {
    template: null,
    _note:
      "Not yet implemented — waiting for database setup and template data",
  };
}
