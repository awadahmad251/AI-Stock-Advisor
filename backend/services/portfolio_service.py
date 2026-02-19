"""Portfolio service — SQLAlchemy database storage (per-user)"""
from sqlalchemy.orm import Session
from models import Holding, WatchlistItem
from datetime import datetime


class PortfolioService:
    # ── Portfolio CRUD ──────────────────────────────────────
    def get_holdings(self, db: Session, user_id: int):
        return db.query(Holding).filter(Holding.user_id == user_id).all()

    def add_holding(self, db: Session, user_id: int, symbol: str, shares: float,
                    buy_price: float, buy_date: str = "", notes: str = ""):
        holding = Holding(
            user_id=user_id,
            symbol=symbol.upper(),
            shares=shares,
            buy_price=buy_price,
            buy_date=buy_date or datetime.now().strftime("%Y-%m-%d"),
            notes=notes,
        )
        db.add(holding)
        db.commit()
        db.refresh(holding)
        return holding

    def remove_holding(self, db: Session, user_id: int, holding_id: int):
        h = db.query(Holding).filter(Holding.id == holding_id, Holding.user_id == user_id).first()
        if not h:
            return False
        db.delete(h)
        db.commit()
        return True

    def update_holding(self, db: Session, user_id: int, holding_id: int,
                       shares: float = None, buy_price: float = None):
        h = db.query(Holding).filter(Holding.id == holding_id, Holding.user_id == user_id).first()
        if not h:
            return None
        if shares is not None:
            h.shares = shares
        if buy_price is not None:
            h.buy_price = buy_price
        db.commit()
        db.refresh(h)
        return h

    # ── Watchlist ───────────────────────────────────────────
    def get_watchlist(self, db: Session, user_id: int):
        return db.query(WatchlistItem).filter(WatchlistItem.user_id == user_id).all()

    def add_to_watchlist(self, db: Session, user_id: int, symbol: str,
                         alert_above: float = None, alert_below: float = None):
        # Upsert — update if exists
        existing = db.query(WatchlistItem).filter(
            WatchlistItem.user_id == user_id,
            WatchlistItem.symbol == symbol.upper()
        ).first()
        if existing:
            existing.alert_above = alert_above
            existing.alert_below = alert_below
            db.commit()
            db.refresh(existing)
            return existing

        item = WatchlistItem(
            user_id=user_id,
            symbol=symbol.upper(),
            alert_above=alert_above,
            alert_below=alert_below,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def remove_from_watchlist(self, db: Session, user_id: int, symbol: str):
        item = db.query(WatchlistItem).filter(
            WatchlistItem.user_id == user_id,
            WatchlistItem.symbol == symbol.upper()
        ).first()
        if item:
            db.delete(item)
            db.commit()
            return True
        return False


portfolio_service = PortfolioService()
