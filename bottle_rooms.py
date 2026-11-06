import asyncio
import base64
import binascii
import logging
import random
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote, urlsplit

from fastapi import WebSocket, WebSocketDisconnect

from db import database

BOT_PLAYER_ID = -1
BOT_JOIN_DELAY = (60, 180)
BOT_SESSION_DURATION = (600, 900)
BOT_RETURN_DELAY = (120, 300)
BOT_CHAT_COOLDOWN = (1200, 1800)
MUSIC_COST = 3
MAX_MUSIC_SIZE = 5 * 1024 * 1024
FAKE_GODDESS_DIR = Path(__file__).resolve().parent / "assets" / "fake_goddess"
BOT_NAMES = ["Алина", "Мира", "Виктория", "София", "Даша", "Лера", "Ева", "Кира", "Алёна", "Марина", "Ника", "Тая"]
BOT_SPIN_PHRASES = ["Так, ну наконец-то 😄", "Ну, посмотрим, что ты выберешь…", "Я даже не знаю, к чему готовиться 😅"]
BOT_GIFT_PHRASES = ["О, это мне? Спасибо…", "Не ожидала, правда 🌹", "Ну ты умеешь делать сюрпризы."]
EFFECTS = {
    "poop": {"name": "Какашка", "emoji": "💩", "cost": 10},
    "kiss": {"name": "Поцелуй", "emoji": "💋", "cost": 20},
    "rose": {"name": "Роза", "emoji": "🌹", "cost": 15},
    "wine": {"name": "Вино", "emoji": "🍷", "cost": 30},
    "crown": {"name": "Корона", "emoji": "👑", "cost": 100},
    "fire": {"name": "Огонь", "emoji": "🔥", "cost": 250},
}


def fake_goddess_avatar(exclude: str = "") -> str:
    try:
        files = [
            path for path in FAKE_GODDESS_DIR.iterdir()
            if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        ]
    except OSError:
        return ""
    def avatar_url(path: Path) -> str:
        return f"/assets/fake_goddess/{quote(path.name)}"

    choices = [path for path in files if avatar_url(path) != exclude] or files
    return avatar_url(secrets.choice(choices)) if choices else ""


class RoomError(Exception):
    pass


class BottleStore:
    def ensure_player(self, user_id: int, username: str, avatar_url: str) -> dict[str, Any]:
        with database() as connection:
            row = connection.execute(
                """
                INSERT INTO players (id, username, display_name, avatar_url)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    display_name = CASE WHEN players.display_name = '' THEN EXCLUDED.display_name ELSE players.display_name END,
                    avatar_url = EXCLUDED.avatar_url,
                    last_seen = NOW()
                RETURNING id, display_name, crystals, current_effect, bottle_rating, bottle_revision
                """,
                (user_id, username, username, avatar_url),
            ).fetchone()
            connection.commit()
            return dict(row)

    def debit_crystals(self, sender_id: int, cost: int) -> dict[str, int]:
        with database() as connection:
            sender = connection.execute(
                "SELECT crystals FROM players WHERE id = ? FOR UPDATE", (sender_id,)
            ).fetchone()
            if sender is None:
                raise RoomError("Игровой профиль не найден")
            if sender["crystals"] < cost:
                raise RoomError(f"Недостаточно клятв: нужно {cost}")
            updated = connection.execute(
                """
                UPDATE players
                SET crystals = crystals - ?, bottle_revision = bottle_revision + 1
                WHERE id = ?
                RETURNING crystals, bottle_revision
                """,
                (cost, sender_id),
            ).fetchone()
            connection.commit()
            return dict(updated)

    def purchase_effect(self, sender_id: int, target_id: int, effect: str) -> dict[str, int]:
        cost = EFFECTS[effect]["cost"]
        with database() as connection:
            sender = connection.execute(
                "SELECT crystals FROM players WHERE id = ? FOR UPDATE", (sender_id,)
            ).fetchone()
            if sender is None:
                raise RoomError("Игровой профиль не найден")
            if sender["crystals"] < cost:
                raise RoomError(f"Недостаточно клятв: нужно {cost}")
            updated = connection.execute(
                """
                UPDATE players
                SET crystals = crystals - ?, bottle_revision = bottle_revision + 1
                WHERE id = ?
                RETURNING crystals, bottle_revision
                """,
                (cost, sender_id),
            ).fetchone()
            if target_id != BOT_PLAYER_ID:
                connection.execute(
                    "UPDATE players SET current_effect = ? WHERE id = ?", (effect, target_id)
                )
            connection.commit()
            return dict(updated)

    def apply_rating(self, kiss_ids: list[int], penalty_id: int | None) -> dict[int, int]:
        ids = sorted(set(kiss_ids + ([penalty_id] if penalty_id is not None else [])))
        with database() as connection:
            for user_id in kiss_ids:
                connection.execute(
                    "UPDATE players SET bottle_rating = bottle_rating + 5 WHERE id = ?", (user_id,)
                )
            if penalty_id is not None:
                connection.execute(
                    "UPDATE players SET bottle_rating = bottle_rating - 3 WHERE id = ?", (penalty_id,)
                )
            rows = connection.execute(
                "SELECT id, bottle_rating FROM players WHERE id = ANY(?)", (ids,)
            ).fetchall() if ids else []
            connection.commit()
            return {row["id"]: row["bottle_rating"] for row in rows}


