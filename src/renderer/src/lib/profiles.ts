/*
  This file provides helper functions for getting the currently authenticated user's profile from the database.

  It bridges Supabase authentication with app-specific user data stored in the "profiles" table. 
  This file allows the app to access additional user information such as role and account metadata.
*/

import { supabase } from './supabase'

export type Profile = {
  id: string
  first_name: string
  last_name: string
  email: string
  role: 'student' | 'instructor'
  created_at: string
}

// Retrieves the current authenticated user's profile from the database
async function getProfile(): Promise<Profile | null> {
  // Get the current authenticated user from Supabase
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }

  // If no user logged in, no profile can be fetched obviously
  if (!user) {
    return null
  }

  // Query the "profiles" table using the user's ID
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, created_at')
    .eq('id', user.id)
    .single()

  if (error) {
    throw error
  }

  // Return the profile data
  return data as Profile // We cast because Supabase returns a generic type
}

export { getProfile }
