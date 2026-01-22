// utils/inferCity.ts

export function inferCityFromVenue(input: { lat: number; lon: number }): 'atl' | 'nyc' {
  const lat = parseFloat(input.lat.toString());
  const lon = parseFloat(input.lon.toString());

  const isAtlanta = lat > 33 && lat < 34 && lon > -85 && lon < -84;
  const isNYC = lat > 40 && lat < 41 && lon > -74.5 && lon < -73;

  if (isAtlanta) return 'atl';
  if (isNYC) return 'nyc';

  throw new Error('Unable to infer city from coordinates.');
}
