from pydantic import BaseModel, Field


class SimilarItem(BaseModel):
    product_id: str
    score: float = Field(..., description="Cosine similarity in [0, 1] for TF-IDF vectors")


class ContentRecommendationResponse(BaseModel):
    source_product_id: str
    items: list[SimilarItem]


class CollaborativeItem(BaseModel):
    product_id: str
    estimated_rating: float = Field(
        ...,
        description="Predicted score around 1-5 from truncated SVD reconstruction (clamped)",
    )


class CollaborativeRecommendationResponse(BaseModel):
    user_id: str
    items: list[CollaborativeItem]


class ColdStartItem(BaseModel):
    product_id: str
    score: float


class ColdStartRecommendationResponse(BaseModel):
    mode: str
    window_days: int
    items: list[ColdStartItem]


class HybridItem(BaseModel):
    product_id: str
    hybrid_score: float
    collaborative_norm: float = Field(
        ...,
        description="Min-max normalized CF estimate within the candidate pool [0,1]",
    )
    content_similarity: float = Field(
        ...,
        description="Max TF-IDF cosine vs user history (0 if no history)",
    )
    estimated_rating: float


class HybridRecommendationResponse(BaseModel):
    user_id: str
    strategy: str = "hybrid"
    weight_collaborative: float
    weight_content: float
    items: list[HybridItem]


class PrecisionAtKReport(BaseModel):
    k: int
    users_evaluated: int
    mean_precision_at_k: float
    detail: str


