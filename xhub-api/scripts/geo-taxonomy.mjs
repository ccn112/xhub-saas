// Shared XHub Geo taxonomy — single source of truth used by BOTH
// geo-taxonomy-seed.mjs (populates ExternalCategoryMapping) and
// geo-hapulico-ingest.mjs (assigns Place.primaryCategoryId at normalize time),
// so the two never drift apart. Fixed groups per
// docs/XHUB_GEO_PROJECT_PROVIDER_MASTER_HANDOFF_20260808.md §5 — the app must
// depend on these codes, never on a source's raw OSM/Overture category id.
export const XHUB_CATEGORIES = [
  'food_drink',
  'grocery',
  'supermarket_market',
  'education',
  'healthcare',
  'pharmacy',
  'beauty_hair',
  'laundry',
  'home_cleaning',
  'home_repair',
  'sports_fitness',
  'kids_childcare',
  'pets',
  'vehicle_services',
  'ev_charging_fuel',
  'bank_atm',
  'logistics_delivery',
  'shopping',
  'entertainment',
  'public_service',
  'real_estate_service',
];

// OSM tag `key=value` -> xhub category code. Not exhaustive — extend as new
// tag values show up in ingestion logs (see UNMAPPED_CATEGORY DataQualityIssue
// rows written by geo-hapulico-ingest.mjs for anything not covered here).
export const OSM_TAG_TO_XHUB_CATEGORY = {
  'amenity=restaurant': 'food_drink',
  'amenity=cafe': 'food_drink',
  'amenity=fast_food': 'food_drink',
  'amenity=bar': 'food_drink',
  'amenity=pub': 'food_drink',
  'shop=convenience': 'grocery',
  'shop=grocery': 'grocery',
  'shop=greengrocer': 'grocery',
  'shop=supermarket': 'supermarket_market',
  'shop=mall': 'shopping',
  'shop=department_store': 'shopping',
  'shop=clothes': 'shopping',
  'shop=shoes': 'shopping',
  'shop=electronics': 'shopping',
  'shop=mobile_phone': 'shopping',
  'shop=books': 'shopping',
  'shop=hairdresser': 'beauty_hair',
  'shop=beauty': 'beauty_hair',
  'shop=laundry': 'laundry',
  'shop=dry_cleaning': 'laundry',
  'shop=pet': 'pets',
  'shop=car_repair': 'vehicle_services',
  'shop=bicycle': 'vehicle_services',
  'shop=car': 'vehicle_services',
  'amenity=school': 'education',
  'amenity=kindergarten': 'kids_childcare',
  'amenity=university': 'education',
  'amenity=college': 'education',
  'amenity=language_school': 'education',
  'amenity=hospital': 'healthcare',
  'amenity=clinic': 'healthcare',
  'amenity=doctors': 'healthcare',
  'amenity=dentist': 'healthcare',
  'amenity=pharmacy': 'pharmacy',
  'healthcare=pharmacy': 'pharmacy',
  'amenity=veterinary': 'pets',
  'leisure=fitness_centre': 'sports_fitness',
  'leisure=sports_centre': 'sports_fitness',
  'leisure=swimming_pool': 'sports_fitness',
  'sport=fitness': 'sports_fitness',
  'amenity=bank': 'bank_atm',
  'amenity=atm': 'bank_atm',
  'amenity=fuel': 'ev_charging_fuel',
  'amenity=charging_station': 'ev_charging_fuel',
  'amenity=post_office': 'logistics_delivery',
  'shop=car_repair;service=delivery': 'logistics_delivery',
  'office=logistics': 'logistics_delivery',
  'amenity=cinema': 'entertainment',
  'leisure=park': 'entertainment',
  'amenity=theatre': 'entertainment',
  'office=government': 'public_service',
  'amenity=townhall': 'public_service',
  'amenity=police': 'public_service',
  'office=estate_agent': 'real_estate_service',
  'shop=estate_agent': 'real_estate_service',
  'craft=handyman': 'home_repair',
  'shop=hardware': 'home_repair',
  'shop=doityourself': 'home_repair',
};

/// Given an OSM tags object, return the first matching xhub category code, or
/// null (caller should log a DataQualityIssue for anything unmapped).
export function mapOsmTagsToXhubCategory(tags) {
  if (!tags) return null;
  for (const [key, value] of Object.entries(tags)) {
    const code = OSM_TAG_TO_XHUB_CATEGORY[`${key}=${value}`];
    if (code) return code;
  }
  return null;
}
