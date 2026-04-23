export type ResourceType =
  | "food"
  | "shelter"
  | "health"
  | "immigration"
  | "family"
  | "benefits";

export type CostTier = "free" | "sliding scale";

export interface ResourceRecord {
  id: string;
  type: ResourceType;
  name: string;
  location: { lat: number; lon: number };
  address: string;
  hours: string;
  languages: string[];
  eligibility: string;
  services: string[];
  cost: CostTier | string;
  walk_in: boolean;
  appointment_required: boolean;
  age_range: string | null;
  source?: string;
  sourceUrl?: string;
}

export interface ResourcesFile {
  meta: {
    disclaimer: string;
    immigration_disclaimer: string;
    data_policy: string;
    last_reviewed: string;
  };
  resources: ResourceRecord[];
}
