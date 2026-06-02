// utils/inferCity.ts

export function inferCityFromVenue(
  input: { lat: number; lon: number }
): 'atl' | 'nyc' | 'lisbon' | 'porto' | 'la' | 'london' {
  const lat = parseFloat(input.lat.toString());
  const lon = parseFloat(input.lon.toString());

  // 🇺🇸 Atlanta
  const isAtlanta = lat > 33 && lat < 34 && lon > -85 && lon < -84;

  // 🇺🇸 New York City
  const isNYC = lat > 40 && lat < 41 && lon > -74.5 && lon < -73;

  // 🇺🇸 Los Angeles
  const isLA =
    lat > 33.7 && lat < 34.4 &&
    lon > -118.7 && lon < -118.0;

  // 🇬🇧 London
  const isLondon =
    lat > 51.28 && lat < 51.70 &&
    lon > -0.55 && lon < 0.25;

  // 🇵🇹 Lisbon
  const isLisbon =
    lat > 38.65 && lat < 38.82 &&
    lon > -9.30 && lon < -9.00;

  // 🇵🇹 Porto
  const isPorto =
    lat > 41.05 && lat < 41.30 &&
    lon > -8.80 && lon < -8.45;

  if (isAtlanta) return 'atl';
  if (isNYC) return 'nyc';
  if (isLA) return 'la';
  if (isLondon) return 'london';
  if (isLisbon) return 'lisbon';
  if (isPorto) return 'porto';

  throw new Error('Unable to infer city from coordinates.');
}