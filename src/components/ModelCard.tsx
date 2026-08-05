import {
  formatNumberPl,
  getBrandNameFromAny,
  getModelImage,
  getSeriesFromAny,
} from "@/lib/model-taxonomy"

type ModelCardProps = {
  model: any
  badge?: string
}

// Karta modelu w układzie wzorcowym (MennYacht): zdjęcie, marka, nazwa,
// seria i mini-specyfikacja (długość / szerokość / kabiny lub osoby).
export default function ModelCard({ model, badge }: ModelCardProps) {
  const image = getModelImage(model)
  const brandName = getBrandNameFromAny(model)
  const seriesName = getSeriesFromAny(model)

  const length = formatNumberPl(model?.loa)
  const beam = formatNumberPl(model?.beam)
  const cabins = String(model?.cabins || "").trim()
  const people = String(model?.maxPeople || model?.max_people || "").trim()

  return (
    <a
      href={`/modele/${model.slug}`}
      className="block overflow-hidden rounded-lg border border-[#111827]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="h-56 bg-[#ddd7ca]">
        {image ? (
          <img src={image} alt={model.name} className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="p-5">
        {brandName ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#111827]/40">
            {brandName}
          </p>
        ) : null}

        <h2 className="mt-3 text-xl font-semibold">{model.name}</h2>

        <p className="mt-2 text-sm text-[#111827]/50">
          {badge || seriesName || " "}
        </p>

        {length || beam || cabins || people ? (
          <div className="mt-5 grid grid-cols-3 gap-3 text-sm text-[#111827]/55">
            {length ? (
              <div>
                <p className="text-xs text-[#111827]/35">Długość</p>
                <p className="font-semibold">{length} m</p>
              </div>
            ) : null}

            {beam ? (
              <div>
                <p className="text-xs text-[#111827]/35">Szerokość</p>
                <p className="font-semibold">{beam} m</p>
              </div>
            ) : null}

            {cabins ? (
              <div>
                <p className="text-xs text-[#111827]/35">Kabiny</p>
                <p className="font-semibold">{cabins}</p>
              </div>
            ) : people ? (
              <div>
                <p className="text-xs text-[#111827]/35">Osoby</p>
                <p className="font-semibold">{people}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </a>
  )
}
