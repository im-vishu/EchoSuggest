from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "echosuggest"
    redis_url: str = "redis://localhost:6380/0"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    recommend_cache_ttl_seconds: int = 300
    precompute_ttl_seconds: int = 3600
    # 0 = disabled; otherwise sleep N seconds between precompute runs (background)
    precompute_schedule_seconds: int = 0
    # If set, POST /jobs/precompute requires header X-API-Key matching this value
    admin_api_key: str | None = None

    jwt_secret: str = "dev-change-me-use-long-random-string-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 10080  # 7 days

    @property
    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


settings = Settings()
