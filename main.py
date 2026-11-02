import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlencode, urlsplit, urlunsplit

import httpx
from aiogram import Bot, Dispatcher
from aiogram.exceptions import TelegramRetryAfter
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from telegram_init_data import TelegramInitDataError, parse, validate

from db import database, init_database
from payments import PaymentError, create_payment, get_verified_payment

BASE_DIR = Path(__file__).resolve().parent
GAME_URL = os.getenv("GAME_URL", "https://slave-game-1.onrender.com")
GAME_URL_FILE = BASE_DIR / "game_url.txt"
REFERRER_REWARD = 25
REFERRED_PLAYER_REWARD = 10
bot_username = os.getenv("BOT_USERNAME", "").strip().lstrip("@")


def get_game_url() -> str:
    if os.getenv("GAME_URL"):
        return GAME_URL
    try:
        return GAME_URL_FILE.read_text(encoding="utf-8").strip() or GAME_URL
    except OSError:
        return GAME_URL


def game_url_with_referral(referrer_id: int | None = None) -> str:
    url = get_game_url()
    if not referrer_id:
        return url
    parts = urlsplit(url)
    query = urlencode({"ref": referrer_id})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def get_bot_token() -> str:
    token = os.getenv("BOT_TOKEN", "").strip()
    if token:
        return token
    token_file = BASE_DIR / "token.txt"
    if not token_file.exists():
        raise HTTPException(status_code=503, detail="Токен бота не настроен")
    token = token_file.read_text(encoding="utf-8").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Токен бота не настроен")
    return token


def authenticate(init_data: str):
    if not init_data:
        raise HTTPException(status_code=401, detail="Отсутствует initData")
    try:
        validate(init_data, get_bot_token())
        parsed = parse(init_data)
    except (TelegramInitDataError, ValueError) as error:
        raise HTTPException(status_code=401, detail="Недействительный initData") from error
    user = parsed.get("user")
    if user is None:
        raise HTTPException(status_code=401, detail="В initData отсутствует пользователь")
    return user


def username_for(user) -> str:
    return user.get("username") or user.get("first_name") or f"player_{user['id']}"


def player_dict(row: Any) -> dict[str, Any]:
    try:
        current_stats = json.loads(row["current_slave_stats"])
    except (TypeError, json.JSONDecodeError):
        current_stats = {}
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"] or "Игрок",
        "nickname_changes": row["nickname_changes"],
        "coins": row["coins"],
        "crystals": row["crystals"],
        "slaves_killed": row["slaves_killed"],
        "current_slave_stats": current_stats,
        "vip_status": bool(row["vip_status"]),
        "oldest_slave_age_days": row["oldest_slave_age_days"],
        "oldest_slave_age_hours": row["oldest_slave_age_hours"],
        "oldest_slave_no": row["oldest_slave_no"],
        "referred_by": row["referred_by"],
    }


def snapshot_age_hours(snapshot: dict[str, Any]) -> int:
    born_at = snapshot.get("slaveBornAt")
    if not isinstance(born_at, (int, float)):
        return 0
    ended_at = snapshot.get("slaveEndedAt")
    if not isinstance(ended_at, (int, float)):
        ended_at = datetime.now(timezone.utc).timestamp() * 1000
    return max(0, int((ended_at - born_at) / 3_600_000))


def snapshot_level(snapshot: dict[str, Any]) -> int:
    base_mult = snapshot.get("baseMult", 1)
    belt_level = snapshot.get("beltLevel", 0)
    base = base_mult if isinstance(base_mult, (int, float)) else 1
    belt = belt_level if isinstance(belt_level, (int, float)) else 0
    return max(1, 1 + int(max(0, base - 1) * 20) + int(belt))


def auction_lot_dict(row: Any) -> dict[str, Any]:
    try:
        snapshot = json.loads(row["slave_stats"])
    except (TypeError, json.JSONDecodeError):
        snapshot = {}
    age_hours = max(row["age_hours"], snapshot_age_hours(snapshot)) if row["status"] == "active" else row["age_hours"]
    return {
        "id": row["id"],
        "seller_id": row["seller_id"],
        "seller_name": row["seller_name"] if "seller_name" in row.keys() else "Игрок",
        "slave_name": row["slave_name"],
        "slave_no": row["slave_no"],
        "level": row["slave_level"],
        "fetish": row["fetish"],
        "price": row["price"],
        "age_hours": age_hours,
        "status": row["status"],
    }


