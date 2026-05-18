import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { lat, lng, label, address, is_default } = body

    // We'd ideally validate this with Zod
    if (!lat || !lng || !label || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Insert into user_locations (assuming PostGIS geographic point format)
    const { data: location, error } = await supabase
      .from('user_locations')
      .insert({
        user_id: user.id,
        label,
        address,
        location: `POINT(${lng} ${lat})`
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting location:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // If it's the first location or specifically requested as default, update profile
    if (is_default) {
      await supabase
        .from('users_profile')
        .update({ default_location_id: location.id })
        .eq('user_id', user.id)
    }

    return NextResponse.json({ location })
  } catch (error) {
    console.error('Error in POST /api/locations:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
