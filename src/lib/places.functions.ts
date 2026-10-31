import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireApprovedAccount } from "@/lib/access.middleware";
import type { PlaceLead } from "./types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function creds() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Conexão com o Google Maps não configurada.");
  return { lovable, maps };
}

async function handleError(res: Response): Promise<never> {
  const text = await res.text();
  console.error(`Google Maps [${res.status}]: ${text}`);
  if (res.status === 403) throw new Error("O Google Maps negou a solicitação (403). Verifique a conexão do Google Maps.");
  if (res.status === 429) throw new Error("Limite de buscas do Google atingido. Tente mais tarde.");
  throw new Error(`Erro no Google Maps [${res.status}]`);
}

const SearchInput = z.object({
  niche: z.string().trim().min(2).max(80),
  city: z.string().trim().max(80).optional().default(""),
  store: z.boolean().optional().default(false),
  neighborhood: z.string().trim().max(80).optional().default(""),
  minRating: z.number().min(0).max(5).optional().default(0),
  pageToken: z.string().max(2000).optional(),
});

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireApprovedAccount])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error: auditError } = await context.supabase.rpc("record_access", { _kind: "search", _page: "/buscar", _detail: { niche: data.niche, city: data.city, neighborhood: data.neighborhood, minRating: data.minRating } });
    if (auditError) throw new Error("Não foi possível registrar a pesquisa. Tente novamente.");
    const { lovable, maps } = creds();
    const where = [data.neighborhood, data.city].filter(Boolean).join(", ");
    if (!data.store && data.city.length < 2) throw new Error("Informe a cidade.");
    // Loja específica: busca pelo nome em qualquer lugar do mundo (sem restringir ao Brasil).
    const body: Record<string, unknown> = {
      textQuery: data.store ? [data.niche, where].filter(Boolean).join(", ") : `${data.niche} em ${where}`,
      pageSize: 20,
      languageCode: "pt-BR",
    };
    if (!data.store) body["regionCode"] = "BR";
    if (data.minRating > 0) body["minRating"] = data.minRating;
    if (data.pageToken) body["pageToken"] = data.pageToken;

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": maps,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,nextPageToken",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) await handleError(res);
    const json = (await res.json()) as {
      places?: Array<Record<string, any>>;
      nextPageToken?: string;
    };
    const leads: PlaceLead[] = (json.places ?? [])
      .filter((p) => p["businessStatus"] !== "CLOSED_PERMANENTLY")
      .map((p) => ({
        placeId: p["id"],
        name: p["displayName"]?.text ?? "Sem nome",
        phone: p["nationalPhoneNumber"] ?? null,
        intlPhone: p["internationalPhoneNumber"] ?? null,
        address: p["formattedAddress"] ?? null,
        website: p["websiteUri"] ?? null,
        rating: typeof p["rating"] === "number" ? p["rating"] : null,
        reviews: typeof p["userRatingCount"] === "number" ? p["userRatingCount"] : 0,
        mapsUrl: p["googleMapsUri"] ?? null,
      }));
    return { leads, nextPageToken: json.nextPageToken ?? null };
  });

export async function fetchPlaceDetails(placeId: string) {
  const { lovable, maps } = creds();
  const res = await fetch(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": maps,
      "X-Goog-FieldMask":
        "displayName,formattedAddress,websiteUri,rating,userRatingCount,reviews,photos,regularOpeningHours,editorialSummary,primaryTypeDisplayName",
    },
  });
  if (!res.ok) await handleError(res);
  return (await res.json()) as Record<string, any>;
}
