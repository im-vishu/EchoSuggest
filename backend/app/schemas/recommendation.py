from pydantic import BaseModel, Field, field_validator


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


class HybridBatchRequest(BaseModel):
    user_ids: list[str] = Field(..., min_length=1, max_length=25)
    top_k: int = Field(10, ge=1, le=50)
    w_collaborative: float = Field(0.6, ge=0.0, le=1.0)
    w_content: float = Field(0.4, ge=0.0, le=1.0)
    max_pool: int = Field(200, ge=50, le=500)

    @field_validator("user_ids")
    @classmethod
    def strip_ids(cls, v: list[str]) -> list[str]:
        out = [u.strip() for u in v if u and u.strip()]
        if len(out) != len(v):
            raise ValueError("user_ids must be non-empty strings")
        return out


class HybridBatchResponse(BaseModel):
    results: list[HybridRecommendationResponse]


class PrecisionAtKReport(BaseModel):
    k: int
    users_evaluated: int
    mean_precision_at_k: float
    detail: str


