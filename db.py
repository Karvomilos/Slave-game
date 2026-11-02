import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

BASE_DIR = Path(__file__).resolve().parent
SUPABASE_URL_FILE = BASE_DIR / "supabase_url.txt"


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        try:
            url = SUPABASE_URL_FILE.read_text(encoding="utf-8").strip()
        except OSError:
            pass
    if not url:
        raise RuntimeError("Задайте DATABASE_URL для подключения к Supabase PostgreSQL")
    if "[YOUR-PASSWORD]" in url:
        raise RuntimeError("Замените [YOUR-PASSWORD] в строке подключения Supabase на пароль базы")
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if not url.startswith("postgresql://"):
        raise RuntimeError("DATABASE_URL должен быть строкой подключения PostgreSQL")
    return url


class Connection:
    def __init__(self, raw: Any):
        self.raw = raw

    def execute(self, sql: str, params: tuple[Any, ...] = ()):
        return self.raw.execute(sql.replace("?", "%s"), params)

    def commit(self) -> None:
        self.raw.commit()


@contextmanager
def database() -> Iterator[Connection]:
    with psycopg.connect(get_database_url(), row_factory=dict_row, connect_timeout=10) as raw:
        yield Connection(raw)


def init_database() -> None:
    with database() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS players (
                id BIGINT PRIMARY KEY,
                username TEXT NOT NULL DEFAULT '',
                display_name TEXT NOT NULL DEFAULT '',
                nickname_changes INTEGER NOT NULL DEFAULT 0,
                coins INTEGER NOT NULL DEFAULT 0,
                crystals INTEGER NOT NULL DEFAULT 0,
                slaves_killed INTEGER NOT NULL DEFAULT 0,
                current_slave_stats TEXT NOT NULL DEFAULT '{}',
                vip_status BOOLEAN NOT NULL DEFAULT FALSE,
                oldest_slave_age_days INTEGER NOT NULL DEFAULT 0,
                oldest_slave_age_hours INTEGER NOT NULL DEFAULT 0,
                oldest_slave_no INTEGER NOT NULL DEFAULT 1,
                referred_by BIGINT REFERENCES players(id)
            )
            """
        )
        connection.execute(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT ''"
        )
        connection.execute(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS nickname_changes INTEGER NOT NULL DEFAULT 0"
        )
        connection.execute(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS oldest_slave_age_hours INTEGER NOT NULL DEFAULT 0"
        )
        connection.execute(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS oldest_slave_no INTEGER NOT NULL DEFAULT 1"
        )
        connection.execute(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES players(id)"
        )
        connection.execute(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS pending_crystals INTEGER NOT NULL DEFAULT 0"
        )
        connection.execute(
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS rating_reset_pending BOOLEAN NOT NULL DEFAULT FALSE"
        )
        connection.execute(
            "UPDATE players SET oldest_slave_age_hours = oldest_slave_age_days * 24 WHERE oldest_slave_age_hours = 0 AND oldest_slave_age_days > 0"
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                product TEXT NOT NULL,
                amount INTEGER NOT NULL,
                crystals INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS auction_lots (
                id BIGSERIAL PRIMARY KEY,
                seller_id BIGINT NOT NULL REFERENCES players(id),
                buyer_id BIGINT REFERENCES players(id),
                slave_uid TEXT NOT NULL,
                slave_name TEXT NOT NULL,
                slave_no INTEGER NOT NULL,
                slave_level INTEGER NOT NULL,
                fetish TEXT NOT NULL,
                price INTEGER NOT NULL CHECK (price > 0),
                slave_stats TEXT NOT NULL,
                age_hours INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                sold_at TEXT
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS players_referred_by_idx ON players (referred_by)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS auction_lots_active_idx ON auction_lots (status, created_at DESC)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS auction_lots_slave_idx ON auction_lots (seller_id, slave_uid, id DESC)"
        )
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS auction_lots_one_active_idx ON auction_lots (seller_id) WHERE status = 'active'"
        )
        connection.commit()
