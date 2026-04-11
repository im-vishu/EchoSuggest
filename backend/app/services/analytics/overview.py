from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.analytics import AnalyticsOverviewResponse, SourceMetrics


async def analytics_overview(
    db: AsyncIOMotorDatabase, days: int = 7
) -> AnalyticsOverviewResponse:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {
            "$group": {
                "_id": {"source": "$source", "event_type": "$event_type"},
                "n": {"$sum": 1},
            }
        },
    ]
    rows = await db.analytics_events.aggregate(pipeline).to_list(length=500)
    by_source: dict[str, dict[str, int]] = {}
    for r in rows:
        src = r["_id"]["source"]
        et = r["_id"]["event_type"]
        by_source.setdefault(src, {})[et] = int(r["n"])

    sources: list[SourceMetrics] = []
    total_imp = 0
    total_clk = 0
    for src in sorted(by_source.keys()):
        imp = by_source[src].get("impression", 0)
        clk = by_source[src].get("click", 0)
        total_imp += imp
        total_clk += clk
        ctr = clk / imp if imp else 0.0
        sources.append(
            SourceMetrics(source=src, impressions=imp, clicks=clk, ctr=round(ctr, 4))
        )

    return AnalyticsOverviewResponse(
        days=days,
        since=since,
        sources=sources,
        total_impressions=total_imp,
        total_clicks=total_clk,
    )