def transferred_slave(snapshot: dict[str, Any], age_hours: int) -> dict[str, Any]:
    transferred = dict(snapshot)
    for key in (
        "displayName", "nicknameChanges", "ownedProfileCards", "profileCard",
        "quest", "weekly", "mquest", "mistressLevel", "decorVarOwned",
    ):
        transferred.pop(key, None)
    slave_state = dict(transferred.get("state") or {})
    slave_state["coins"] = 0
    slave_state["gems"] = 0
    transferred["state"] = slave_state
    transferred["slavesKilled"] = 0
    transferred["oldestSlaveAgeDays"] = age_hours // 24
    transferred["oldestSlaveAgeHours"] = age_hours
    transferred["oldestSlaveNo"] = transferred.get("slaveNo", 1)
    transferred["slaveEndedAt"] = None
    transferred["slaveEndReason"] = None
    transferred["gone"] = False
    return transferred


class LoadRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    init_data: str = Field(alias="initData")
    referrer_id: int | None = Field(default=None, gt=0)


class PlayerStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    coins: int = Field(default=0, ge=0)
    crystals: int = Field(default=0, ge=0)
    slaves_killed: int = Field(default=0, ge=0)
    current_slave_stats: dict[str, Any] = Field(default_factory=dict)
    vip_status: bool = False
    oldest_slave_age_days: int = Field(default=0, ge=0)
    oldest_slave_age_hours: int = Field(default=0, ge=0)
    oldest_slave_no: int = Field(default=1, ge=1)


class SaveRequest(LoadRequest):
    stats: PlayerStats


class NicknameRequest(LoadRequest):
    display_name: str = Field(min_length=1, max_length=24)


class PaymentRequest(LoadRequest):
    product: Literal["gems_10", "gems_60", "gems_150", "vip"]


class AuctionCreateRequest(LoadRequest):
    price: int = Field(gt=0, le=1_000_000)
    stats: PlayerStats


class AuctionBuyRequest(LoadRequest):
    lot_id: int = Field(gt=0)


class PaymentNotification(BaseModel):
    event: str
    object: dict[str, Any]


dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message) -> None:
    global bot_username
    me = await message.bot.get_me()
    bot_username = me.username or bot_username
    argument = (message.text or "").partition(" ")[2]
    referrer_id = int(argument[4:]) if argument.startswith("ref_") and argument[4:].isdigit() else None
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Воспитать",
                    web_app=WebAppInfo(url=game_url_with_referral(referrer_id)),
                )
            ]
        ]
    )
    await message.answer(
        "Я Ваш виртуальный слуга, крупно желающий стать рыцарем. Мне нужно чуть-чуть дисциплины..",
        reply_markup=keyboard,
    )


async def run_bot() -> None:
    global bot_username
    bot = Bot(token=get_bot_token())
    retry_delay = 5
    try:
        while True:
            delay = retry_delay
            try:
                me = await bot.get_me()
                bot_username = me.username or bot_username
                retry_delay = 5
                await dp.start_polling(bot)
                logging.warning("Telegram-polling завершён; выполняется перезапуск")
            except asyncio.CancelledError:
                raise
            except TelegramRetryAfter as error:
                delay = max(1, error.retry_after) + 1
                logging.warning("Telegram rate limit; повторный запуск через %s сек.", delay)
            except Exception:
                logging.exception("Ошибка Telegram-бота; выполняется перезапуск")
                retry_delay = min(retry_delay * 2, 60)
            await asyncio.sleep(delay)
    finally:
        await bot.session.close()


