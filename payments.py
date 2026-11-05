import os
from typing import Any
from uuid import uuid4

import httpx
from yookassa import Configuration, Payment

API_URL = "https://api.yookassa.ru/v3/payments"
PRODUCTS = {
    "gems_100": {"amount": 99, "crystals": 100, "description": "100 клятв"},
    "gems_500": {"amount": 449, "crystals": 500, "description": "500 клятв"},
    "gems_1000": {"amount": 899, "crystals": 1000, "description": "1000 клятв"},
    "gems_3000": {"amount": 2499, "crystals": 3000, "description": "3000 клятв"},
    "gems_10": {"amount": 99, "crystals": 100, "description": "100 клятв"},
    "gems_60": {"amount": 449, "crystals": 500, "description": "500 клятв"},
    "gems_150": {"amount": 899, "crystals": 1000, "description": "1000 клятв"},
    "vip": {"amount": 500, "crystals": 0, "description": "VIP-доступ на 30 дней"},
}
RUBLE_AMOUNTS = {99, 449, 899, 2499}


class PaymentError(Exception):
    pass


def environment_value(*names: str) -> str:
    normalized_names = {name.casefold() for name in names}
    for name, value in os.environ.items():
        if name.strip().casefold() in normalized_names and value.strip():
            return value.strip()
    return ""


def credentials() -> tuple[str, str]:
    shop_id = environment_value("YOOKASSA_SHOP_ID", "SHOP_ID")
    secret_key = environment_value("YOOKASSA_SECRET_KEY", "SECRET_KEY")
    if not shop_id or not secret_key:
        raise PaymentError("ЮKassa не настроена: задайте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY")
    return shop_id, secret_key


def payment_credentials_configured() -> bool:
    try:
        credentials()
        return True
    except PaymentError:
        return False


def create_payment(user_id: int, product_key: str, return_url: str) -> dict[str, Any]:
    product = PRODUCTS[product_key]
    shop_id, secret_key = credentials()
    Configuration.account_id = shop_id
    Configuration.secret_key = secret_key
    payload = {
        "amount": {"value": f"{product['amount']}.00", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": product["description"],
        "metadata": {"user_id": str(user_id), "product": product_key},
    }
    try:
        payment = Payment.create(payload, str(uuid4()))
        return {
            "id": payment.id,
            "status": payment.status,
            "confirmation_url": payment.confirmation.confirmation_url,
            "amount": product["amount"],
            "crystals": product["crystals"],
            "product": product_key,
        }
    except Exception as error:
        raise PaymentError("Не удалось создать платёж в ЮKassa") from error


def create_ruble_payment(telegram_id: int, amount: int, return_url: str) -> dict[str, Any]:
    if amount not in RUBLE_AMOUNTS:
        raise PaymentError("Недоступная сумма платежа")
    shop_id, secret_key = credentials()
    Configuration.account_id = shop_id
    Configuration.secret_key = secret_key
    payload = {
        "amount": {"value": f"{amount}.00", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "metadata": {"telegram_id": str(telegram_id)},
    }
    try:
        payment = Payment.create(payload, str(uuid4()))
        return {
            "id": payment.id,
            "status": payment.status,
            "confirmation_url": payment.confirmation.confirmation_url,
            "amount": amount,
            "crystals": amount,
            "product": f"rub_{amount}",
        }
    except Exception as error:
        raise PaymentError("Не удалось создать платёж в ЮKassa") from error


def get_verified_payment(payment_id: str) -> dict[str, Any]:
    shop_id, secret_key = credentials()
    try:
        response = httpx.get(API_URL + "/" + payment_id, auth=(shop_id, secret_key), timeout=15)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise PaymentError("Не удалось подтвердить платёж в ЮKassa") from error
