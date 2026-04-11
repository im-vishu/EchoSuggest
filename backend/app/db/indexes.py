from motor.motor_asyncio import AsyncIOMotorDatabase


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.products.create_index("category")
    await db.products.create_index("created_at")
    await db.interactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.interactions.create_index("product_id")
    await db.interactions.create_index("event_type")
    await db.analytics_events.create_index("created_at")
    await db.analytics_events.create_index([("source", 1), ("created_at", -1)])
    await db.analytics_events.create_index([("user_id", 1), ("created_at", -1)])
    await db.users.create_index("email", unique=True)
    await db.user_saved_products.create_index(
        [("user_id", 1), ("product_id", 1)],
        unique=True,
    )
    await db.user_saved_products.create_index([("user_id", 1), ("created_at", -1)])
