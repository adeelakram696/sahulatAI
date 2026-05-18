import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { searchNearbyServices } from '@/lib/antigravity/tools/google-places'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // We can allow anonymous users or require authentication based on requirements.
    // For this hackathon, let's assume we proceed if user is logged in.
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, userLocation } = await req.json()

    // userLocation should be passed from the frontend (the selected location)
    // Example: { lat: 33.6844, lng: 73.0479 }
    let defaultLocation = userLocation
    
    // If not provided, fetch default location from DB
    if (!defaultLocation) {
      const { data: profile } = await supabase
        .from('users_profile')
        .select('default_location_id')
        .eq('user_id', user.id)
        .single()

      if (profile?.default_location_id) {
        const { data: loc } = await supabase
          .from('user_locations')
          .select('location')
          .eq('id', profile.default_location_id)
          .single()
        
        if (loc?.location) {
          // Parse POINT(lng lat)
          const match = loc.location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/)
          if (match) {
            defaultLocation = { lat: parseFloat(match[2]), lng: parseFloat(match[1]) }
          }
        }
      }
    }

    const systemPrompt = `
      You are SahuliatAI, a friendly and helpful conversational assistant designed to help users find nearby services (like plumbers, electricians, AC repair, tutors, etc).
      Your goal is to understand the user's issue first. DO NOT just immediately call a search tool unless you clearly understand what the user needs.
      Ask clarifying questions if the request is vague (e.g., if they say "my pipe is leaking", ask them if it's an indoor plumbing issue, and if they'd like a plumber).
      
      Once you understand the need, use the searchNearbyServices tool to find providers near them.
      The user's current coordinates are: ${defaultLocation ? `Latitude: ${defaultLocation.lat}, Longitude: ${defaultLocation.lng}` : 'Unknown (ask the user to provide their location in their profile)'}.
      If their coordinates are unknown, politely inform them they need to set up a location in their profile first.

      When presenting providers to the user:
      1. Be concise.
      2. Mention the provider's name, rating, and address.
      3. Ask if they would like to proceed with booking any of them.
    `

    const result = streamText({
      model: google('gemini-1.5-pro-latest'),
      system: systemPrompt,
      messages,
      tools: {
        searchNearbyServices
      },
    })

    return result.toDataStreamResponse()
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
