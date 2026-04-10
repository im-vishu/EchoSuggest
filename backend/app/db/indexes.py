from motor.motor_asyncio import AsyncIOMotorDatabase


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.products.create_index("category")
    await db.products.create_index("created_at")
    await db.interactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.interactions.create_index("product_id")
    await db.interactions.create_index("event_type")
