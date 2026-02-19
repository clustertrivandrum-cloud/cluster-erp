import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkLocations() {
    console.log('Checking locations...')
    const { data: locations, error } = await supabase.from('locations').select('*')

    if (error) {
        console.error('Error fetching locations:', error)
        return
    }

    console.log('Current Locations:', locations)

    if (locations.length === 0) {
        console.log('No locations found. Creating default location...')
        const { data: newLocation, error: createError } = await supabase
            .from('locations')
            .insert({ name: 'Main Warehouse', is_active: true })
            .select()
            .single()

        if (createError) console.error('Error creating default location:', createError)
        else console.log('Created default location:', newLocation)
    }
}

checkLocations()
