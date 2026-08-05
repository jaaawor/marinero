#!/usr/bin/env node
// Pobiera zdjęcia modeli z manifestu (scripts/model-image-manifest.json) do
// public/images/models/<slug>/NN.<ext>, żeby strona serwowała je lokalnie
// zamiast hotlinkować ze starej strony marinero.pl / SmugMug / stron marek.
//
// Tryby:
//   node scripts/fetch-model-images.mjs            # pobiera brakujące pliki (uruchamiane przy buildzie)
//   node scripts/fetch-model-images.mjs --emit     # regeneruje src/lib/local-gallery-data.ts z manifestu
//   node scripts/fetch-model-images.mjs --discover <url>
//        # wypisuje URL-e zdjęć znalezione na podanej stronie (og:image, <img>, srcset,
//        #   linki do plików graficznych) — do ręcznego uzupełniania manifestu o zdjęcia
//        #   z oficjalnych stron marek (aquila.smugmug.com, nordkappboats.com,
//        #   jeanneau.com, xoboats.com itd.)
//
// Zasady:
// - Pliki już pobrane są pomijane (cache między buildami).
// - Błąd pobierania NIE przerywa builda (exit 0) — strona ma fallback na zdalny URL.
// - Nazwy plików wynikają deterministycznie z kolejności w manifeście, więc
//   src/lib/local-gallery-data.ts (generowany przez --emit) jest commitowany do repo.
//   Po każdej zmianie manifestu trzeba uruchomić --emit i zacommitować wynik.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const MANIFEST_PATH = path.join(ROOT, "scripts", "model-image-manifest.json")
const OUTPUT_DIR = path.join(ROOT, "public", "images", "models")
const DATA_PATH = path.join(ROOT, "src", "lib", "local-gallery-data.ts")

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
}

function extensionFor(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const ext = path.extname(pathname)
    if (IMAGE_EXTENSIONS.includes(ext)) return ext === ".jpeg" ? ".jpg" : ext
  } catch {
    // zostaje domyślne
  }
  return ".jpg"
}

function localPathFor(slug, index, url) {
  const name = `${String(index + 1).padStart(2, "0")}${extensionFor(url)}`
  return `/images/models/${slug}/${name}`
}

async function downloadOne(url, filePath) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "image/*,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || ""
  const buffer = Buffer.from(await response.arrayBuffer())

  if (!contentType.startsWith("image/") && buffer.length < 5000) {
    throw new Error(`nie wygląda na obraz (content-type: ${contentType || "?"}, ${buffer.length} B)`)
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  fs.writeFileSync(tmpPath, buffer)
  fs.renameSync(tmpPath, filePath)
  return buffer.length
}

async function runDownload() {
  const manifest = readManifest()
  const jobs = []

  for (const [slug, urls] of Object.entries(manifest)) {
    urls.forEach((url, index) => {
      const relative = localPathFor(slug, index, url)
      const filePath = path.join(ROOT, "public", relative.replace(/^\//, ""))
      jobs.push({ slug, url, filePath, relative })
    })
  }

  let downloaded = 0
  let skipped = 0
  const failures = []

  const queue = [...jobs]
  const workers = Array.from({ length: 4 }, async () => {
    for (;;) {
      const job = queue.shift()
      if (!job) return

      if (fs.existsSync(job.filePath) && fs.statSync(job.filePath).size > 0) {
        skipped += 1
        continue
      }

      try {
        const bytes = await downloadOne(job.url, job.filePath)
        downloaded += 1
        console.log(`  OK  ${job.relative} (${Math.round(bytes / 1024)} kB)`)
      } catch (error) {
        failures.push(job)
        console.warn(`  FAIL ${job.relative} <- ${job.url} (${error.message})`)
      }
    }
  })

  await Promise.all(workers)

  console.log(
    `fetch-model-images: pobrano ${downloaded}, pominięto (już są) ${skipped}, błędy ${failures.length} / łącznie ${jobs.length}`
  )
  if (failures.length > 0) {
    console.warn(
      "fetch-model-images: brakujące pliki będą serwowane ze zdalnych URL-i (fallback); ponowna próba przy kolejnym buildzie."
    )
  }
}

// Klasyfikacja zdjęcia na galerię zewnętrzną/wnętrza po nazwie pliku źródłowego.
const INTERIOR_PATTERN =
  /interior|inboard-overview|cabin|salon|saloon|galley|berth|bathroom|heads?[-_.]|toilet|-wc[-_.]|below[-_]?deck|-btd|wheelhouse|helm|dash|cockpit-overview|drivers|seat|bench|fridge|table|vip|master|sunbed|kuchnia|kabina|wnetrze/i

function kindFor(url) {
  return INTERIOR_PATTERN.test(decodeURIComponent(url)) ? "interior" : "exterior"
}

function runEmit() {
  const manifest = readManifest()
  const entries = Object.entries(manifest)
    .filter(([, urls]) => urls.length > 0)
    .map(([slug, urls]) => {
      const images = urls.map((url, index) => ({
        local: localPathFor(slug, index, url),
        source: url,
        kind: kindFor(url),
      }))
      return `  ${JSON.stringify(slug)}: ${JSON.stringify(images, null, 4).replace(/\n/g, "\n  ")}`
    })

  const content = `// WYGENEROWANE przez scripts/fetch-model-images.mjs --emit — nie edytować ręcznie.
// Źródło prawdy: scripts/model-image-manifest.json. Po zmianie manifestu uruchom:
//   node scripts/fetch-model-images.mjs --emit
// Pliki lokalne pobiera przy buildzie scripts/fetch-model-images.mjs (patrz "build" w package.json).

export type LocalGalleryImage = {
  local: string
  source: string
  kind: "exterior" | "interior"
}

export const LOCAL_GALLERIES: Record<string, LocalGalleryImage[]> = {
${entries.join(",\n")}
}
`

  fs.writeFileSync(DATA_PATH, content)
  console.log(`fetch-model-images: zapisano ${DATA_PATH}`)
}

async function runDiscover(pageUrl) {
  const response = await fetch(pageUrl, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  })
  const html = await response.text()
  const found = new Set()

  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/gi,
    /<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi,
    /(?:srcset|data-srcset)=["']([^"']+)["']/gi,
    /(?:href|content)=["']([^"']+\.(?:jpe?g|png|webp|avif))(?:\?[^"']*)?["']/gi,
  ]

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      for (const part of match[1].split(",")) {
        const candidate = part.trim().split(/\s+/)[0]
        if (!candidate) continue
        try {
          const absolute = new URL(candidate, pageUrl).toString()
          const pathname = new URL(absolute).pathname.toLowerCase()
          if (IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
            found.add(absolute)
          }
        } catch {
          // pomijamy niepoprawne URL-e
        }
      }
    }
  }

  if (found.size === 0) {
    console.log("Nie znaleziono URL-i zdjęć (strona może budować galerię JavaScriptem).")
    return
  }

  console.log(`Znalezione zdjęcia na ${pageUrl}:`)
  for (const url of found) console.log(url)
}

const args = process.argv.slice(2)

try {
  if (args[0] === "--emit") {
    runEmit()
  } else if (args[0] === "--discover") {
    if (!args[1]) {
      console.error("Użycie: node scripts/fetch-model-images.mjs --discover <url>")
      process.exit(1)
    }
    await runDiscover(args[1])
  } else {
    await runDownload()
  }
} catch (error) {
  console.warn(`fetch-model-images: błąd (${error.message}) — build kontynuowany.`)
}
