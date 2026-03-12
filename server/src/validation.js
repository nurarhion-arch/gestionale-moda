import { z } from "zod";

const variantSchema = z.object({
  colore: z.string().trim().min(1),
  taglia: z.string().trim().min(1),
  quantita: z.coerce.number().int().min(0),
  box: z.coerce.number().int().min(0).optional().default(0)
});

export const createArticoloSchema = z.object({
  codice_articolo: z.string().trim().min(1),
  descrizione: z.string().trim().optional().default(""),
  composizione: z.string().trim().optional().default(""),
  prezzo: z.coerce.number().finite().min(0),
  foto_data_url: z.string().trim().min(1).optional().nullable(),
  fornitore: z.string().trim().optional().default(""),
  cliente: z.string().trim().optional().default(""),
  varianti: z.array(variantSchema).min(1)
});

