import os
from typing import Any
from uuid import uuid4

import httpx

API_URL = "https://api.yookassa.ru/v3/payments"
PRODUCTS = {
    "gems_10": {"amount": 99, "crystals": 10, "description": "10 клятв"},
    "gems_60": {"amount": 449, "crystals": 60, "description": "60 клятв"},
    "gems_150": {"amount": 899, "crystals": 150, "description": "150 клятв"},
    "vip": {"amount": 500, "crystals": 0, "description": "VIP-доступ на 30 дней"},
}


class PaymentError(Exception):
    pass


def credentials() -> tuple[str, str]:
    shop_id = os.getenv("YOOKASSA_SHOP_ID", "").strip()
    secret_key = os.getenv("YOOKASSA_SECRET_KEY", "").strip()
    if not shop_id or not secret_key:
        raise PaymentError("ЮKassa не настроена: задайте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY")
    return shop_id, secret_key


def create_payment(user_id: int, product_key: str, return_url: str) -> dict[str, Any]:
    product = PRODUCTS[product_key]
    shop_id, secret_key = credentials()
    payload = {
        "amount": {"value": f"{product['amount']}.00", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": product["description"],
        "metadata": {"user_id": str(user_id), "product": product_key},
    }
    try:
        response = httpx.post(
            API_URL,
            json=payload,
            auth=(shop_id, secret_key),
            headers={"Idempotence-Key": str(uuid4())},
            timeout=15,
        )
        response.raise_for_status()
        payment = response.json()
        return {
            "id": payment["id"],
            "status": payment["status"],
            "confirmation_url": payment["confirmation"]["confirmation_url"],
            "amount": product["amount"],
            "crystals": product["crystals"],
        }
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
        raise PaymentError("Не удалось создать платёж в ЮKassa") from error


def get_verified_payment(payment_id: str) -> dict[str, Any]:
    shop_id, secret_key = credentials()
    try:
        response = httpx.get(API_URL + "/" + payment_id, auth=(shop_id, secret_key), timeout=15)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise PaymentError("Не удалось подтвердить платёж в ЮKassa") from error
