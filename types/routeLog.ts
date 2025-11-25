export type LatLng = { lat: number; lng: number };

export interface RouteLog {
  userId: string;
  crawlTheme: string;
  origin: LatLng;
  destination: LatLng;
  waypoints: LatLng[];
  routeDuration: number;
  routeDistance: number;
  routeGeometry: [number, number][]; // lng, lat
  routeMetadata?: Record<string, any>;
}
