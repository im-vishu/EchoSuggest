import type { Product } from './product'

export type SavedItemOut = {
  product_id: string
  created_at: string
}

export type SavedListResponse = {
  items: SavedItemOut[]
  products: Product[]
}
