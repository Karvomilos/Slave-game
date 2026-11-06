import asyncio
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import WebSocket, WebSocketDisconnect

from db import database

EFFECTS = {
    "poop": {"name": "Какашка", "emoji": "💩", "cost": 10},
    "kiss": {"name": "Поцелуй", "emoji": "💋", "cost": 20},
    "crown": {"name": "Корона", "emoji": "👑", "cost": 100},
    "fire": {"name": "Огонь", "emoji": "🔥", "cost": 250},
}


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
        self.lock = asyncio.Lock()

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
            "messages": self.messages[-50:],
        }


class BottleRoomManager:
    def __init__(self, authenticate: Callable[[str], dict[str, Any]], allow_demo: bool = False):
        self.authenticate = authenticate
        self.allow_demo = allow_demo
        self.store = BottleStore()
        self.rooms: dict[str, Room] = {}

    async def broadcast(self, room: Room, event: dict[str, Any]) -> None:
        for connection in list(room.connections.values()):
            try:
                await connection.send_json(event)
            except (RuntimeError, WebSocketDisconnect):
                pass

    async def broadcast_state(self, room: Room) -> None:
        await self.broadcast(room, {"type": "room_state", "room": room.state()})

    async def system_message(self, room: Room, text: str) -> None:
        message = {
            "id": room.next_message_id,
            "system": True,
            "text": text,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        room.next_message_id += 1
        room.messages.append(message)
        room.messages = room.messages[-50:]
        await self.broadcast(room, {"type": "chat_message", "message": message})

    async def identity(self, data: dict[str, Any]) -> dict[str, Any]:
        init_data = data.get("initData") or data.get("init_data") or ""
        if init_data:
            user = await asyncio.to_thread(self.authenticate, init_data)
            avatar_url = user.get("photo_url") or ""
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
            if user_id not in room.players:
                raise RoomError("Игрок уже вышел из комнаты")
            if action == "spin":
                await self.spin(room, user_id)
            elif action == "choice":
                await self.choose(room, user_id, message.get("choice"))
            elif action == "effect":
                await self.effect(room, user_id, message.get("target_id"), message.get("effect"))
            elif action == "chat":
                await self.chat(room, user_id, message.get("text"))
            else:
                raise RoomError("Неизвестное действие")

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
        both_kiss = all(choice == "kiss" for choice in choices.values())
        kiss_ids = [spinner_id, target_id] if both_kiss else []
        penalty_id = target_id if "humiliate" in choices.values() else None
        ratings = await asyncio.to_thread(self.store.apply_rating, kiss_ids, penalty_id)
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

    async def effect(self, room: Room, sender_id: int, target_id: Any, effect: Any) -> None:
        if effect not in EFFECTS:
            raise RoomError("Неизвестный эффект")
        try:
            target_id = int(target_id)
        except (TypeError, ValueError) as error:
            raise RoomError("Выберите получателя") from error
        if target_id == sender_id or target_id not in room.players:
            raise RoomError("Выберите другого игрока в комнате")
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
        if sender:
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

    async def chat(self, room: Room, user_id: int, text: Any) -> None:
        text = " ".join(str(text or "").split())[:300]
        if not text:
            raise RoomError("Введите сообщение")
        message = {
            "id": room.next_message_id,
            "system": False,
            "player_id": user_id,
            "username": room.players[user_id]["username"],
            "text": text,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        room.next_message_id += 1
        room.messages.append(message)
        room.messages = room.messages[-50:]
        await self.broadcast(room, {"type": "chat_message", "message": message})

    async def leave(self, room: Room, user_id: int, websocket: WebSocket) -> None:
        async with room.lock:
            if room.connections.get(user_id) != websocket:
                return
            room.connections.pop(user_id, None)
            player = room.players.pop(user_id, None)
            if player is None:
                return
            ids = list(room.players)
            if room.current_turn == user_id or room.current_turn not in room.players:
                room.current_turn = ids[0] if ids else None
            cancelled = bool(room.pending and user_id in {room.pending["spinner_id"], room.pending["target_id"]})
            if cancelled:
                room.pending = None
                room.target_id = None
            elif room.target_id == user_id:
                room.target_id = None
            if not room.players:
                self.rooms.pop(room.id, None)
                return
            await self.broadcast_state(room)
            text = f"🚪 {player['username']} вышел из комнаты"
            if cancelled:
                text += "; текущий раунд отменён"
            await self.system_message(room, text)
