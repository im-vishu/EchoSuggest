export interface UserPublic {
  id: string
  email: string
  display_name: string | null
  preferences: Record<string, unknown>
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: UserPublic
}