async def keep_render_awake() -> None:
    render_url = os.getenv("RENDER_EXTERNAL_URL", get_game_url()).rstrip("/")
    hostname = urlsplit(render_url).hostname or ""
    if not os.getenv("RENDER") or not hostname.endswith(".onrender.com"):
        return
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            await asyncio.sleep(13 * 60)
            try:
                response = await client.get(f"{render_url}/api/health")
                response.raise_for_status()
            except asyncio.CancelledError:
                raise
            except httpx.HTTPError as error:
                logging.warning("Keepalive-запрос Render не выполнен: %s", error)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    tasks = [asyncio.create_task(keep_render_awake())]
    if os.getenv("RUN_BOT", "1").lower() not in {"0", "false", "no"}:
        tasks.append(asyncio.create_task(run_bot()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="ПОДОПЫТНЫЙ 001 API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("FRONTEND_URLS", "*").split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.post("/api/load_data")
def load_data(request: LoadRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    username = username_for(user)
    with database() as connection:
        row = connection.execute("SELECT * FROM players WHERE id = ? FOR UPDATE", (user["id"],)).fetchone()
        rating_reset = bool(row and row["rating_reset_pending"])
        if row is None:
            referrer = None
            if request.referrer_id and request.referrer_id != user["id"]:
                referrer = connection.execute(
                    "SELECT id FROM players WHERE id = ?", (request.referrer_id,)
                ).fetchone()
            connection.execute(
                "INSERT INTO players (id, username, crystals, referred_by) VALUES (?, ?, ?, ?)",
                (
                    user["id"],
                    username,
                    REFERRED_PLAYER_REWARD if referrer else 0,
                    referrer["id"] if referrer else None,
                ),
            )
            if referrer:
                connection.execute(
                    """
                    UPDATE players
                    SET crystals = crystals + ?, pending_crystals = pending_crystals + ?
                    WHERE id = ?
                    """,
                    (REFERRER_REWARD, REFERRER_REWARD, referrer["id"]),
                )
        else:
            connection.execute(
                "UPDATE players SET username = ?, pending_crystals = 0, rating_reset_pending = FALSE WHERE id = ?",
                (username, user["id"]),
            )
        connection.commit()
        row = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
    result = player_dict(row)
    result["rating_reset_applied"] = rating_reset
    return result


@app.post("/api/save_data")
def save_data(request: SaveRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    stats = request.stats
    oldest_age_hours = max(stats.oldest_slave_age_hours, stats.oldest_slave_age_days * 24)
    with database() as connection:
        row = connection.execute("SELECT * FROM players WHERE id = ? FOR UPDATE", (user["id"],)).fetchone()
        if row is None:
            connection.execute(
                "INSERT INTO players (id, username) VALUES (?, ?)",
                (user["id"], username_for(user)),
            )
            row = connection.execute(
                "SELECT * FROM players WHERE id = ? FOR UPDATE", (user["id"],)
            ).fetchone()
        try:
            stored_snapshot = json.loads(row["current_slave_stats"] or "{}")
        except (TypeError, json.JSONDecodeError):
            stored_snapshot = {}
        stored_uid = stored_snapshot.get("slaveUid")
        incoming_uid = stats.current_slave_stats.get("slaveUid")
        if stored_uid and incoming_uid != stored_uid:
            raise HTTPException(status_code=409, detail="Персонаж изменился в другой вкладке. Обновите игру.")
        if not stored_uid and incoming_uid:
            listed = connection.execute(
                """
                SELECT id FROM auction_lots
                WHERE seller_id = ? AND slave_uid = ? AND status IN ('active', 'sold')
                ORDER BY id DESC LIMIT 1
                """,
                (user["id"], incoming_uid),
            ).fetchone()
            if listed:
                raise HTTPException(status_code=409, detail="Этот персонаж уже выставлен или продан. Обновите игру.")
        rating_reset = row["rating_reset_pending"]
        saved_stats = dict(stats.current_slave_stats)
        oldest_days = stats.oldest_slave_age_days
        oldest_no = stats.oldest_slave_no
        if rating_reset:
            oldest_age_hours = 0
            oldest_days = 0
            oldest_no = 1
            saved_stats["oldestSlaveAgeDays"] = 0
            saved_stats["oldestSlaveAgeHours"] = 0
            saved_stats["oldestSlaveNo"] = 1
        connection.execute(
            """
            UPDATE players
            SET username = ?, coins = ?, crystals = ?, pending_crystals = 0, slaves_killed = ?,
                current_slave_stats = ?, vip_status = ?, rating_reset_pending = FALSE,
                oldest_slave_age_days = CASE WHEN ? THEN 0 ELSE GREATEST(oldest_slave_age_days, ?) END,
                oldest_slave_no = CASE
                    WHEN ? THEN 1
                    WHEN ? > oldest_slave_age_hours THEN ?
                    ELSE oldest_slave_no
                END,
                oldest_slave_age_hours = CASE WHEN ? THEN 0 ELSE GREATEST(oldest_slave_age_hours, ?) END
            WHERE id = ?
            """,
            (
                username_for(user), stats.coins, stats.crystals + row["pending_crystals"],
                stats.slaves_killed, json.dumps(saved_stats, ensure_ascii=False), stats.vip_status,
                rating_reset, oldest_days, rating_reset, oldest_age_hours, oldest_no,
                rating_reset, oldest_age_hours, user["id"],
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
    result = player_dict(row)
    result["rating_reset_applied"] = rating_reset
    return result


@app.post("/api/profile/nickname")
def change_nickname(request: NicknameRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    display_name = " ".join(request.display_name.split())
    if not display_name:
        raise HTTPException(status_code=400, detail="Введите ник")
    with database() as connection:
        connection.execute(
            "INSERT INTO players (id, username) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
            (user["id"], username_for(user)),
        )
        row = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
        if (row["display_name"] or "Игрок") == display_name:
            connection.commit()
            return player_dict(row)
        cost = 500 if row["nickname_changes"] else 0
        if row["crystals"] < cost:
            raise HTTPException(status_code=400, detail="Для смены ника нужно 500 клятв")
        connection.execute(
            """
            UPDATE players
            SET display_name = ?, nickname_changes = nickname_changes + 1, crystals = crystals - ?
            WHERE id = ?
            """,
            (display_name, cost, user["id"]),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
    return player_dict(row)


@app.post("/api/referral")
def referral(request: LoadRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    if not bot_username:
        raise HTTPException(status_code=503, detail="Имя бота ещё не загружено")
    with database() as connection:
        connection.execute(
            "INSERT INTO players (id, username) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
            (user["id"], username_for(user)),
        )
        invited = connection.execute(
            "SELECT COUNT(*) AS count FROM players WHERE referred_by = ?", (user["id"],)
        ).fetchone()["count"]
        connection.commit()
    return {
        "url": f"https://t.me/{bot_username}?start=ref_{user['id']}",
        "invited": invited,
        "referrer_reward": REFERRER_REWARD,
        "player_reward": REFERRED_PLAYER_REWARD,
    }


@app.post("/api/payments/create")
def payment_create(request: PaymentRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    try:
        payment = create_payment(user["id"], request.product, get_game_url())
    except PaymentError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    with database() as connection:
        connection.execute(
            "INSERT INTO players (id, username) VALUES (?, ?) ON CONFLICT (id) DO NOTHING",
            (user["id"], username_for(user)),
        )
        connection.execute(
            """
            INSERT INTO payments (id, user_id, product, amount, crystals, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payment["id"],
                user["id"],
                request.product,
                payment["amount"],
                payment["crystals"],
                payment["status"],
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        connection.commit()
    return payment


@app.post("/api/payments/yookassa")
def payment_webhook(notification: PaymentNotification) -> dict[str, bool]:
    payment_id = str(notification.object.get("id", ""))
    if not payment_id:
        raise HTTPException(status_code=400, detail="Отсутствует ID платежа")
    try:
        verified = get_verified_payment(payment_id)
    except PaymentError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    with database() as connection:
        stored = connection.execute(
            "SELECT * FROM payments WHERE id = ?", (payment_id,)
        ).fetchone()
        if stored is None:
            raise HTTPException(status_code=404, detail="Платёж не найден")
        metadata = verified.get("metadata") or {}
        if (
            str(metadata.get("user_id")) != str(stored["user_id"])
            or metadata.get("product") != stored["product"]
        ):
            raise HTTPException(status_code=400, detail="Данные платежа не совпадают")
        status = verified.get("status", notification.object.get("status", "unknown"))
        if status == "succeeded":
            updated = connection.execute(
                "UPDATE payments SET status = ? WHERE id = ? AND status <> ? RETURNING *",
                (status, payment_id, status),
            ).fetchone()
            if updated:
                if stored["crystals"]:
                    connection.execute(
                        "UPDATE players SET crystals = crystals + ? WHERE id = ?",
                        (stored["crystals"], stored["user_id"]),
                    )
                if stored["product"] == "vip":
                    connection.execute(
                        "UPDATE players SET vip_status = ? WHERE id = ?",
                        (True, stored["user_id"]),
                    )
        else:
            connection.execute(
                "UPDATE payments SET status = ? WHERE id = ?", (status, payment_id)
            )
        connection.commit()
    return {"ok": True}


@app.get("/api/auction")
def auction_list() -> dict[str, list[dict[str, Any]]]:
    with database() as connection:
        rows = connection.execute(
            """
            SELECT lots.*, players.display_name AS seller_name
            FROM auction_lots AS lots
            JOIN players ON players.id = lots.seller_id
            WHERE lots.status = 'active'
            ORDER BY lots.created_at DESC, lots.id DESC LIMIT 100
            """
        ).fetchall()
    return {"lots": [auction_lot_dict(row) for row in rows]}


@app.post("/api/auction/list")
def auction_create(request: AuctionCreateRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    stats = request.stats
    snapshot = dict(stats.current_slave_stats)
    slave_uid = str(snapshot.get("slaveUid") or "")
    slave_no = snapshot.get("slaveNo")
    if not slave_uid or len(slave_uid) > 80 or not isinstance(slave_no, int) or slave_no < 1:
        raise HTTPException(status_code=400, detail="Обновите игру перед созданием лота")
    if snapshot.get("gone"):
        raise HTTPException(status_code=400, detail="Нельзя выставить завершённого персонажа")
    snapshot["slaveUid"] = slave_uid
    age_hours = snapshot_age_hours(snapshot)
    slave_name = f"Подопытный {slave_no:03d}"
    fetish = str(snapshot.get("fetish") or "Неизвестно")[:80]
    with database() as connection:
        seller = connection.execute(
            "SELECT * FROM players WHERE id = ? FOR UPDATE", (user["id"],)
        ).fetchone()
        if seller is None:
            raise HTTPException(status_code=409, detail="Сначала загрузите игровой профиль")
        try:
            stored_snapshot = json.loads(seller["current_slave_stats"] or "{}")
        except (TypeError, json.JSONDecodeError):
            stored_snapshot = {}
        if stored_snapshot.get("slaveUid") and stored_snapshot.get("slaveUid") != slave_uid:
            raise HTTPException(status_code=409, detail="Этот персонаж уже сменился. Обновите игру.")
        active = connection.execute(
            "SELECT id FROM auction_lots WHERE seller_id = ? AND status = 'active'",
            (user["id"],),
        ).fetchone()
        if active:
            raise HTTPException(status_code=409, detail="У вас уже есть активный лот")
        created_at = datetime.now(timezone.utc).isoformat()
        lot = connection.execute(
            """
            INSERT INTO auction_lots (
                seller_id, slave_uid, slave_name, slave_no, slave_level, fetish,
                price, slave_stats, age_hours, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?) RETURNING *
            """,
            (
                user["id"], slave_uid, slave_name, slave_no, snapshot_level(snapshot),
                fetish, request.price, json.dumps(snapshot, ensure_ascii=False), age_hours, created_at,
            ),
        ).fetchone()
        pending = seller["pending_crystals"]
        oldest_hours = max(stats.oldest_slave_age_hours, stats.oldest_slave_age_days * 24)
        connection.execute(
            """
            UPDATE players
            SET coins = ?, crystals = ?, pending_crystals = 0, current_slave_stats = '{}',
                slaves_killed = ?, oldest_slave_age_days = GREATEST(oldest_slave_age_days, ?),
                oldest_slave_no = CASE WHEN ? > oldest_slave_age_hours THEN ? ELSE oldest_slave_no END,
                oldest_slave_age_hours = GREATEST(oldest_slave_age_hours, ?)
            WHERE id = ?
            """,
            (
                stats.coins, stats.crystals + pending, stats.slaves_killed,
                stats.oldest_slave_age_days, oldest_hours, stats.oldest_slave_no,
                oldest_hours, user["id"],
            ),
        )
        connection.commit()
        seller = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
    return {"lot": auction_lot_dict(lot), "player": player_dict(seller)}


@app.post("/api/auction/buy")
def auction_buy(request: AuctionBuyRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    with database() as connection:
        lot = connection.execute(
            "SELECT * FROM auction_lots WHERE id = ? FOR UPDATE", (request.lot_id,)
        ).fetchone()
        if lot is None or lot["status"] != "active":
            raise HTTPException(status_code=409, detail="Лот уже продан")
        if lot["seller_id"] == user["id"]:
            raise HTTPException(status_code=400, detail="Нельзя купить собственный лот")
        rows = connection.execute(
            "SELECT * FROM players WHERE id IN (?, ?) ORDER BY id FOR UPDATE",
            (lot["seller_id"], user["id"]),
        ).fetchall()
        players = {row["id"]: row for row in rows}
        buyer = players.get(user["id"])
        seller = players.get(lot["seller_id"])
        if buyer is None or seller is None:
            raise HTTPException(status_code=409, detail="Профиль участника не найден")
        if buyer["crystals"] < lot["price"]:
            raise HTTPException(status_code=400, detail="Недостаточно кристаллов")
        snapshot = json.loads(lot["slave_stats"])
        age_hours = max(lot["age_hours"], snapshot_age_hours(snapshot))
        transferred = transferred_slave(snapshot, age_hours)
        buyer_oldest_hours = max(buyer["oldest_slave_age_hours"], buyer["oldest_slave_age_days"] * 24)
        oldest_no = lot["slave_no"] if age_hours > buyer_oldest_hours else buyer["oldest_slave_no"]
        connection.execute(
            """
            UPDATE players
            SET crystals = crystals - ?, pending_crystals = 0, rating_reset_pending = FALSE, current_slave_stats = ?,
                oldest_slave_age_days = GREATEST(oldest_slave_age_days, ?),
                oldest_slave_age_hours = GREATEST(oldest_slave_age_hours, ?),
                oldest_slave_no = ?
            WHERE id = ?
            """,
            (
                lot["price"], json.dumps(transferred, ensure_ascii=False), age_hours // 24,
                age_hours, oldest_no, user["id"],
            ),
        )
        connection.execute(
            """
            UPDATE players
            SET crystals = crystals + ?, pending_crystals = pending_crystals + ?,
                rating_reset_pending = CASE WHEN oldest_slave_no = ? THEN TRUE ELSE rating_reset_pending END,
                oldest_slave_age_days = CASE WHEN oldest_slave_no = ? THEN 0 ELSE oldest_slave_age_days END,
                oldest_slave_age_hours = CASE WHEN oldest_slave_no = ? THEN 0 ELSE oldest_slave_age_hours END,
                oldest_slave_no = CASE WHEN oldest_slave_no = ? THEN 1 ELSE oldest_slave_no END
            WHERE id = ?
            """,
            (
                lot["price"], lot["price"], lot["slave_no"], lot["slave_no"],
                lot["slave_no"], lot["slave_no"], lot["seller_id"],
            ),
        )
        connection.execute(
            """
            UPDATE auction_lots
            SET status = 'sold', buyer_id = ?, age_hours = ?, sold_at = ?
            WHERE id = ?
            """,
            (user["id"], age_hours, datetime.now(timezone.utc).isoformat(), request.lot_id),
        )
        connection.commit()
        buyer = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
    return {"lot_id": request.lot_id, "player": player_dict(buyer)}


@app.get("/api/leaderboard")
def leaderboard() -> dict[str, list[dict[str, Any]]]:
    with database() as connection:
        shame = connection.execute(
            """
            SELECT display_name, slaves_killed FROM players
            ORDER BY slaves_killed DESC, id ASC LIMIT 10
            """
        ).fetchall()
        power = connection.execute(
            """
            SELECT display_name, oldest_slave_age_days, oldest_slave_age_hours, oldest_slave_no
            FROM players
            ORDER BY oldest_slave_age_hours DESC, oldest_slave_age_days DESC, id ASC LIMIT 10
            """
        ).fetchall()
    return {
        "shame": [dict(row) for row in shame],
        "power": [dict(row) for row in power],
    }


@app.get("/api/config")
def config() -> dict[str, str]:
    if not bot_username:
        raise HTTPException(status_code=503, detail="Имя бота ещё не загружено")
    return {"bot_url": f"https://t.me/{bot_username}"}


@app.get("/api/health")
def health() -> dict[str, str]:
    with database() as connection:
        connection.execute("SELECT 1").fetchone()
    return {"status": "ok", "database": "postgresql"}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/style.css")
def stylesheet() -> FileResponse:
    return FileResponse(BASE_DIR / "style.css", media_type="text/css")


@app.get("/script.js")
def javascript() -> FileResponse:
    return FileResponse(BASE_DIR / "script.js", media_type="text/javascript")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
