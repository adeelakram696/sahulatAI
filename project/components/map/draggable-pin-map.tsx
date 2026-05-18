'use client'

import { useState } from 'react'
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'

interface DraggablePinMapProps {
  initialLat: number
  initialLng: number
  onLocationChange: (lat: number, lng: number) => void
}

export default function DraggablePinMap({ initialLat, initialLng, onLocationChange }: DraggablePinMapProps) {
  const [markerPosition, setMarkerPosition] = useState({ lat: initialLat, lng: initialLng })

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat()
      const lng = e.latLng.lng()
      setMarkerPosition({ lat, lng })
      onLocationChange(lat, lng)
    }
  }

  // Fallback map ID or provide one in environment
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || 'DEMO_MAP_ID'

  return (
    <div className="w-full h-[300px] rounded-md overflow-hidden border">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          defaultCenter={{ lat: initialLat, lng: initialLng }}
          defaultZoom={15}
          mapId={mapId}
          disableDefaultUI={true}
        >
          <AdvancedMarker
            position={markerPosition}
            draggable={true}
            onDragEnd={handleMarkerDragEnd}
          >
            <Pin background={'#2563eb'} borderColor={'#1e40af'} glyphColor={'#ffffff'} />
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  )
}
