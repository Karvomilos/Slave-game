import logging
import os
from decimal import Decimal
from typing import Any

from nalogo import Client

RECEIPT_SERVICE_NAME = "Покупка внутриигровой валюты"


async def create_tax_receipt(payment_id: str, amount: Decimal) -> dict[str, Any]:
    inn = os.getenv("NALOGO_INN", "").strip()
    password = os.getenv("NALOGO_PASSWORD", "").strip()
    if not inn or not password:
        raise RuntimeError("Фискализация не настроена: задайте NALOGO_INN и NALOGO_PASSWORD")

    storage_path = os.getenv("NALOGO_TOKEN_STORAGE_PATH", "").strip() or None
    async with Client(storage_path=storage_path, timeout=10) as client:
        token = await client.create_new_access_token(inn, password)
        await client.authenticate(token)
        result = await client.income().create(
            name=RECEIPT_SERVICE_NAME,
            amount=amount,
            quantity=1,
        )
    logging.info("Чек ФНС создан для платежа %s: %s", payment_id, result.get("approvedReceiptUuid"))
    return result
