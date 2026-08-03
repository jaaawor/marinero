import { GENERATED_GALLERIES } from "@/lib/generated-gallery-data"

export function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function field(value: any) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

export function getBrandNameFromAny(model: any) {
  return (
    field(model?.brandName) ||
    field(model?.brand?.name) ||
    field(model?.brand_name) ||
    field(model?.brand)
  )
}

export function getBrandSlugFromAny(model: any) {
  return (
    field(model?.brandSlug) ||
    field(model?.brand?.slug) ||
    slugify(getBrandNameFromAny(model))
  )
}

export function getSeriesFromAny(model: any) {
  const direct =
    field(model?.series) ||
    field(model?.product_line?.name) ||
    field(model?.productLine?.name) ||
    field(model?.line?.name)

  if (direct) return direct

  const name = field(model?.name).toLowerCase()
  const brand = getBrandNameFromAny(model).toLowerCase()

  if (brand.includes("aquila") || name.includes("aquila")) {
    if (name.includes("coupe")) return "Coupe"
    if (name.includes("sport")) return "Sport"
    if (name.includes("yacht")) return "Yacht"
    if (name.includes("sail")) return "Sail"
  }

  if (brand.includes("jeanneau") || name.includes("jeanneau")) {
    if (name.includes("merry fisher sport")) return "Merry Fisher Sport"
    if (name.includes("merry fisher")) return "Merry Fisher"
    if (name.includes("cap camarat")) return "Cap Camarat"
  }

  if (brand.includes("nordkapp") || name.includes("nordkapp")) {
    if (name.includes("noblesse")) return "Noblesse"
    if (name.includes("enduro")) return "Enduro"
    if (name.includes("avant")) return "Avant"
    if (name.includes("coupe")) return "Coupe"
    if (name.includes("airborne")) return "Airborne"
  }

  if (brand.includes("xo") || name.includes("xo-") || name.includes("xo ")) {
    if (name.includes("dfndr")) return "DFNDR"
    if (name.includes("dscvr")) return "DSCVR"
    if (name.includes("explr")) return "EXPLR"
  }

  if (brand.includes("sting") || name.includes("sting")) {
    if (name.includes("dc")) return "DC"
    if (name.includes("s")) return "S"
  }

  return ""
}

export function getSeriesSlugFromAny(model: any) {
  return slugify(getSeriesFromAny(model))
}

export function getModelImage(model: any) {
  const direct = field(model?.image)
  if (direct) return direct

  const slug = field(model?.slug)
  const generated = slug ? GENERATED_GALLERIES[slug]?.[0] : ""

  return generated || ""
}

export function getModelGallery(slug: string, model: any, official: any) {
  const heroImage = field(model?.image)
  const officialGallery = Array.isArray(official?.gallery) ? official.gallery : []
  const modelImages = Array.isArray(model?.images) ? model.images : []
  const generatedGallery = GENERATED_GALLERIES[slug] || []

  const urls = [heroImage, ...officialGallery, ...modelImages, ...generatedGallery]
    .map((image: any) => {
      if (typeof image === "string") return image
      return image?.url || image?.src || ""
    })
    .filter(Boolean)

  return Array.from(new Set(urls))
}
