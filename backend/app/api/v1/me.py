from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.api.deps import CurrentUser, get_database
from app.schemas.product import ProductOut
from app.schemas.saved import SavedItemOut, SavedListResponse, SavedProductBody
from app.services.saved_products import (
    add_saved,
    list_saved,
    parse_user_oid,
    remove_saved,
)

router = APIRouter(prefix="/me", tags=["me"])

Db = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


def _product_doc_to_out(doc: dict) -> ProductOut:
    return ProductOut(
        id=str(doc["_id"]),
        title=doc["title"],
        description=doc.get("description", ""),
        category=doc.get("category", ""),
        tags=list(doc.get("tags") or []),
        price=doc.get("price"),
        sku=doc.get("sku"),
        created_at=doc["created_at"],
    )


@router.get("/saved", response_model=SavedListResponse)
async def list_my_saved(
    user: CurrentUser,
    db: Db,
    skip: int = Query(0, ge=0, le=100_000),
    limit: int = Query(50, ge=1, le=200),
    expand: bool = Query(
        False,
        description="Include full product documents in order of saved items",
    ),
) -> SavedListResponse:
    uid = parse_user_oid(user)
    rows = await list_saved(db, uid, skip=skip, limit=limit)
    items = [
        SavedItemOut(product_id=r["product_id"], created_at=r["created_at"])
        for r in rows
    ]
    products: list[ProductOut] = []
    if expand and items:
        ids = [i.product_id for i in items]
        cursor = db.products.find({"_id": {"$in": ids}})
        by_id = {str(d["_id"]): d for d in await cursor.to_list(length=len(ids))}
        products = []
        for i in items:
            doc = by_id.get(i.product_id)
            if doc:
                products.append(_product_doc_to_out(doc))
    return SavedListResponse(items=items, products=products)


@router.post(
    "/saved",
    response_model=SavedItemOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_product(
    body: SavedProductBody,
    user: CurrentUser,
    db: Db,
) -> SavedItemOut:
    uid = parse_user_oid(user)
    try:
        doc = await add_saved(db, uid, body.product_id)
    except DuplicateKeyError:
        doc = await db.user_saved_products.find_one(
            {"user_id": uid, "product_id": body.product_id}
        )
        if not doc:
            raise HTTPException(status_code=500, detail="Save failed") from None
    return SavedItemOut(product_id=doc["product_id"], created_at=doc["created_at"])


@router.delete("/saved/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unsave_product(
    product_id: str,
    user: CurrentUser,
    db: Db,
) -> Response:
    uid = parse_user_oid(user)
    deleted = await remove_saved(db, uid, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved item not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
