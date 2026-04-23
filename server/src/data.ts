import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ResourcesFile } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type BenefitsFile = Record<string, Record<string, Record<string, string>>>;

let resourcesPromise: Promise<ResourcesFile> | null = null;
let benefitsPromise: Promise<BenefitsFile> | null = null;

async function readResourcesFromDisk(): Promise<ResourcesFile> {
  const p = path.resolve(__dirname, "../../data/resources.json");
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw) as ResourcesFile;
}

async function readBenefitsFromDisk(): Promise<BenefitsFile> {
  const p = path.resolve(__dirname, "../../data/benefits-content.json");
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw) as BenefitsFile;
}

/** Cached read — disk is hit at most once per process lifetime. */
export function loadResources(): Promise<ResourcesFile> {
  resourcesPromise ??= readResourcesFromDisk();
  return resourcesPromise;
}

export function loadBenefitsContent(): Promise<BenefitsFile> {
  benefitsPromise ??= readBenefitsFromDisk();
  return benefitsPromise;
}

/** Warm caches at startup so the first tool call is not slower than later ones. */
export async function preloadData(): Promise<void> {
  await Promise.all([loadResources(), loadBenefitsContent()]);
}
