/* eslint-disable react-refresh/only-export-components */
/**
 * AuthContext.tsx
 *
 * Description:
 * This file defines the authentication context used throughout
 * the BatchGrade application. The context provides a centralized
 * mechanism for managing and accessing user authentication state.
 *
 * The AuthContext allows any component within the application
 * to determine whether a user is currently logged in and access
 * basic user information such as email and role (student or
 * instructor).
 *
 * The file exports:
 *  - AuthProvider
 *      a React context provider that stores and manages the
 *      authentication state of the application
 *  - useAuth
 *      a custom hook that allows components to access authentication
 *      data and functions without directly interacting with the
 *      underlying React context API.
 *
 * Responsibilities:
 *  • Track login status
 *  • Store authenticated user information
 *  • Provide login and logout functionality
 *  • Make authentication state globally accessible
 *
 * This provider must wrap the application's routing structure
 * (see App.tsx) to ensure all pages have access to authentication
 * state.
 */
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'

import type { User as SupabaseUser } from '@supabase/supabase-js'
import { VALID_ROLES } from '../../../shared/types'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/profiles'

type AuthUser = {
  uuid: string
  email: string
  role: (typeof VALID_ROLES)[number]
}

type SignupResult = {
  user: AuthUser | null
  hasSession: boolean
}

// Defines the structure of the authentication context.
// This ensures all consumers of the context know exactly what data and functions exists
interface AuthContextType {
  isLoggedIn: boolean // Indicates whether a user is currently authenticated
  isAuthLoading: boolean // Indicates whether authentication state is still being restored
  user: AuthUser | null // Stores information about the logged-in user
  login: (email: string, password: string) => Promise<AuthUser> // Function used to authenticate a user
  signup: (
    email: string,
    password: string,
    role: (typeof VALID_ROLES)[number]
  ) => Promise<SignupResult>
  logout: () => Promise<void> // Function used to terminate the user's session
  refreshProfile: () => Promise<AuthUser | null>
}

// Create the authentication context.
// Initially undefined so we can detect if it is used outside of provider
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Custom hook used to access the authentication context.
// This prevents components from needing to call useContext() directly.
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  // safely check to ensure the hook is only used within an AuthProvider
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Defines the properties accepted by the AuthProvider
// 'children' refers to any nested components wrapped by the provider
interface AuthProviderProps {
  children: ReactNode
}

// AuthProvider component that supplies authentication state and authentication functions to all 'child' components.
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false) // tracks whether a user is currently logged in
  const [isAuthLoading, setIsAuthLoading] = useState(true) // tracks whether authentication state is still being initialized
  const [user, setUser] = useState<AuthUser | null>(null) // stores the current user's email and role (or null if no user is logged in)

  // Ensures the user role is always one of the allowed roles.
  const toRole = (candidate: unknown): (typeof VALID_ROLES)[number] | null => {
    if (VALID_ROLES.includes(candidate as (typeof VALID_ROLES)[number])) {
      return candidate as (typeof VALID_ROLES)[number]
    }

    return null
  }

  // Maps the Supabase user object into smaller AuthUser shape used by the app context
  const mapSupabaseUser = (userRecord: SupabaseUser | null): AuthUser | null => {
    if (!userRecord?.email) {
      return null
    }

    const roleCandidate = userRecord?.app_metadata?.role ?? userRecord?.user_metadata?.role
    const role = toRole(roleCandidate)

    if (!role) {
      return null
    }

    return {
      uuid: userRecord?.id,
      email: userRecord?.email,
      role
    }
  }

  // Refreshes the user's profile from the database, so we always have the latest role and metadata.
  const refreshProfile = async (): Promise<AuthUser | null> => {
    const {
      data: { user: authUser },
      error
    } = await supabase.auth.getUser()

    if (error) {
      throw error
    }

    if (!authUser) {
      setUser(null)
      setIsLoggedIn(false)
      return null
    }

    try {
      const profile = await getProfile()
      const role = toRole(profile?.role)

      if (!role) {
        setUser(null)
        setIsLoggedIn(false)
        return null
      }

      const nextUser: AuthUser = {
        uuid: authUser.id,
        email: authUser.email ?? profile?.email ?? '',
        role
      }

      setUser(nextUser)
      setIsLoggedIn(true)
      return nextUser
    } catch {
      // Fallback if profile table fails
      const fallbackUser = mapSupabaseUser(authUser)
      setUser(fallbackUser)
      setIsLoggedIn(Boolean(fallbackUser))
      return fallbackUser
    }
  }

  // Restores any existing Supabase session when the app first loads and subscribes to future authentication state changes
  useEffect(() => {
    let isMounted = true

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!isMounted) {
          return
        }
        if (error) {
          console.error('Error restoring auth session: ', error)
        }

        if (data.session?.user) {
          await refreshProfile()
        } else {
          setUser(null)
          setIsLoggedIn(false)
        }

        setIsAuthLoading(false)
      })
      .catch((error) => {
        if (isMounted) {
          console.error('Error restoring auth session: ', error)
          setIsAuthLoading(false)
        }
      })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        if (!isMounted) {
          return
        }

        if (session?.user) {
          void refreshProfile()
            .catch((error) => {
              if (isMounted) {
                console.error('Error refreshing auth session: ', error)
              }
            })
            .finally(() => {
              if (isMounted) {
                setIsAuthLoading(false)
              }
            })
          return
        }

        setUser(null)
        setIsLoggedIn(false)
        setIsAuthLoading(false)
      }, 0)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Handles user login with Supabase then refreshes the user's profile to update authentication state and user information
  const login = async (email: string, password: string): Promise<AuthUser> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw error
    }

    const loggedInUser = await refreshProfile()
    if (!loggedInUser) {
      throw new Error('Signed in, but no usable user profile was returned.')
    }
    return loggedInUser
  }

  // Handles user signup with Supabase authentication.
  // This returns as soon as auth confirms the user record was created so the UI
  // can show a stable success state without waiting on profile restoration.
  const signup = async (
    email: string,
    password: string,
    role: (typeof VALID_ROLES)[number]
  ): Promise<SignupResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role
        }
      }
    })

    if (error) {
      throw error
    }

    if (!data.user) {
      return { user: null, hasSession: false }
    }

    return {
      user: mapSupabaseUser(data.user) ?? {
        uuid: data.user.id,
        email: data.user.email ?? '',
        role
      },
      hasSession: Boolean(data.session)
    }
  }

  // handles user logout by clearing the Supabase session and removing stored user information
  const logout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    setIsLoggedIn(false)
    setUser(null)
  }

  // provides authentication state and functions to any component wrapped inside this provider
  return (
    <AuthContext.Provider
      value={{ isLoggedIn, isAuthLoading, user, login, signup, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
