import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlencode, urlsplit, urlunsplit

from aiogram import Bot, Dispatcher
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
GAME_URL = os.getenv("GAME_URL", "http://127.0.0.1:8000")
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
    try:
        me = await bot.get_me()
        await bot.set_my_name(name="My talking servant")
        bot_username = me.username or bot_username
        await dp.start_polling(bot)
    except asyncio.CancelledError:
        raise
    except Exception:
        logging.exception("Telegram-бот остановлен из-за ошибки")
    finally:
        await bot.session.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    bot_task = None
    if os.getenv("RUN_BOT", "1").lower() not in {"0", "false", "no"}:
        bot_task = asyncio.create_task(run_bot())
    yield
    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass


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
        row = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
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
                    "UPDATE players SET crystals = crystals + ? WHERE id = ?",
                    (REFERRER_REWARD, referrer["id"]),
                )
        else:
            connection.execute(
                "UPDATE players SET username = ? WHERE id = ?",
                (username, user["id"]),
            )
        connection.commit()
        row = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
    return player_dict(row)


@app.post("/api/save_data")
def save_data(request: SaveRequest) -> dict[str, Any]:
    user = authenticate(request.init_data)
    stats = request.stats
    oldest_age_hours = max(stats.oldest_slave_age_hours, stats.oldest_slave_age_days * 24)
    with database() as connection:
        row = connection.execute("SELECT id FROM players WHERE id = ?", (user["id"],)).fetchone()
        if row is None:
            connection.execute(
                "INSERT INTO players (id, username) VALUES (?, ?)",
                (user["id"], username_for(user)),
            )
        connection.execute(
            """
            UPDATE players
            SET username = ?, coins = ?, crystals = ?, slaves_killed = ?,
                current_slave_stats = ?, vip_status = ?,
                oldest_slave_age_days = GREATEST(oldest_slave_age_days, ?),
                oldest_slave_no = CASE
                    WHEN ? > oldest_slave_age_hours THEN ?
                    ELSE oldest_slave_no
                END,
                oldest_slave_age_hours = GREATEST(oldest_slave_age_hours, ?)
            WHERE id = ?
            """,
            (
                username_for(user),
                stats.coins,
                stats.crystals,
                stats.slaves_killed,
                json.dumps(stats.current_slave_stats, ensure_ascii=False),
                stats.vip_status,
                stats.oldest_slave_age_days,
                oldest_age_hours,
                stats.oldest_slave_no,
                oldest_age_hours,
                user["id"],
            ),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM players WHERE id = ?", (user["id"],)).fetchone()
    return player_dict(row)


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
