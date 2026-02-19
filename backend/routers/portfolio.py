from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from services.portfolio_service import portfolio_service
from services.stock_service import stock_service
from services.auth_service import get_current_user
from database import get_db
from models import User

router = APIRouter()


class AddHoldingRequest(BaseModel):
    symbol: str
    shares: float
    buy_price: float
    buy_date: Optional[str] = ""


class UpdateHoldingRequest(BaseModel):
    shares: Optional[float] = None
    buy_price: Optional[float] = None


class WatchlistRequest(BaseModel):
    symbol: str
    alert_above: Optional[float] = None
    alert_below: Optional[float] = None


# ── Portfolio ──────────────────────────────────────────────

@router.get("/portfolio")
async def get_portfolio(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get portfolio with live pricing (authenticated)"""
    holdings = portfolio_service.get_holdings(db, user.id)

    enriched = []
    total_value = 0
    total_cost = 0

    for h in holdings:
        try:
            data = stock_service.get_stock_data(h.symbol, period="5d")
            current_price = data["current_price"] if data else 0
            name = data["name"] if data else h.symbol
            change_pct = data["change_percent"] if data else 0
        except Exception:
            current_price = 0
            name = h.symbol
            change_pct = 0

        cost_basis = h.shares * h.buy_price
        market_value = h.shares * current_price
        pnl = market_value - cost_basis
        pnl_pct = (pnl / cost_basis * 100) if cost_basis else 0

        total_value += market_value
        total_cost += cost_basis

        enriched.append({
            "id": h.id,
            "symbol": h.symbol,
            "shares": h.shares,
            "buy_price": h.buy_price,
            "buy_date": h.buy_date,
            "name": name,
            "current_price": current_price,
            "market_value": round(market_value, 2),
            "cost_basis": round(cost_basis, 2),
            "pnl": round(pnl, 2),
            "pnl_percent": round(pnl_pct, 2),
            "day_change_percent": change_pct,
        })

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost else 0

    return {
        "holdings": enriched,
        "summary": {
            "total_value": round(total_value, 2),
            "total_cost": round(total_cost, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_percent": round(total_pnl_pct, 2),
            "num_holdings": len(enriched),
        },
    }


@router.post("/portfolio/add")
async def add_holding(
    req: AddHoldingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    holding = portfolio_service.add_holding(db, user.id, req.symbol, req.shares, req.buy_price, req.buy_date)
    return {
        "status": "ok",
        "holding": {
            "id": holding.id,
            "symbol": holding.symbol,
            "shares": holding.shares,
            "buy_price": holding.buy_price,
            "buy_date": holding.buy_date,
        },
    }


@router.delete("/portfolio/{holding_id}")
async def remove_holding(
    holding_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = portfolio_service.remove_holding(db, user.id, holding_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"status": "ok"}


@router.put("/portfolio/{holding_id}")
async def update_holding(
    holding_id: int,
    req: UpdateHoldingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    h = portfolio_service.update_holding(db, user.id, holding_id, req.shares, req.buy_price)
    if not h:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {
        "status": "ok",
        "holding": {
            "id": h.id,
            "symbol": h.symbol,
            "shares": h.shares,
            "buy_price": h.buy_price,
        },
    }


# ── Watchlist ──────────────────────────────────────────────

@router.get("/watchlist")
async def get_watchlist(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get watchlist with live prices (authenticated)"""
    items = portfolio_service.get_watchlist(db, user.id)
    enriched = []
    for item in items:
        try:
            data = stock_service.get_stock_data(item.symbol, period="5d")
            if data:
                enriched.append({
                    "symbol": item.symbol,
                    "alert_above": item.alert_above,
                    "alert_below": item.alert_below,
                    "added_at": item.created_at.isoformat() if item.created_at else "",
                    "name": data["name"],
                    "current_price": data["current_price"],
                    "change": data["change"],
                    "change_percent": data["change_percent"],
                    "market_cap": data.get("market_cap", 0),
                    "pe_ratio": data.get("pe_ratio"),
                    "alert_triggered": (
                        (item.alert_above and data["current_price"] and data["current_price"] >= item.alert_above)
                        or (item.alert_below and data["current_price"] and data["current_price"] <= item.alert_below)
                    ),
                })
        except Exception:
            enriched.append({
                "symbol": item.symbol,
                "alert_above": item.alert_above,
                "alert_below": item.alert_below,
            })
    return {"watchlist": enriched}


@router.post("/watchlist")
async def add_to_watchlist(
    req: WatchlistRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = portfolio_service.add_to_watchlist(db, user.id, req.symbol, req.alert_above, req.alert_below)
    return {
        "status": "ok",
        "entry": {
            "symbol": entry.symbol,
            "alert_above": entry.alert_above,
            "alert_below": entry.alert_below,
        },
    }


@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(
    symbol: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    portfolio_service.remove_from_watchlist(db, user.id, symbol)
    return {"status": "ok"}