class Room:
    def __init__(self, room_id: str):
        self.id = room_id
        self.players: dict[int, dict[str, Any]] = {}
        self.connections: dict[int, WebSocket] = {}
        self.current_turn: int | None = None
        self.target_id: int | None = None
        self.pending: dict[str, Any] | None = None
        self.messages: list[dict[str, Any]] = []
        self.next_message_id = 1
        self.next_round_id = 1
        self.music: dict[str, Any] | None = None
        self.chat_counts: dict[int, int] = {}
        self.bot_task: asyncio.Task | None = None
        self.bot_actions: set[asyncio.Task] = set()
        self.bot_next_chat_at = 0.0
        self.bot_interacted = False
        self.lock = asyncio.Lock()

    def real_players(self) -> list[int]:
        return [player_id for player_id in self.players if player_id != BOT_PLAYER_ID]

    def state(self) -> dict[str, Any]:
        pending = None
        if self.pending:
            pending = {
                "id": self.pending["id"],
                "spinner_id": self.pending["spinner_id"],
                "target_id": self.pending["target_id"],
                "choices": list(self.pending["choices"]),
            }
        return {
            "id": self.id,
            "players": list(self.players.values()),
            "current_turn": self.current_turn,
            "target_id": self.target_id,
            "pending": pending,
            "music": self.music,
            "messages": self.messages[-50:],
        }


