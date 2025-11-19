declare module 'leaflet-extra-markers' {
  import * as L from 'leaflet'

  const ExtraMarkers: (options: L.IconOptions & {
    icon?: string
    markerColor?: string
    shape?: 'circle' | 'square' | 'star' | 'penta' | 'diamond'
    prefix?: string
    iconColor?: string
  }) => L.Icon

  export default ExtraMarkers
}
