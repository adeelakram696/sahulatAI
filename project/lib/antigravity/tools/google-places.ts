import { tool } from 'ai'
import { z } from 'zod'

export const searchNearbyServices = tool({
  description: 'Search for nearby service providers (e.g., plumbers, electricians, tutors, AC repair) using Google Places API.',
  parameters: z.object({
    keyword: z.string().describe('The type of service provider to search for (e.g., "plumber", "AC repair", "tutor").'),
    latitude: z.number().describe('The latitude of the user making the request.'),
    longitude: z.number().describe('The longitude of the user making the request.'),
    radius: z.number().optional().default(5000).describe('Search radius in meters. Default is 5000 (5km).')
  }),
  execute: async ({ keyword, latitude, longitude, radius }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      throw new Error('Google Places API key is not configured.')
    }

    try {
      // Use the Google Places Text Search or Nearby Search API
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?keyword=${encodeURIComponent(keyword)}&location=${latitude},${longitude}&radius=${radius}&key=${apiKey}`
      
      const response = await fetch(url)
      const data = await response.json()

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places API Error:', data.status, data.error_message)
        return { error: `Failed to fetch places: ${data.status}` }
      }

      // Map the results to a simplified format for the AI to read
      const results = (data.results || []).slice(0, 5).map((place: any) => ({
        name: place.name,
        address: place.vicinity,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        place_id: place.place_id,
        location: place.geometry?.location
      }))

      return {
        message: results.length > 0 ? `Found ${results.length} nearby providers.` : 'No providers found nearby for this service.',
        providers: results
      }
    } catch (error: any) {
      console.error('Error fetching from Google Places:', error)
      return { error: error.message }
    }
  }
})