class BottleRoomManager:
    def __init__(self, authenticate: Callable[[str], dict[str, Any]], allow_demo: bool = False):
        self.authenticate = authenticate
        self.allow_demo = allow_demo
        self.store = BottleStore()
        self.rooms: dict[str, Room] = {}
        self.music_uploads: dict[str, bytes] = {}
        self.random = random.Random()

    async def close(self) -> None:
        tasks = []
        for room in self.rooms.values():
            if room.bot_task:
                tasks.append(room.bot_task)
            tasks.extend(room.bot_actions)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self.rooms.clear()
        self.music_uploads.clear()

    def music_content(self, track_id: str) -> bytes | None:
        return self.music_uploads.get(track_id)

    async def broadcast(self, room: Room, event: dict[str, Any]) -> None:
        for connection in list(room.connections.values()):
            try:
                await connection.send_json(event)
            except (RuntimeError, WebSocketDisconnect):
                pass

    async def broadcast_state(self, room: Room) -> None:
        await self.broadcast(room, {"type": "room_state", "room": room.state()})

    async def system_message(self, room: Room, text: str) -> None:
        await self.send_chat(room, {"system": True, "text": text})

    async def send_chat(self, room: Room, data: dict[str, Any]) -> None:
        message = {
            "id": room.next_message_id,
            "at": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        room.next_message_id += 1
        room.messages.append(message)
        room.messages = room.messages[-50:]
        await self.broadcast(room, {"type": "chat_message", "message": message})

    async def identity(self, data: dict[str, Any]) -> dict[str, Any]:
        init_data = data.get("initData") or data.get("init_data") or ""
        avatar_mode = data.get("avatar_mode") if data.get("avatar_mode") in {"pet", "telegram"} else "telegram"
        if init_data:
            user = await asyncio.to_thread(self.authenticate, init_data)
            avatar_url = (user.get("photo_url") or "") if avatar_mode == "telegram" else ""
            if not isinstance(avatar_url, str) or not avatar_url.startswith("https://"):
                avatar_url = ""
            return {
                "id": int(user["id"]),
                "username": str(user.get("first_name") or user.get("username") or "Игрок")[:24],
                "avatar_url": avatar_url[:2048],
            }
        if not self.allow_demo:
            raise RoomError("Откройте игру через кнопку Telegram")
        try:
            user_id = int(data.get("demo_id"))
        except (TypeError, ValueError) as error:
            raise RoomError("Некорректный demo_id") from error
        if not 1 <= user_id <= 9_223_372_036_854_775_807:
            raise RoomError("Некорректный demo_id")
        username = " ".join(str(data.get("username") or "Игрок").split())[:24] or "Игрок"
        return {"id": user_id, "username": username, "avatar_url": ""}

    async def endpoint(self, websocket: WebSocket, room_id: str) -> None:
        await websocket.accept()
        room: Room | None = None
        user_id: int | None = None
        try:
            if not room_id.replace("_", "").replace("-", "").isalnum() or len(room_id) > 32:
                raise RoomError("Некорректный ID комнаты")
            data = await asyncio.wait_for(websocket.receive_json(), timeout=10)
            identity = await self.identity(data)
            user_id = identity["id"]
            profile = await asyncio.to_thread(
                self.store.ensure_player, user_id, identity["username"], identity["avatar_url"]
            )
            room = self.rooms.setdefault(room_id, Room(room_id))
            async with room.lock:
                if user_id not in room.players and len(room.players) >= 10:
                    raise RoomError("Комната заполнена: максимум 10 игроков")
                previous = room.connections.get(user_id)
                if previous and previous != websocket:
                    await previous.close(code=4000, reason="Подключение открыто в другой вкладке")
                room.connections[user_id] = websocket
                if user_id not in room.players:
                    room.players[user_id] = {
                        "id": user_id,
                        "username": profile["display_name"] or identity["username"],
                        "avatar_url": identity["avatar_url"],
                        "current_effect": profile["current_effect"] if profile["current_effect"] in EFFECTS else "",
                        "rating": profile["bottle_rating"],
                    }
                else:
                    room.players[user_id]["avatar_url"] = identity["avatar_url"]
                if room.current_turn is None:
                    room.current_turn = user_id
                await websocket.send_json({
                    "type": "welcome",
                    "player_id": user_id,
                    "crystals": profile["crystals"],
                    "bottle_revision": profile["bottle_revision"],
                    "room": room.state(),
                })
                await self.broadcast_state(room)
                self.ensure_bot(room)
            await self.system_message(room, f"🍾 {room.players[user_id]['username']} вошёл в комнату")
            while True:
                message = await websocket.receive_json()
                try:
                    await self.action(room, user_id, message)
                except RoomError as error:
                    await websocket.send_json({"type": "error", "message": str(error)})
        except (WebSocketDisconnect, asyncio.TimeoutError):
            pass
        except RoomError as error:
            await websocket.send_json({"type": "error", "message": str(error)})
            await websocket.close(code=1008)
        except Exception:
            logging.exception("Ошибка WebSocket-комнаты %s", room_id)
            if websocket.client_state.name == "CONNECTED":
                await websocket.send_json({"type": "error", "message": "Ошибка подключения к комнате"})
                await websocket.close(code=1011)
        finally:
            if room is not None and user_id is not None:
                await self.leave(room, user_id, websocket)

    async def action(self, room: Room, user_id: int, message: dict[str, Any]) -> None:
        action = message.get("action")
        async with room.lock:
            if user_id not in room.players or user_id == BOT_PLAYER_ID:
                raise RoomError("Игрок уже вышел из комнаты")
            if action == "spin":
                await self.spin(room, user_id)
            elif action == "choice":
                await self.choose(room, user_id, message.get("choice"))
            elif action == "effect":
                await self.effect(room, user_id, message.get("target_id"), message.get("effect"))
            elif action == "chat":
                await self.chat(room, user_id, message.get("text"))
            elif action == "music":
                await self.music(room, user_id, message)
            elif action == "avatar":
                await self.avatar(room, user_id, message)
            else:
                raise RoomError("Неизвестное действие")

    async def avatar(self, room: Room, user_id: int, message: dict[str, Any]) -> None:
        mode = message.get("avatar_mode")
        avatar_url = message.get("avatar_url") if mode == "telegram" else ""
        if mode not in {"pet", "telegram"}:
            raise RoomError("Неизвестный режим аватара")
        if not isinstance(avatar_url, str) or (avatar_url and not avatar_url.startswith("https://")):
            raise RoomError("Некорректный адрес аватара")
        room.players[user_id]["avatar_url"] = avatar_url[:2048]
        await self.broadcast_state(room)

    async def spin(self, room: Room, user_id: int) -> None:
        if room.current_turn != user_id or room.pending:
            raise RoomError("Сейчас не ваш ход")
        targets = [player_id for player_id in room.players if player_id != user_id]
        if not targets:
            raise RoomError("Дождитесь второго игрока")
        target_id = secrets.choice(targets)
        room.target_id = target_id
        room.pending = {
            "id": room.next_round_id,
            "spinner_id": user_id,
            "target_id": target_id,
            "choices": {},
        }
        room.next_round_id += 1
        await self.broadcast(room, {
            "type": "spin_result",
            "spinner_id": user_id,
            "target_id": target_id,
            "duration": 3200,
            "room": room.state(),
        })
        await self.system_message(
            room,
            f"🍾 {room.players[user_id]['username']} крутит бутылочку — выбран {room.players[target_id]['username']}!",
        )
        if target_id == BOT_PLAYER_ID:
            room.bot_interacted = True
            self.schedule_bot_response(room, "spin")
        if BOT_PLAYER_ID in {user_id, target_id}:
            self.schedule_bot_action(room, self.bot_choose(room))

    async def choose(self, room: Room, user_id: int, choice: Any) -> None:
        pending = room.pending
        if not pending or user_id not in {pending["spinner_id"], pending["target_id"]}:
            raise RoomError("Сейчас вы не участвуете в выборе")
        if choice not in {"kiss", "humiliate"}:
            raise RoomError("Неизвестный выбор")
        if user_id in pending["choices"]:
            raise RoomError("Выбор уже сделан")
        pending["choices"][user_id] = choice
        if len(pending["choices"]) < 2:
            await self.broadcast_state(room)
            return

        spinner_id = pending["spinner_id"]
        target_id = pending["target_id"]
        choices = dict(pending["choices"])
        both_kiss = all(value == "kiss" for value in choices.values())
        kiss_ids = [spinner_id, target_id] if both_kiss else []
        penalty_id = target_id if "humiliate" in choices.values() else None
        real_kiss_ids = [player_id for player_id in kiss_ids if player_id != BOT_PLAYER_ID]
        real_penalty = penalty_id if penalty_id != BOT_PLAYER_ID else None
        ratings = await asyncio.to_thread(self.store.apply_rating, real_kiss_ids, real_penalty)
        if both_kiss and BOT_PLAYER_ID in {spinner_id, target_id}:
            room.players[BOT_PLAYER_ID]["rating"] += 5
        if penalty_id == BOT_PLAYER_ID:
            room.players[BOT_PLAYER_ID]["rating"] -= 3
        for player_id, rating in ratings.items():
            if player_id in room.players:
                room.players[player_id]["rating"] = rating

        ids = list(room.players)
        room.current_turn = ids[(ids.index(spinner_id) + 1) % len(ids)]
        room.pending = None
        room.target_id = None
        await self.broadcast(room, {
            "type": "round_result",
            "spinner_id": spinner_id,
            "target_id": target_id,
            "choices": choices,
            "both_kiss": both_kiss,
            "penalty_id": penalty_id,
            "ratings": ratings,
            "room": room.state(),
        })
        if both_kiss:
            text = f"💋 {room.players[spinner_id]['username']} и {room.players[target_id]['username']} поцеловались! Оба получают +5 рейтинга."
        else:
            text = f"💩 Выбор сделан: {room.players[target_id]['username']} получает −3 рейтинга."
        await self.system_message(room, text)
        self.schedule_bot_spin(room)

    async def effect(self, room: Room, sender_id: int, target_id: Any, effect: Any) -> None:
        if effect not in EFFECTS:
            raise RoomError("Неизвестный эффект")
        try:
            target_id = int(target_id)
        except (TypeError, ValueError) as error:
            raise RoomError("Выберите получателя") from error
        if target_id == sender_id or target_id not in room.players:
            raise RoomError("Выберите другого игрока в комнате")
        balance = None
        if sender_id != BOT_PLAYER_ID:
            balance = await asyncio.to_thread(self.store.purchase_effect, sender_id, target_id, effect)
        previous_effect = room.players[target_id]["current_effect"]
        room.players[target_id]["current_effect"] = effect
        await self.broadcast(room, {
            "type": "effect_changed",
            "sender_id": sender_id,
            "target_id": target_id,
            "effect": effect,
            "previous_effect": previous_effect,
            "room": room.state(),
        })
        sender = room.connections.get(sender_id)
        if sender and balance:
            await sender.send_json({
                "type": "balance_changed",
                "crystals": balance["crystals"],
                "bottle_revision": balance["bottle_revision"],
            })
        item = EFFECTS[effect]
        await self.system_message(
            room,
            f"🎁 {room.players[sender_id]['username']} перебил эффект {room.players[target_id]['username']}! "
            f"Теперь на его аве {item['name']}!",
        )
        if target_id == BOT_PLAYER_ID:
            room.bot_interacted = True
            self.schedule_bot_response(room, "gift")

    async def chat(self, room: Room, user_id: int, text: Any) -> None:
        text = " ".join(str(text or "").split())[:300]
        if not text:
            raise RoomError("Введите сообщение")
        await self.send_chat(room, {
            "system": False,
            "player_id": user_id,
            "username": room.players[user_id]["username"],
            "text": text,
        })
        room.chat_counts[user_id] = room.chat_counts.get(user_id, 0) + 1
        if (
            BOT_PLAYER_ID in room.players
            and room.chat_counts[user_id] >= 10
            and self.random.random() < 0.4
            and self.reserve_bot_chat(room)
        ):
            self.schedule_bot_action(room, self.bot_random_gift(room, user_id))

    def validate_music(self, message: dict[str, Any]) -> tuple[str, str, bytes | None]:
        source = message.get("source")
        name = Path(str(message.get("name") or "Трек").replace("\x00", "")).name[:80]
        if source == "url":
            url = str(message.get("url") or "").strip()
            parsed = urlsplit(url)
            if parsed.scheme != "https" or not parsed.netloc or not parsed.path.lower().endswith(".mp3"):
                raise RoomError("Нужна прямая HTTPS-ссылка на MP3")
            if len(url) > 2048:
                raise RoomError("Ссылка слишком длинная")
            return source, url, None
        if source == "upload":
            if not name.lower().endswith(".mp3"):
                raise RoomError("Можно загрузить только MP3")
            data = message.get("data")
            if not isinstance(data, str) or not data.startswith("data:audio/") or ";base64," not in data:
                raise RoomError("Некорректный MP3-файл")
            try:
                content = base64.b64decode(data.split(",", 1)[1], validate=True)
            except (binascii.Error, ValueError) as error:
                raise RoomError("Не удалось прочитать MP3") from error
            if not content or len(content) > MAX_MUSIC_SIZE:
                raise RoomError("Размер MP3 должен быть от 1 байта до 5 МБ")
            return source, name, content
        raise RoomError("Выберите MP3-файл или прямую ссылку")

    async def music(self, room: Room, user_id: int, message: dict[str, Any]) -> None:
        source, location, content = self.validate_music(message)
        balance = await asyncio.to_thread(self.store.debit_crystals, user_id, MUSIC_COST)
        track_id = secrets.token_urlsafe(18)
        if content is not None:
            self.music_uploads[track_id] = content
            location = f"/api/bottle/music/{track_id}"
        self.drop_music(room)
        room.music = {
            "id": track_id,
            "url": location,
            "source": source,
            "name": Path(str(message.get("name") or location.rsplit("/", 1)[-1])).name[:80] or "Трек",
            "started_by": room.players[user_id]["username"],
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast(room, {"type": "music_changed", "music": room.music, "room": room.state()})
        sender = room.connections.get(user_id)
        if sender:
            await sender.send_json({
                "type": "balance_changed",
                "crystals": balance["crystals"],
                "bottle_revision": balance["bottle_revision"],
            })
        await self.system_message(room, f"🎵 {room.players[user_id]['username']} включил «{room.music['name']}» за {MUSIC_COST} клятвы.")

    def drop_music(self, room: Room) -> None:
        if room.music and room.music.get("source") == "upload":
            self.music_uploads.pop(room.music["id"], None)

    def remove_player(self, room: Room, user_id: int) -> tuple[dict[str, Any] | None, bool]:
        player = room.players.pop(user_id, None)
        room.connections.pop(user_id, None)
        room.chat_counts.pop(user_id, None)
        if player is None:
            return None, False
        ids = list(room.players)
        if room.current_turn == user_id or room.current_turn not in room.players:
            room.current_turn = ids[0] if ids else None
        cancelled = bool(room.pending and user_id in {room.pending["spinner_id"], room.pending["target_id"]})
        if cancelled:
            room.pending = None
            room.target_id = None
        elif room.target_id == user_id:
            room.target_id = None
        return player, cancelled

    async def leave(self, room: Room, user_id: int, websocket: WebSocket) -> None:
        async with room.lock:
            if room.connections.get(user_id) != websocket:
                return
            player, cancelled = self.remove_player(room, user_id)
            if player is None:
                return
            if not room.real_players():
                self.close_room(room)
                return
            await self.broadcast_state(room)
            text = f"🚪 {player['username']} вышел из комнаты"
            if cancelled:
                text += "; текущий раунд отменён"
            await self.system_message(room, text)
            self.schedule_bot_spin(room)

    def close_room(self, room: Room) -> None:
        self.rooms.pop(room.id, None)
        if room.bot_task:
            room.bot_task.cancel()
        for task in list(room.bot_actions):
            task.cancel()
        room.bot_actions.clear()
        self.drop_music(room)

    def ensure_bot(self, room: Room) -> None:
        if room.bot_task and not room.bot_task.done():
            return
        room.bot_task = asyncio.create_task(self.bot_worker(room))
        room.bot_task.add_done_callback(lambda task: self.bot_done(room, task))

    def bot_done(self, room: Room, task: asyncio.Task) -> None:
        if task.cancelled():
            return
        error = task.exception()
        if error:
            logging.error("Фоновая задача бота комнаты %s завершилась с ошибкой", room.id, exc_info=(type(error), error, error.__traceback__))

    def schedule_bot_action(self, room: Room, coroutine: Any) -> None:
        task = asyncio.create_task(coroutine)
        room.bot_actions.add(task)
        task.add_done_callback(lambda completed: room.bot_actions.discard(completed))
        task.add_done_callback(lambda completed: self.bot_done(room, completed))

    def schedule_bot_spin(self, room: Room) -> None:
        if room.current_turn == BOT_PLAYER_ID and BOT_PLAYER_ID in room.players and not room.pending:
            self.schedule_bot_action(room, self.bot_spin(room))

    def reserve_bot_chat(self, room: Room) -> bool:
        now = time.monotonic()
        if now < room.bot_next_chat_at:
            return False
        room.bot_next_chat_at = now + self.random.uniform(*BOT_CHAT_COOLDOWN)
        return True

    def schedule_bot_response(self, room: Room, trigger: str) -> None:
        if self.reserve_bot_chat(room):
            self.schedule_bot_action(room, self.bot_response(room, trigger))

    async def bot_worker(self, room: Room) -> None:
        previous_name = ""
        previous_avatar = ""
        join_delay = BOT_JOIN_DELAY
        while self.rooms.get(room.id) is room and room.real_players():
            await asyncio.sleep(self.random.uniform(*join_delay))
            if self.rooms.get(room.id) is not room or not room.real_players():
                return
            if len(room.players) >= 10:
                join_delay = BOT_JOIN_DELAY
                continue
            names = [name for name in BOT_NAMES if name != previous_name]
            name = self.random.choice(names)
            avatar = fake_goddess_avatar(previous_avatar)
            previous_name = name
            previous_avatar = avatar
            async with room.lock:
                if not room.real_players() or BOT_PLAYER_ID in room.players:
                    continue
                room.bot_interacted = False
                room.players[BOT_PLAYER_ID] = {
                    "id": BOT_PLAYER_ID,
                    "username": name,
                    "avatar_url": avatar,
                    "current_effect": "",
                    "rating": 0,
                }
                if room.current_turn is None:
                    room.current_turn = BOT_PLAYER_ID
                await self.broadcast_state(room)
                await self.system_message(room, f"🍾 {name} вошла в комнату")
                self.schedule_bot_spin(room)
            await asyncio.sleep(self.random.uniform(*BOT_SESSION_DURATION))
            async with room.lock:
                if BOT_PLAYER_ID not in room.players:
                    continue
                player, _ = self.remove_player(room, BOT_PLAYER_ID)
                for task in list(room.bot_actions):
                    task.cancel()
                room.bot_actions.clear()
                if not room.real_players():
                    self.close_room(room)
                    return
                await self.broadcast_state(room)
                if room.bot_interacted and player:
                    await self.system_message(room, f"🚪 {player['username']} вышла из комнаты")
                self.schedule_bot_spin(room)
            join_delay = BOT_RETURN_DELAY

    async def bot_spin(self, room: Room) -> None:
        await asyncio.sleep(self.random.uniform(2, 5))
        async with room.lock:
            if room.current_turn == BOT_PLAYER_ID and BOT_PLAYER_ID in room.players and not room.pending:
                await self.spin(room, BOT_PLAYER_ID)

    async def bot_choose(self, room: Room) -> None:
        await asyncio.sleep(self.random.uniform(4, 7))
        async with room.lock:
            if BOT_PLAYER_ID not in room.players or not room.pending:
                return
            if BOT_PLAYER_ID not in {room.pending["spinner_id"], room.pending["target_id"]}:
                return
            await self.choose(room, BOT_PLAYER_ID, self.random.choice(["kiss", "humiliate"]))

    async def bot_response(self, room: Room, trigger: str) -> None:
        phrases = BOT_SPIN_PHRASES if trigger == "spin" else BOT_GIFT_PHRASES
        await self.bot_typed_message(room, self.random.choice(phrases))

    async def bot_typed_message(self, room: Room, text: str) -> None:
        if BOT_PLAYER_ID not in room.players:
            return
        duration = self.random.uniform(3, 6)
        await self.broadcast(room, {
            "type": "typing",
            "player_id": BOT_PLAYER_ID,
            "username": room.players[BOT_PLAYER_ID]["username"],
            "duration": duration,
        })
        await asyncio.sleep(duration)
        async with room.lock:
            if BOT_PLAYER_ID not in room.players:
                return
            await self.send_chat(room, {
                "system": False,
                "player_id": BOT_PLAYER_ID,
                "username": room.players[BOT_PLAYER_ID]["username"],
                "text": text,
            })

    async def bot_random_gift(self, room: Room, target_id: int) -> None:
        effect = self.random.choice(["rose", "crown", "wine"])
        async with room.lock:
            if BOT_PLAYER_ID not in room.players or target_id not in room.players:
                return
            await self.effect(room, BOT_PLAYER_ID, target_id, effect)
        await self.bot_typed_message(room, "мне стрёмно с нищеты")
