import { z } from "zod";

const glossaryInput = z.object({
  term: z.string().min(1),
  category: z.string().optional(),
  language: z.enum(["th", "en", "both"]).default("both"),
});

/**
 * Look up Thai legal terms with definitions and references.
 */
export async function glossaryLookup(
  params: Record<string, unknown>
): Promise<unknown> {
  const input = glossaryInput.parse(params);

  // TODO: implement database query
  // const results = await db.query.glossary.findMany({
  //   where: or(
  //     ilike(glossary.termTh, `%${input.term}%`),
  //     ilike(glossary.termEn, `%${input.term}%`),
  //   ),
  // });

  return {
    entries: [],
    total: 0,
    _note: "Not yet implemented — waiting for database setup and glossary data",
  };
}
