export type Product = {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  price: number | null
  sku: string | null
  created_at: string
}

export type SimilarItem = {
  product_id: string
  score: number
}

export type ContentRecommendationResponse = {
  source_product_id: string
  items: SimilarItem[]
}

export type CollaborativeItem = {
  product_id: string
  estimated_rating: number
}

export type CollaborativeRecommendationResponse = {
  user_id: string
  items: CollaborativeItem[]
}

export type HybridItem = {
  product_id: string
  hybrid_score: number
  collaborative_norm: number
  content_similarity: number
  estimated_rating: number
}

export type HybridRecommendationResponse = {
  user_id: string
  weight_collaborative: number
  weight_content: number
  items: HybridItem[]
}

export type PrecisionAtKReport = {
  k: number
  users_evaluated: number
  mean_precision_at_k: number
  detail: string
}
