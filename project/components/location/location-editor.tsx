'use client'

import { useState } from 'react'
import DraggablePinMap from '@/components/map/draggable-pin-map'
import { useRouter } from 'next/navigation'

interface LocationEditorProps {
  onSave?: () => void
  isFirstLocation?: boolean
}

export default function LocationEditor({ onSave, isFirstLocation = false }: LocationEditorProps) {
  const router = useRouter()
  // Default to somewhere in Islamabad as a placeholder
  const [lat, setLat] = useState(33.6844)
  const [lng, setLng] = useState(73.0479)
  const [label, setLabel] = useState('Home')
  const [address, setAddress] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser")
      return
    }
    
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude)
        setLng(position.coords.longitude)
        setIsLocating(false)
      },
      (error) => {
        console.error("Error getting location:", error)
        alert("Unable to retrieve your location")
        setIsLocating(false)
      }
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, label, address, is_default: isFirstLocation })
      })

      if (!response.ok) {
        throw new Error('Failed to save location')
      }

      if (onSave) {
        onSave()
      } else {
        router.push('/chat')
      }
    } catch (error) {
      console.error(error)
      // Show error toast
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Label</label>
        <select 
          value={label} 
          onChange={(e) => setLabel(e.target.value)}
          className="w-full p-2 border rounded-md bg-background"
        >
          <option value="Home">Home</option>
          <option value="Work">Work</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Address</label>
        <input 
          type="text" 
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Start typing your address..."
          className="w-full p-2 border rounded-md"
          required
        />
        <p className="text-xs text-muted-foreground">Or drag the pin to fine-tune</p>
      </div>

      <div className="flex flex-col space-y-2">
        <label className="text-sm font-medium">Pinpoint on Map</label>
        <button 
          type="button" 
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="flex items-center justify-center p-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50"
        >
          {isLocating ? 'Locating...' : 'Use My Current GPS Location'}
        </button>
      </div>

      <DraggablePinMap 
        initialLat={lat} 
        initialLng={lng} 
        onLocationChange={(newLat, newLng) => {
          setLat(newLat)
          setLng(newLng)
          // In a real app, we'd trigger reverse geocoding here
        }} 
      />

      <button 
        type="submit" 
        disabled={isLoading}
        className="w-full p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : 'Save Location'}
      </button>
    </form>
  )
}
