declare module 'leaflet-extra-markers' {
  import * as L from 'leaflet'

  /**
   * Modern (v2+) ExtraMarkers API
   * ---------------------------------------------------
   * This version uses SVG-based markers with:
   * - content (HTML)
   * - color/accentColor
   * - contentColor
   * - scale
   * - svg override
   */

  export interface ExtraMarkerOptions {
    /** HTML content inside the marker */
    content?: string

    /** Fill color of the marker */
    color?: string

    /** Accent / outline color */
    accentColor?: string

    /** Color of the content (e.g., icon text) */
    contentColor?: string

    /** Size multiplier */
    scale?: number

    /** Provide your own custom SVG */
    svg?: string

    /** Extra CSS classes */
    extraClasses?: string
  }

  export class Icon extends L.Icon {
    constructor(options?: ExtraMarkerOptions)
  }

  export default Icon
}
