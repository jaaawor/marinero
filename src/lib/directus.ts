const DIRECTUS_URL =
  process.env.DIRECTUS_URL || "https://dms.marinero.150197.pl"

type DirectusListResponse<T> = {
  data?: T[]
}

type DirectusItemResponse<T> = {
  data?: T
}

async function directusList<T>(
  path: string,
  fallback: T[] = []
): Promise<T[]> {
  try {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      console.error("Directus list error", path, res.status)
      return fallback
    }

    const json = (await res.json()) as DirectusListResponse<T>
    return Array.isArray(json.data) ? json.data : fallback
  } catch (error) {
    console.error("Directus list fetch failed", path, error)
    return fallback
  }
}

async function directusItem<T>(
  path: string,
  fallback: T | null = null
): Promise<T | null> {
  try {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      console.error("Directus item error", path, res.status)
      return fallback
    }

    const json = (await res.json()) as DirectusItemResponse<T>
    return json.data || fallback
  } catch (error) {
    console.error("Directus item fetch failed", path, error)
    return fallback
  }
}

export function getAssetUrl(file: any) {
  if (!file) return ""

  if (typeof file === "string") {
    return `${DIRECTUS_URL}/assets/${file}`
  }

  if (file?.id) {
    return `${DIRECTUS_URL}/assets/${file.id}`
  }

  return ""
}

export async function getSiteSettings() {
  // `site_settings` to w Directusie singleton — `data` jest obiektem, nie tablicą.
  // Przez `directusList` wracała pusta lista i strona zawsze brała wartości zapasowe.
  const settings = await directusItem<any>("/items/site_settings", null)

  return (
    settings || {
      site_name: "Marinero",
      email: "info@marinero.pl",
      phone: "",
      address: "",
    }
  )
}

/** Strona treściowa z kolekcji `pages` — regulamin, polityka prywatności. */
export async function getPageBySlug(slug: string) {
  const pages = await directusList<any>(
    `/items/pages?filter[status][_eq]=published&filter[slug][_eq]=${encodeURIComponent(
      slug
    )}&limit=1&fields=title,slug,content,excerpt,seo_title,seo_description`,
    []
  )

  return pages[0] || null
}

export async function getBrands() {
  return directusList<any>(
    "/items/brands?filter[status][_eq]=published&sort=sort,name&fields=id,name,slug,description,status,sort",
    []
  )
}

export async function getBrandBySlug(slug: string) {
  const brands = await directusList<any>(
    `/items/brands?filter[slug][_eq]=${encodeURIComponent(
      slug
    )}&filter[status][_eq]=published&limit=1&fields=id,name,slug,description,status,sort`,
    []
  )

  const brand = brands[0]

  if (!brand) return null

  const productLines = await directusList<any>(
    `/items/product_lines?filter[brand][_eq]=${brand.id}&filter[status][_eq]=published&sort=sort,name&fields=id,name,slug,description,status,sort,brand`,
    []
  )

  const models = await directusList<any>(
    `/items/boat_models?filter[brand][_eq]=${brand.id}&filter[status][_eq]=published&sort=product_line.sort,sort,name&fields=id,name,slug,status,sort,brand.id,brand.name,brand.slug,product_line.id,product_line.name,product_line.slug,short_description,hero_image`,
    []
  )

  return {
    brand,
    productLines,
    models,
  }
}

export async function getBoatCategories() {
  return directusList<any>(
    "/items/boat_categories?filter[status][_eq]=published&sort=sort,name&fields=id,name,slug,status,sort",
    []
  )
}

export async function getBoatModels() {
  return directusList<any>(
    "/items/boat_models?filter[status][_eq]=published&sort=brand.name,product_line.name,sort,name&fields=id,name,slug,status,sort,brand.id,brand.name,brand.slug,product_line.id,product_line.name,product_line.slug,short_description,hero_image",
    []
  )
}

export async function getEngineBrands() {
  return directusList<any>(
    "/items/engine_brands?filter[status][_eq]=published&sort=sort,name&fields=id,name,slug,description,status,sort",
    []
  )
}

export async function getEngineModels() {
  return directusList<any>(
    "/items/engine_models?filter[status][_eq]=published&sort=brand.name,sort,name&fields=id,name,slug,status,sort,brand.id,brand.name,brand.slug,short_description",
    []
  )
}

export async function getNews() {
  return directusList<any>(
    "/items/news?filter[status][_eq]=published&sort=-date_created&fields=id,title,slug,excerpt,hero_image,date_created,status",
    []
  )
}

export async function getFooterData() {
  const [settings, brands] = await Promise.all([
    getSiteSettings(),
    getBrands(),
  ])

  return {
    settings,
    brands,
  }
}

export async function getHomeData() {
  const [brands, models, news] = await Promise.all([
    getBrands(),
    getBoatModels(),
    getNews(),
  ])

  return {
    brands,
    models,
    yachts: models,
    news,
  }
}

export async function getBoatModelImages(modelId: any): Promise<string[]> {
  if (modelId === null || modelId === undefined || modelId === "") return []

  const items = await directusList<any>(
    "/items/boat_model_images?limit=500&fields=*",
    []
  )

  const matches = items.filter((item) => {
    const ref =
      item?.boat_model ?? item?.model ?? item?.boat ?? item?.boat_models_id
    const refId = typeof ref === "object" && ref !== null ? ref.id : ref
    return refId !== null && refId !== undefined && String(refId) === String(modelId)
  })

  matches.sort((a, b) => (Number(a?.sort) || 0) - (Number(b?.sort) || 0))

  return matches
    .map((item) =>
      getAssetUrl(
        item?.image ?? item?.file ?? item?.photo ?? item?.directus_files_id
      )
    )
    .filter(Boolean)
}

export async function getBoatModelBySlug(slug: string) {
  // Modele archiwalne (wycofane z produkcji) też mają swoje strony — z oznaczeniem, bez ceny.
  const models = await directusList<any>(
    `/items/boat_models?filter[slug][_eq]=${encodeURIComponent(slug)}&filter[status][_in]=published,archived&limit=1&fields=id,name,slug,status,sort,brand.id,brand.name,brand.slug,product_line.id,product_line.name,product_line.slug,short_description,description,hero_image,loa,beam,draft,weight,fuel_capacity,water_capacity,max_people,max_persons,cabins,bathrooms,engine_recommendation,engines,ce_category,base_price,currency,vat_status,old_site_url,old_site_title,old_site_raw_text`,
    []
  )

  const model = models[0] || null

  if (!model) return null

  return {
    ...model,
    image: getAssetUrl(model.hero_image),
    images: await getBoatModelImages(model.id),
  }
}


