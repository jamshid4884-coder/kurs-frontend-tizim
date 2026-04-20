from __future__ import annotations

import asyncio
import json
import mimetypes
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from time import monotonic
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..core.config import BASE_DIR, get_settings
from ..core.security import decrypt_secret, encrypt_secret
from ..db.session import SessionLocal
from ..models import Group, Notification, NotificationStatus, ParentTelegramStatus, PaymentStatus, Student, SystemMessage, TelegramBotSettings
from .common import attendance_percent_for_student, money_to_text, payment_remaining_amount, payment_status_note_for_values
from .live_events import live_events


SETTINGS_ID = "telegram-main"
STATIC_ASSETS_DIR = BASE_DIR / "app" / "static" / "telegram-assets"
DEFAULT_WELCOME_IMAGE = "builtin://parent-welcome-premium"
DEFAULT_NOTIFICATION_IMAGE = "builtin://parent-alert-premium"
BUILTIN_IMAGE_MAP = {
    DEFAULT_WELCOME_IMAGE: STATIC_ASSETS_DIR / "parent-welcome-premium.png",
    DEFAULT_NOTIFICATION_IMAGE: STATIC_ASSETS_DIR / "parent-alert-premium.png",
}

PREVIOUS_DEFAULT_WELCOME_TEXT = (
    "Assalomu alaykum, {parent}.\n\n"
    "{student} uchun ota-ona paneli muvaffaqiyatli ulandi.\n\n"
    "Guruh: {group}\n"
    "Kurs: {course}\n"
    "Jadval: {schedule}\n"
    "O'qituvchi: {teacher}\n"
    "Xona: {room}\n\n"
    "Pastdagi tugmalar orqali kerakli ma'lumotlarni tez ochishingiz mumkin."
)

PREVIOUS_DEFAULT_ATTENDANCE_TEXT = (
    "Davomat yangilandi\n\n"
    "O'quvchi: {student}\n"
    "Holat: {template}\n"
    "Guruh: {group}\n"
    "Jadval: {schedule}\n"
    "O'qituvchi: {teacher}"
)

PREVIOUS_DEFAULT_HOMEWORK_TEXT = (
    "Uy vazifasi bo'yicha xabar\n\n"
    "O'quvchi: {student}\n"
    "Holat: {template}\n"
    "Guruh: {group}\n"
    "Kurs: {course}\n"
    "Jadval: {schedule}"
)

PREVIOUS_DEFAULT_PAYMENT_TEXT = (
    "To'lov eslatmasi\n\n"
    "O'quvchi: {student}\n"
    "Holat: {template}\n"
    "Guruh: {group}\n"
    "Kurs: {course}\n"
    "Oylik: {monthly_fee}"
)

DEFAULT_WELCOME_TEXT = (
    "✨ Assalomu alaykum, {parent}!\n\n"
    "🎓 {student} uchun ota-ona paneli tayyor.\n\n"
    "📚 Guruh: {group}\n"
    "🧭 Kurs: {course}\n"
    "🗓 Jadval: {schedule}\n"
    "👨‍🏫 O'qituvchi: {teacher}\n"
    "🚪 Xona: {room}\n\n"
    "⬇️ Pastdagi tugmalar orqali jadval, vazifa, baho, to'lov va davomatni bir bosishda ochishingiz mumkin."
)

DEFAULT_ATTENDANCE_TEXT = (
    "📊 Davomat yangilandi\n\n"
    "👤 O'quvchi: {student}\n"
    "🧾 Holat: {template}\n"
    "📚 Guruh: {group}\n"
    "🗓 Jadval: {schedule}\n"
    "👨‍🏫 O'qituvchi: {teacher}"
)

DEFAULT_HOMEWORK_TEXT = (
    "📝 Uy vazifasi va baho bo'yicha xabar\n\n"
    "👤 O'quvchi: {student}\n"
    "🎯 Holat: {template}\n"
    "📚 Guruh: {group}\n"
    "🧭 Kurs: {course}\n"
    "🗓 Jadval: {schedule}"
)

DEFAULT_PAYMENT_TEXT = (
    "💳 To'lov eslatmasi\n\n"
    "👤 O'quvchi: {student}\n"
    "🧾 Holat: {template}\n"
    "📚 Guruh: {group}\n"
    "🧭 Kurs: {course}\n"
    "💰 Oylik: {monthly_fee}"
)

LEGACY_WELCOME_TEXT = (
    "Salom, {parent}. Siz {student} uchun ota-ona akkaunti sifatida ulandingiz.\n"
    "Guruh: {group}\n"
    "Kurs: {course}\n"
    "Jadval: {schedule}\n"
    "O'qituvchi: {teacher}"
)

LEGACY_ATTENDANCE_TEXT = (
    "{student} bo'yicha davomat xabari.\n"
    "Holat: {template}\n"
    "Guruh: {group}\n"
    "Jadval: {schedule}"
)

LEGACY_HOMEWORK_TEXT = (
    "{student} bo'yicha uy vazifasi ogohlantirishi.\n"
    "Holat: {template}\n"
    "Guruh: {group}"
)

LEGACY_PAYMENT_TEXT = (
    "{student} bo'yicha to'lov eslatmasi.\n"
    "Holat: {template}\n"
    "Guruh: {group}\n"
    "Kurs: {course}"
)

GENERIC_START_TEXT = (
    "Assalomu alaykum.\n\n"
    "Bot ishlayapti, lekin akkauntni bog'lash uchun markaz yuborgan maxsus link orqali kirish kerak.\n"
    "Iltimos, admin yoki o'qituvchi bergan bot linkini qayta ochib Start bosing."
)

PARENT_REPLY_BUTTONS = (
    (("📚 Guruh va kurs", "group"), ("🗓 Dars jadvali", "schedule")),
    (("📝 Vazifa va baho", "homework"), ("💳 To'lov", "payment")),
    (("📊 Davomat", "attendance"), ("✨ Yangilash", "overview")),
)
PARENT_BUTTON_TO_ACTION = {
    text: action
    for row in PARENT_REPLY_BUTTONS
    for text, action in row
}
PARENT_MENU_COMMANDS = {"/menu", "menu", "/panel", "panel", "/start"}
CALLBACK_LOCK_TTL_SECONDS = 3.0
CALLBACK_LOCKS: dict[str, float] = {}
TELEGRAM_SEND_TIMEOUT_SECONDS = 10
TELEGRAM_POLL_TIMEOUT_SECONDS = 20
TELEGRAM_POLL_IDLE_SLEEP_SECONDS = 0.2

PREMIUM_WELCOME_TEXT = (
    "\u2728 Assalomu alaykum, {parent}!\n\n"
    "\U0001F393 {student} uchun ota-ona paneli tayyor.\n\n"
    "\U0001F4DA Guruh: {group}\n"
    "\U0001F9ED Kurs: {course}\n"
    "\U0001F4C5 Jadval: {schedule}\n"
    "\U0001F468 O'qituvchi: {teacher}\n"
    "\U0001F6AA Xona: {room}\n\n"
    "\u2B07\uFE0F Pastdagi tugmalar orqali jadval, vazifa, baho, to'lov va davomatni bir bosishda ochishingiz mumkin."
)
PREMIUM_ATTENDANCE_TEXT = (
    "\U0001F4CA Davomat yangilandi\n\n"
    "\U0001F464 O'quvchi: {student}\n"
    "\U0001F9FE Holat: {template}\n"
    "\U0001F4DA Guruh: {group}\n"
    "\U0001F4C5 Jadval: {schedule}\n"
    "\U0001F468 O'qituvchi: {teacher}"
)
PREMIUM_HOMEWORK_TEXT = (
    "\U0001F4DD Uy vazifasi va baho bo'yicha xabar\n\n"
    "\U0001F464 O'quvchi: {student}\n"
    "\U0001F3AF Holat: {template}\n"
    "\U0001F4DA Guruh: {group}\n"
    "\U0001F9ED Kurs: {course}\n"
    "\U0001F4C5 Jadval: {schedule}"
)
PREMIUM_PAYMENT_TEXT = (
    "\U0001F4B3 To'lov eslatmasi\n\n"
    "\U0001F464 O'quvchi: {student}\n"
    "\U0001F9FE Holat: {template}\n"
    "\U0001F4DA Guruh: {group}\n"
    "\U0001F9ED Kurs: {course}\n"
    "\U0001F4B0 Oylik: {monthly_fee}"
)
PREMIUM_GENERIC_START_TEXT = (
    "\u2728 Assalomu alaykum.\n\n"
    "Bot ishlayapti, lekin akkauntni bog'lash uchun markaz yuborgan maxsus link orqali kirish kerak.\n"
    "Iltimos, admin yoki o'qituvchi bergan maxsus bot linkini qayta ochib Start bosing."
)
PREMIUM_PARENT_REPLY_BUTTONS = (
    (("\U0001F4DA Guruh va kurs", "group"), ("\U0001F4C5 Dars jadvali", "schedule")),
    (("\U0001F4DD Vazifa va baho", "homework"), ("\U0001F4B3 To'lov", "payment")),
    (("\U0001F4CA Davomat", "attendance"), ("\u2728 Yangilash", "overview")),
)

DEFAULT_WELCOME_TEXT = PREMIUM_WELCOME_TEXT
DEFAULT_ATTENDANCE_TEXT = PREMIUM_ATTENDANCE_TEXT
DEFAULT_HOMEWORK_TEXT = PREMIUM_HOMEWORK_TEXT
DEFAULT_PAYMENT_TEXT = PREMIUM_PAYMENT_TEXT
GENERIC_START_TEXT = PREMIUM_GENERIC_START_TEXT
PARENT_REPLY_BUTTONS = PREMIUM_PARENT_REPLY_BUTTONS
PARENT_BUTTON_TO_ACTION = {
    text: action
    for row in PARENT_REPLY_BUTTONS
    for text, action in row
}


class SafeFormatDict(dict[str, str]):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _resolved_text(value: str | None, *, default: str, legacy_values: tuple[str, ...]) -> str:
    normalized = str(value or "").strip()
    if not normalized or normalized in legacy_values:
        return default

    return normalized


def _resolved_image(value: str | None, *, default: str) -> str:
    normalized = str(value or "").strip()
    return normalized or default


def _normalize_bot_username(value: str | None) -> str | None:
    normalized = str(value or "").strip().removeprefix("@")
    return normalized or None


def _environment_bot_username() -> str | None:
    return _normalize_bot_username(get_settings().telegram_bot_username)


def _environment_bot_token() -> str | None:
    normalized = str(get_settings().telegram_bot_token or "").strip()
    return normalized or None


def _has_bot_token(settings: TelegramBotSettings) -> bool:
    return bool(_environment_bot_token() or settings.bot_token_cipher)


def _bot_token_for_settings(settings: TelegramBotSettings) -> str:
    env_token = _environment_bot_token()
    if env_token:
        return env_token

    if not settings.bot_token_cipher:
        raise ValueError("Telegram bot hali sozlanmagan.")

    return decrypt_secret(settings.bot_token_cipher)


def _apply_environment_telegram_defaults(settings: TelegramBotSettings) -> bool:
    bot_username = _environment_bot_username()
    bot_token = _environment_bot_token()
    changed = False

    if bot_username and settings.bot_username != bot_username:
        settings.bot_username = bot_username
        changed = True

    if bot_token and not settings.bot_token_cipher:
        settings.bot_token_cipher = encrypt_secret(bot_token)
        settings.enabled = True
        changed = True

    return changed


def get_or_create_telegram_settings(db: Session) -> TelegramBotSettings:
    settings = db.get(TelegramBotSettings, SETTINGS_ID)

    if settings:
        if _apply_environment_telegram_defaults(settings):
            db.commit()
            db.refresh(settings)
        return settings

    settings = TelegramBotSettings(
        id=SETTINGS_ID,
        enabled=False,
        welcome_text=DEFAULT_WELCOME_TEXT,
        attendance_template=DEFAULT_ATTENDANCE_TEXT,
        homework_template=DEFAULT_HOMEWORK_TEXT,
        payment_template=DEFAULT_PAYMENT_TEXT,
        last_update_id=0,
    )
    _apply_environment_telegram_defaults(settings)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def telegram_settings_payload(db: Session) -> dict[str, object]:
    settings = get_or_create_telegram_settings(db)
    return {
        "enabled": settings.enabled,
        "botUsername": settings.bot_username or _environment_bot_username(),
        "hasBotToken": _has_bot_token(settings),
        "welcomeText": _resolved_text(settings.welcome_text, default=DEFAULT_WELCOME_TEXT, legacy_values=(LEGACY_WELCOME_TEXT, PREVIOUS_DEFAULT_WELCOME_TEXT)),
        "welcomeImageUrl": _resolved_image(settings.welcome_image_url, default=DEFAULT_WELCOME_IMAGE),
        "notificationImageUrl": _resolved_image(settings.notification_image_url, default=DEFAULT_NOTIFICATION_IMAGE),
        "attendanceTemplate": _resolved_text(settings.attendance_template, default=DEFAULT_ATTENDANCE_TEXT, legacy_values=(LEGACY_ATTENDANCE_TEXT, PREVIOUS_DEFAULT_ATTENDANCE_TEXT)),
        "homeworkTemplate": _resolved_text(settings.homework_template, default=DEFAULT_HOMEWORK_TEXT, legacy_values=(LEGACY_HOMEWORK_TEXT, PREVIOUS_DEFAULT_HOMEWORK_TEXT)),
        "paymentTemplate": _resolved_text(settings.payment_template, default=DEFAULT_PAYMENT_TEXT, legacy_values=(LEGACY_PAYMENT_TEXT, PREVIOUS_DEFAULT_PAYMENT_TEXT)),
        "lastUpdateId": settings.last_update_id,
    }


def update_telegram_settings(db: Session, payload: dict[str, object]) -> dict[str, object]:
    settings = get_or_create_telegram_settings(db)
    settings.enabled = bool(payload.get("enabled", settings.enabled))
    settings.bot_username = str(payload.get("botUsername") or "").strip().removeprefix("@") or None
    settings.welcome_text = _resolved_text(str(payload.get("welcomeText") or "").strip(), default=DEFAULT_WELCOME_TEXT, legacy_values=(LEGACY_WELCOME_TEXT, PREVIOUS_DEFAULT_WELCOME_TEXT))
    settings.welcome_image_url = _resolved_image(str(payload.get("welcomeImageUrl") or "").strip(), default=DEFAULT_WELCOME_IMAGE)
    settings.notification_image_url = _resolved_image(str(payload.get("notificationImageUrl") or "").strip(), default=DEFAULT_NOTIFICATION_IMAGE)
    settings.attendance_template = _resolved_text(str(payload.get("attendanceTemplate") or "").strip(), default=DEFAULT_ATTENDANCE_TEXT, legacy_values=(LEGACY_ATTENDANCE_TEXT, PREVIOUS_DEFAULT_ATTENDANCE_TEXT))
    settings.homework_template = _resolved_text(str(payload.get("homeworkTemplate") or "").strip(), default=DEFAULT_HOMEWORK_TEXT, legacy_values=(LEGACY_HOMEWORK_TEXT, PREVIOUS_DEFAULT_HOMEWORK_TEXT))
    settings.payment_template = _resolved_text(str(payload.get("paymentTemplate") or "").strip(), default=DEFAULT_PAYMENT_TEXT, legacy_values=(LEGACY_PAYMENT_TEXT, PREVIOUS_DEFAULT_PAYMENT_TEXT))

    bot_token = str(payload.get("botToken") or "").strip()
    if bot_token:
        settings.bot_token_cipher = encrypt_secret(bot_token)

    db.commit()
    db.refresh(settings)
    return telegram_settings_payload(db)


def build_parent_connect_url(bot_username: str | None, student_id: str) -> str | None:
    resolved_bot_username = _normalize_bot_username(bot_username) or _environment_bot_username()
    if not resolved_bot_username:
        return None

    return f"https://t.me/{resolved_bot_username}?start=parent_{student_id}"


def render_template_message(
    template: str,
    student: Student,
    fallback: str,
    extra_context: dict[str, object] | None = None,
) -> str:
    group = student.group.name if student.group else "Biriktirilmagan"
    course = student.course.title if student.course else "Biriktirilmagan"
    schedule = student.group.schedule_label if student.group else "Jadval biriktirilmagan"
    teacher = student.group.teacher.full_name if student.group and student.group.teacher else "Biriktirilmagan"
    room = student.group.room if student.group and student.group.room else "Biriktirilmagan"
    values: dict[str, str] = {
        "student": student.full_name,
        "parent": student.parent_name,
        "group": group,
        "course": course,
        "schedule": schedule,
        "teacher": teacher,
        "room": room,
        "template": fallback,
        "monthly_fee": money_to_text(student.monthly_fee or 0),
    }

    for key, value in (extra_context or {}).items():
        values[key] = str(value)

    return template.format_map(SafeFormatDict(values))


def _build_parent_inline_keyboard(student: Student) -> dict[str, list[list[dict[str, str]]]]:
    return _build_parent_inline_keyboard_with_state(student)


def _build_parent_inline_keyboard_with_state(
    student: Student,
    *,
    loading_action: str | None = None,
) -> dict[str, object]:
    return {
        "keyboard": [
            [
                {
                    "text": text,
                }
                for text, action in row
            ]
            for row in PARENT_REPLY_BUTTONS
        ],
        "resize_keyboard": True,
        "is_persistent": True,
        "input_field_placeholder": f"📌 {student.full_name} bo'yicha bo'limni tanlang",
    }


def _build_parent_inline_keyboard_with_state(
    student: Student,
    *,
    loading_action: str | None = None,
) -> dict[str, object]:
    return {
        "keyboard": [
            [
                {
                    "text": text,
                }
                for text, action in row
            ]
            for row in PARENT_REPLY_BUTTONS
        ],
        "resize_keyboard": True,
        "is_persistent": True,
        "input_field_placeholder": f"\U0001F4CC {student.full_name} bo'yicha bo'limni tanlang",
    }


def _callback_lock_key(chat_id: str, student_id: str) -> str:
    return f"{chat_id}:{student_id}"


def _is_callback_locked(key: str) -> bool:
    locked_until = CALLBACK_LOCKS.get(key, 0)
    if locked_until <= monotonic():
        CALLBACK_LOCKS.pop(key, None)
        return False

    return True


def _lock_callback(key: str) -> None:
    CALLBACK_LOCKS[key] = monotonic() + CALLBACK_LOCK_TTL_SECONDS


def _unlock_callback(key: str) -> None:
    CALLBACK_LOCKS.pop(key, None)


def _student_load_options() -> tuple[object, ...]:
    return (
        selectinload(Student.group).selectinload(Group.teacher),
        selectinload(Student.course),
        selectinload(Student.attendances),
        selectinload(Student.payments),
        selectinload(Student.homework_items),
    )


def _find_student_by_chat_id(db: Session, chat_id: str) -> Student | None:
    return db.scalar(
        select(Student)
        .options(*_student_load_options())
        .where(Student.parent_telegram_chat_id == chat_id)
    )


def _telegram_request(
    token: str,
    method: str,
    payload: dict[str, object],
    *,
    timeout: float = TELEGRAM_SEND_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    request = Request(
        url=f"https://api.telegram.org/bot{token}/{method}",
        data=urlencode({key: json.dumps(value) if isinstance(value, (dict, list)) else str(value) for key, value in payload.items()}).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        data = json.loads(response.read().decode("utf-8"))

    if not data.get("ok"):
        raise ValueError(str(data.get("description") or "Telegram so'rovida xatolik yuz berdi."))

    return data


def _multipart_request(
    token: str,
    method: str,
    payload: dict[str, object],
    *,
    file_field: str,
    filename: str,
    file_content: bytes,
    content_type: str,
    timeout: float = TELEGRAM_SEND_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    boundary = f"----kursboshqaruv{uuid4().hex}"
    body = bytearray()

    for key, value in payload.items():
        encoded_value = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
        body.extend(encoded_value.encode("utf-8"))
        body.extend(b"\r\n")

    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_content)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    request = Request(
        url=f"https://api.telegram.org/bot{token}/{method}",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        data = json.loads(response.read().decode("utf-8"))

    if not data.get("ok"):
        raise ValueError(str(data.get("description") or "Telegram so'rovida xatolik yuz berdi."))

    return data


def _resolve_local_image(image_source: str | None) -> tuple[str, bytes, str] | None:
    normalized = str(image_source or "").strip()
    if not normalized:
        return None

    path = BUILTIN_IMAGE_MAP.get(normalized)
    if path is None:
        candidate = Path(normalized)
        path = candidate if candidate.exists() else None

    if path is None or not path.exists():
        return None

    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return path.name, path.read_bytes(), mime_type


def _send_message(
    token: str,
    chat_id: str,
    text: str,
    image_source: str | None = None,
    *,
    reply_markup: dict[str, object] | None = None,
) -> None:
    local_image = _resolve_local_image(image_source)
    if local_image:
        filename, file_content, content_type = local_image
        _multipart_request(
            token,
            "sendPhoto",
            {
                "chat_id": chat_id,
                "caption": text,
                **({"reply_markup": reply_markup} if reply_markup else {}),
            },
            file_field="photo",
            filename=filename,
            file_content=file_content,
            content_type=content_type,
        )
        return

    if image_source:
        _telegram_request(
            token,
            "sendPhoto",
            {
                "chat_id": chat_id,
                "photo": image_source,
                "caption": text,
                **({"reply_markup": reply_markup} if reply_markup else {}),
            },
        )
        return

    _telegram_request(
        token,
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            **({"reply_markup": reply_markup} if reply_markup else {}),
        },
    )


def _payment_status_text(status: str) -> str:
    mapping = {
        PaymentStatus.PAID.value: "To'langan",
        PaymentStatus.UNPAID.value: "To'lanmagan",
        PaymentStatus.PARTIAL.value: "Qisman to'langan",
        PaymentStatus.OVERDUE.value: "Muddati o'tgan",
    }
    return mapping.get(status, status)


def _payment_status_emoji(status: str) -> str:
    mapping = {
        PaymentStatus.PAID.value: "🟢",
        PaymentStatus.UNPAID.value: "⚪",
        PaymentStatus.PARTIAL.value: "🟡",
        PaymentStatus.OVERDUE.value: "🔴",
    }
    return mapping.get(status, "🔹")


def _attendance_status_text(status: str) -> str:
    mapping = {
        "present": "Darsda qatnashgan",
        "absent": "Darsga kelmagan",
        "late": "Darsga kechikkan",
        "excused": "Sababli kelmagan",
        "not_prepared": "Darsga tayyor emas",
        "homework_not_done": "Uy vazifasi qilinmagan",
    }
    return mapping.get(status, status)


def _attendance_status_emoji(status: str) -> str:
    mapping = {
        "present": "🟢",
        "absent": "🔴",
        "late": "🟡",
        "excused": "🔵",
        "not_prepared": "🟠",
        "homework_not_done": "🟣",
    }
    return mapping.get(status, "🔹")


def _date_text(value: Any) -> str:
    if hasattr(value, "strftime"):
        return value.strftime("%d.%m.%Y")
    return str(value)


def _homework_score_badge(score: int | None) -> str:
    if score is None:
        return "⚪ Baholanmagan"
    if score >= 90:
        return f"🏆 {score}% | A'lo"
    if score >= 75:
        return f"🌟 {score}% | Yaxshi"
    if score >= 60:
        return f"📘 {score}% | O'rta"
    return f"⚠️ {score}% | Diqqat"


def _latest_payment(student: Student):
    return sorted(student.payments, key=lambda item: (item.due_date.isoformat(), item.created_at.isoformat()), reverse=True)[0] if student.payments else None


def _latest_homeworks(student: Student) -> list[str]:
    items = sorted(student.homework_items, key=lambda item: item.due_date.isoformat(), reverse=True)[:3]
    lines: list[str] = []

    for index, item in enumerate(items, start=1):
        status_text = {
            "pending": "🕒 Jarayonda",
            "done": "✅ Topshirildi",
            "late": "⏰ Kechikkan",
        }.get(item.status, item.status)
        lines.append(f"{index}. {item.title}\n   📅 {_date_text(item.due_date)} | {status_text}")

    return lines


def _latest_homework_scores(student: Student) -> list[str]:
    rows = [
        item
        for item in sorted(student.attendances, key=lambda row: (row.session_date.isoformat(), row.created_at.isoformat()), reverse=True)
        if item.homework_score is not None
    ][:3]

    lines: list[str] = []
    for index, row in enumerate(rows, start=1):
        topic_text = f" | 📘 {row.lesson_topic}" if row.lesson_topic else ""
        lines.append(f"{index}. {_homework_score_badge(row.homework_score)} | 📅 {_date_text(row.session_date)}{topic_text}")
    return lines


def _latest_topic(student: Student) -> str | None:
    rows = sorted(student.attendances, key=lambda item: (item.session_date.isoformat(), item.created_at.isoformat()), reverse=True)
    for row in rows:
        if row.lesson_topic:
            return row.lesson_topic

    return None


def _build_group_summary(student: Student) -> str:
    group = student.group.name if student.group else "Biriktirilmagan"
    course = student.course.title if student.course else "Biriktirilmagan"
    teacher = student.group.teacher.full_name if student.group and student.group.teacher else "Biriktirilmagan"
    room = student.group.room if student.group and student.group.room else "Biriktirilmagan"

    return (
        "📚 Guruh va kurs\n\n"
        f"👤 O'quvchi: {student.full_name}\n"
        f"🏫 Guruh: {group}\n"
        f"🧭 Kurs: {course}\n"
        f"👨‍🏫 O'qituvchi: {teacher}\n"
        f"🚪 Xona: {room}\n"
        f"💰 Oylik: {money_to_text(student.monthly_fee or 0)}"
    )


def _build_schedule_summary(student: Student) -> str:
    schedule = student.group.schedule_label if student.group else "Jadval biriktirilmagan"
    topic = _latest_topic(student)
    body = [
        "🗓 Dars jadvali",
        "",
        f"👤 O'quvchi: {student.full_name}",
        f"⏰ Jadval: {schedule}",
    ]

    if student.group and student.group.room:
        body.append(f"🚪 Xona: {student.group.room}")
    if topic:
        body.append(f"📘 So'nggi mavzu: {topic}")

    return "\n".join(body)


def _build_homework_summary(student: Student) -> str:
    lines = _latest_homeworks(student)
    score_lines = _latest_homework_scores(student)
    if not lines and not score_lines:
        return (
            "📝 Vazifa va baholar\n\n"
            f"👤 {student.full_name} uchun hozircha vazifa yoki baho topilmadi."
        )

    topic = _latest_topic(student)
    header = "📝 Vazifa va baholar\n\n"
    if topic:
        header += f"📘 So'nggi mavzu: {topic}\n\n"

    sections: list[str] = [header.rstrip()]
    if lines:
        sections.append("📌 Topshiriqlar:\n" + "\n".join(lines))
    if score_lines:
        sections.append("🎯 So'nggi foizlar:\n" + "\n".join(score_lines))

    return "\n\n".join(sections)


def _build_payment_summary(student: Student) -> str:
    payment = _latest_payment(student)
    if not payment:
        return (
            "💳 To'lov holati\n\n"
            f"👤 {student.full_name} uchun hali to'lov yozuvi kiritilmagan."
        )

    remaining_amount = payment_remaining_amount(student.monthly_fee or 0, payment.amount)
    status_note = payment_status_note_for_values(student.monthly_fee or 0, payment.amount, payment.due_date)

    return (
        "💳 To'lov holati\n\n"
        f"👤 O'quvchi: {student.full_name}\n"
        f"🗓 Oy: {payment.month_label}\n"
        f"{_payment_status_emoji(payment.status.value)} Holat: {status_note}\n"
        f"💸 To'langan: {money_to_text(Decimal(payment.amount))}\n"
        f"📌 Qolgan qarz: {money_to_text(remaining_amount)}\n"
        f"⏳ Muddat: {_date_text(payment.due_date)}"
    )


def _build_attendance_summary(student: Student) -> str:
    latest_attendance = sorted(student.attendances, key=lambda item: (item.session_date.isoformat(), item.created_at.isoformat()), reverse=True)[0] if student.attendances else None
    if not latest_attendance:
        return (
            "📊 Davomat holati\n\n"
            f"👤 {student.full_name} uchun hozircha davomat yozuvi topilmadi."
        )

    attendance_percent = attendance_percent_for_student(student)
    lines = [
        "📊 Davomat holati",
        "",
        f"👤 O'quvchi: {student.full_name}",
        f"📅 Sana: {_date_text(latest_attendance.session_date)}",
        f"{_attendance_status_emoji(latest_attendance.status.value)} Holat: {_attendance_status_text(latest_attendance.status.value)}",
        f"📈 Umumiy davomat: {attendance_percent}%",
    ]

    if latest_attendance.lesson_topic:
        lines.append(f"📘 Mavzu: {latest_attendance.lesson_topic}")
    if latest_attendance.comment:
        lines.append(f"🗒 Izoh: {latest_attendance.comment}")
    if latest_attendance.homework_score is not None:
        lines.append(f"🎯 Uy vazifasi bahosi: {_homework_score_badge(latest_attendance.homework_score)}")
    if latest_attendance.homework_comment:
        lines.append(f"💬 Vazifa izohi: {latest_attendance.homework_comment}")

    return "\n".join(lines)


def _build_overview_summary(student: Student) -> str:
    latest_payment = _latest_payment(student)
    latest_topic = _latest_topic(student) or "Hozircha saqlanmagan"
    schedule = student.group.schedule_label if student.group else "Jadval biriktirilmagan"
    payment_text = "Hali to'lov yozuvi yo'q"

    if latest_payment:
        payment_text = f"{latest_payment.month_label} | {_payment_status_emoji(latest_payment.status.value)} {_payment_status_text(latest_payment.status.value)}"

    return (
        "✨ Ota-ona paneli\n\n"
        f"👤 O'quvchi: {student.full_name}\n"
        f"🏫 Guruh: {student.group.name if student.group else 'Biriktirilmagan'}\n"
        f"⏰ Jadval: {schedule}\n"
        f"📘 So'nggi mavzu: {latest_topic}\n"
        f"💳 To'lov: {payment_text}\n\n"
        "⬇️ Pastdagi tugmalar orqali kerakli bo'limni ochishingiz mumkin."
    )


def _payment_status_emoji(status: str) -> str:
    mapping = {
        PaymentStatus.PAID.value: "\U0001F7E2",
        PaymentStatus.UNPAID.value: "\u26AA",
        PaymentStatus.PARTIAL.value: "\U0001F7E1",
        PaymentStatus.OVERDUE.value: "\U0001F534",
    }
    return mapping.get(status, "\U0001F539")


def _attendance_status_emoji(status: str) -> str:
    mapping = {
        "present": "\U0001F7E2",
        "absent": "\U0001F534",
        "late": "\U0001F7E1",
        "excused": "\U0001F535",
        "not_prepared": "\U0001F7E0",
        "homework_not_done": "\U0001F7E3",
    }
    return mapping.get(status, "\U0001F539")


def _date_text(value: Any) -> str:
    if hasattr(value, "strftime"):
        return value.strftime("%d.%m.%Y")
    return str(value)


def _homework_score_badge(score: int | None) -> str:
    if score is None:
        return "\u26AA Baholanmagan"
    if score >= 90:
        return f"\U0001F3C6 {score}% | A'lo"
    if score >= 75:
        return f"\U0001F31F {score}% | Yaxshi"
    if score >= 60:
        return f"\U0001F4D8 {score}% | O'rta"
    return f"\u26A0\uFE0F {score}% | Diqqat"


def _latest_homeworks(student: Student) -> list[str]:
    items = sorted(student.homework_items, key=lambda item: item.due_date.isoformat(), reverse=True)[:3]
    lines: list[str] = []

    for index, item in enumerate(items, start=1):
        status_text = {
            "pending": "\U0001F552 Jarayonda",
            "done": "\u2705 Topshirildi",
            "late": "\u23F0 Kechikkan",
        }.get(item.status, item.status)
        lines.append(f"{index}. {item.title}\n   \U0001F4C5 {_date_text(item.due_date)} | {status_text}")

    return lines


def _latest_homework_scores(student: Student) -> list[str]:
    rows = [
        item
        for item in sorted(student.attendances, key=lambda row: (row.session_date.isoformat(), row.created_at.isoformat()), reverse=True)
        if item.homework_score is not None
    ][:3]

    lines: list[str] = []
    for index, row in enumerate(rows, start=1):
        topic_text = f" | \U0001F4D8 {row.lesson_topic}" if row.lesson_topic else ""
        lines.append(f"{index}. {_homework_score_badge(row.homework_score)} | \U0001F4C5 {_date_text(row.session_date)}{topic_text}")

    return lines


def _build_group_summary(student: Student) -> str:
    group = student.group.name if student.group else "Biriktirilmagan"
    course = student.course.title if student.course else "Biriktirilmagan"
    teacher = student.group.teacher.full_name if student.group and student.group.teacher else "Biriktirilmagan"
    room = student.group.room if student.group and student.group.room else "Biriktirilmagan"

    return (
        "\U0001F4DA Guruh va kurs\n\n"
        f"\U0001F464 O'quvchi: {student.full_name}\n"
        f"\U0001F3EB Guruh: {group}\n"
        f"\U0001F9ED Kurs: {course}\n"
        f"\U0001F468 O'qituvchi: {teacher}\n"
        f"\U0001F6AA Xona: {room}\n"
        f"\U0001F4B0 Oylik: {money_to_text(student.monthly_fee or 0)}"
    )


def _build_schedule_summary(student: Student) -> str:
    schedule = student.group.schedule_label if student.group else "Jadval biriktirilmagan"
    topic = _latest_topic(student)
    body = [
        "\U0001F4C5 Dars jadvali",
        "",
        f"\U0001F464 O'quvchi: {student.full_name}",
        f"\u23F0 Jadval: {schedule}",
    ]

    if student.group and student.group.room:
        body.append(f"\U0001F6AA Xona: {student.group.room}")
    if topic:
        body.append(f"\U0001F4D8 So'nggi mavzu: {topic}")

    return "\n".join(body)


def _build_homework_summary(student: Student) -> str:
    lines = _latest_homeworks(student)
    score_lines = _latest_homework_scores(student)
    if not lines and not score_lines:
        return (
            "\U0001F4DD Vazifa va baholar\n\n"
            f"\U0001F464 {student.full_name} uchun hozircha vazifa yoki baho topilmadi."
        )

    topic = _latest_topic(student)
    header = "\U0001F4DD Vazifa va baholar\n\n"
    if topic:
        header += f"\U0001F4D8 So'nggi mavzu: {topic}\n\n"

    sections: list[str] = [header.rstrip()]
    if lines:
        sections.append("\U0001F4CC Topshiriqlar:\n" + "\n".join(lines))
    if score_lines:
        sections.append("\U0001F3AF So'nggi foizlar:\n" + "\n".join(score_lines))

    return "\n\n".join(sections)


def _build_payment_summary(student: Student) -> str:
    payment = _latest_payment(student)
    if not payment:
        return (
            "\U0001F4B3 To'lov holati\n\n"
            f"\U0001F464 {student.full_name} uchun hali to'lov yozuvi kiritilmagan."
        )

    remaining_amount = payment_remaining_amount(student.monthly_fee or 0, payment.amount)
    status_note = payment_status_note_for_values(student.monthly_fee or 0, payment.amount, payment.due_date)

    return (
        "\U0001F4B3 To'lov holati\n\n"
        f"\U0001F464 O'quvchi: {student.full_name}\n"
        f"\U0001F4C5 Oy: {payment.month_label}\n"
        f"{_payment_status_emoji(payment.status.value)} Holat: {status_note}\n"
        f"\U0001F4B8 To'langan: {money_to_text(Decimal(payment.amount))}\n"
        f"\U0001F4CC Qolgan qarz: {money_to_text(remaining_amount)}\n"
        f"\u23F3 Muddat: {_date_text(payment.due_date)}"
    )


def _build_attendance_summary(student: Student) -> str:
    latest_attendance = sorted(student.attendances, key=lambda item: (item.session_date.isoformat(), item.created_at.isoformat()), reverse=True)[0] if student.attendances else None
    if not latest_attendance:
        return (
            "\U0001F4CA Davomat holati\n\n"
            f"\U0001F464 {student.full_name} uchun hozircha davomat yozuvi topilmadi."
        )

    attendance_percent = attendance_percent_for_student(student)
    lines = [
        "\U0001F4CA Davomat holati",
        "",
        f"\U0001F464 O'quvchi: {student.full_name}",
        f"\U0001F4C5 Sana: {_date_text(latest_attendance.session_date)}",
        f"{_attendance_status_emoji(latest_attendance.status.value)} Holat: {_attendance_status_text(latest_attendance.status.value)}",
        f"\U0001F4C8 Umumiy davomat: {attendance_percent}%",
    ]

    if latest_attendance.lesson_topic:
        lines.append(f"\U0001F4D8 Mavzu: {latest_attendance.lesson_topic}")
    if latest_attendance.comment:
        lines.append(f"\U0001F5D2 Izoh: {latest_attendance.comment}")
    if latest_attendance.homework_score is not None:
        lines.append(f"\U0001F3AF Uy vazifasi bahosi: {_homework_score_badge(latest_attendance.homework_score)}")
    if latest_attendance.homework_comment:
        lines.append(f"\U0001F4AC Vazifa izohi: {latest_attendance.homework_comment}")

    return "\n".join(lines)


def _build_overview_summary(student: Student) -> str:
    latest_payment = _latest_payment(student)
    latest_topic = _latest_topic(student) or "Hozircha saqlanmagan"
    schedule = student.group.schedule_label if student.group else "Jadval biriktirilmagan"
    payment_text = "Hali to'lov yozuvi yo'q"

    if latest_payment:
        payment_text = f"{latest_payment.month_label} | {_payment_status_emoji(latest_payment.status.value)} {_payment_status_text(latest_payment.status.value)}"

    return (
        "\u2728 Ota-ona paneli\n\n"
        f"\U0001F464 O'quvchi: {student.full_name}\n"
        f"\U0001F3EB Guruh: {student.group.name if student.group else 'Biriktirilmagan'}\n"
        f"\u23F0 Jadval: {schedule}\n"
        f"\U0001F4D8 So'nggi mavzu: {latest_topic}\n"
        f"\U0001F4B3 To'lov: {payment_text}\n\n"
        "\u2B07\uFE0F Pastdagi tugmalar orqali kerakli bo'limni ochishingiz mumkin."
    )


def _send_parent_panel_message(
    token: str,
    settings: TelegramBotSettings,
    student: Student,
    text: str,
    *,
    image_source: str | None = None,
    loading_action: str | None = None,
) -> None:
    _send_message(
        token,
        student.parent_telegram_chat_id or "",
        text,
        image_source,
        reply_markup=_build_parent_inline_keyboard_with_state(student, loading_action=loading_action),
    )


def _clear_inline_message_buttons(token: str, chat_id: str, message_id: int) -> None:
    _telegram_request(
        token,
        "editMessageReplyMarkup",
        {
            "chat_id": chat_id,
            "message_id": message_id,
            "reply_markup": {"inline_keyboard": []},
        },
    )


def _handle_parent_callback(token: str, settings: TelegramBotSettings, student: Student, action: str) -> None:
    summary_builders = {
        "group": _build_group_summary,
        "schedule": _build_schedule_summary,
        "homework": _build_homework_summary,
        "payment": _build_payment_summary,
        "attendance": _build_attendance_summary,
        "overview": _build_overview_summary,
    }
    builder = summary_builders.get(action)
    if builder is None or not student.parent_telegram_chat_id:
        raise ValueError("Buyruq topilmadi.")

    _send_parent_panel_message(
        token,
        settings,
        student,
        builder(student),
    )


def send_student_notification(
    db: Session,
    student: Student,
    template_name: str,
    *,
    extra_context: dict[str, object] | None = None,
    custom_text: str | None = None,
    image_source: str | None = None,
) -> Notification:
    settings = get_or_create_telegram_settings(db)

    if not settings.enabled or not _has_bot_token(settings):
        raise ValueError("Telegram bot hali sozlanmagan.")
    if not student.parent_telegram_chat_id:
        raise ValueError("Ota-ona hali Telegram botga ulanmagan.")

    token = _bot_token_for_settings(settings)
    if custom_text:
        text = custom_text
    elif "to'lov" in template_name.lower():
        template = _resolved_text(settings.payment_template, default=DEFAULT_PAYMENT_TEXT, legacy_values=(LEGACY_PAYMENT_TEXT, PREVIOUS_DEFAULT_PAYMENT_TEXT))
        text = render_template_message(template, student, template_name, extra_context=extra_context)
    elif "uy vazifasi" in template_name.lower():
        template = _resolved_text(settings.homework_template, default=DEFAULT_HOMEWORK_TEXT, legacy_values=(LEGACY_HOMEWORK_TEXT, PREVIOUS_DEFAULT_HOMEWORK_TEXT))
        text = render_template_message(template, student, template_name, extra_context=extra_context)
    else:
        template = _resolved_text(settings.attendance_template, default=DEFAULT_ATTENDANCE_TEXT, legacy_values=(LEGACY_ATTENDANCE_TEXT, PREVIOUS_DEFAULT_ATTENDANCE_TEXT))
        text = render_template_message(template, student, template_name, extra_context=extra_context)
    status = NotificationStatus.SENT

    try:
        _send_parent_panel_message(
            token,
            settings,
            student,
            text,
            image_source=image_source or _resolved_image(settings.notification_image_url, default=DEFAULT_NOTIFICATION_IMAGE),
        )
    except Exception:
        status = NotificationStatus.FAILED

    notification = Notification(
        id=f"notif-{uuid4().hex[:12]}",
        student_id=student.id,
        channel="Telegram",
        template=template_name,
        recipient=student.parent_telegram_handle or student.parent_telegram_chat_id,
        status=status,
        sent_at=datetime.now(),
    )
    db.add(notification)

    return notification


def send_welcome_message(db: Session, student: Student) -> None:
    settings = get_or_create_telegram_settings(db)
    if not settings.enabled or not _has_bot_token(settings) or not student.parent_telegram_chat_id:
        return

    token = _bot_token_for_settings(settings)
    text = render_template_message(
        _resolved_text(settings.welcome_text, default=DEFAULT_WELCOME_TEXT, legacy_values=(LEGACY_WELCOME_TEXT,)),
        student,
        "Ulanish tasdiqlandi",
    )
    try:
        _send_parent_panel_message(
            token,
            settings,
            student,
            text,
            image_source=_resolved_image(settings.welcome_image_url, default=DEFAULT_WELCOME_IMAGE),
        )
    except Exception:
        return


def send_welcome_message(db: Session, student: Student) -> None:
    settings = get_or_create_telegram_settings(db)
    if not settings.enabled or not _has_bot_token(settings) or not student.parent_telegram_chat_id:
        return

    token = _bot_token_for_settings(settings)
    text = render_template_message(
        _resolved_text(settings.welcome_text, default=DEFAULT_WELCOME_TEXT, legacy_values=(LEGACY_WELCOME_TEXT, PREVIOUS_DEFAULT_WELCOME_TEXT)),
        student,
        "Ulanish tasdiqlandi",
    )
    try:
        _send_parent_panel_message(
            token,
            settings,
            student,
            text,
            image_source=_resolved_image(settings.welcome_image_url, default=DEFAULT_WELCOME_IMAGE),
        )
    except Exception:
        return


def sync_telegram_updates(db: Session, *, timeout_seconds: int = 0) -> dict[str, int]:
    settings = get_or_create_telegram_settings(db)
    if not settings.enabled or not _has_bot_token(settings):
        raise ValueError("Telegram bot hali sozlanmagan.")

    token = _bot_token_for_settings(settings)
    payload: dict[str, object] = {"timeout": timeout_seconds, "allowed_updates": ["message", "callback_query"]}
    if settings.last_update_id:
        payload["offset"] = settings.last_update_id

    response = _telegram_request(
        token,
        "getUpdates",
        payload,
        timeout=max(TELEGRAM_SEND_TIMEOUT_SECONDS, timeout_seconds + 5),
    )
    updates = response.get("result", [])
    connected = 0

    for item in updates:
        update_id = int(item.get("update_id") or 0)
        if update_id >= settings.last_update_id:
            settings.last_update_id = update_id + 1

        callback_query = item.get("callback_query") or {}
        if callback_query:
            data = str(callback_query.get("data") or "").strip()
            callback_id = str(callback_query.get("id") or "")
            message = callback_query.get("message") or {}
            chat = message.get("chat") or {}
            chat_id = str(chat.get("id") or "")
            message_id = int(message.get("message_id") or 0)

            if message_id:
                try:
                    _clear_inline_message_buttons(token, chat_id, message_id)
                except Exception:
                    pass

            student: Student | None = None
            if data.startswith("parent:"):
                parts = data.split(":", 2)
                if len(parts) == 3:
                    student = db.get(Student, parts[2], options=_student_load_options())

            if student is None:
                student = _find_student_by_chat_id(db, chat_id)

            if callback_id:
                _telegram_request(
                    token,
                    "answerCallbackQuery",
                    {
                        "callback_query_id": callback_id,
                        "text": "Eski inline tugma o'chirildi. Pastdagi keyboarddan foydalaning.",
                    },
                )

            if student and student.parent_telegram_chat_id == chat_id:
                try:
                    _send_parent_panel_message(
                        token,
                        settings,
                        student,
                        _build_overview_summary(student),
                        image_source=_resolved_image(settings.welcome_image_url, default=DEFAULT_WELCOME_IMAGE),
                    )
                except Exception:
                    try:
                        _send_message(token, chat_id, "Pastdagi keyboard tugmalaridan foydalaning yoki /menu deb yozing.")
                    except Exception:
                        pass
            else:
                try:
                    _send_message(token, chat_id, "Inline tugmalar o'chirildi. /menu deb yozing.")
                except Exception:
                    pass
            continue

        message = item.get("message") or {}
        text = str(message.get("text") or "").strip()
        chat = message.get("chat") or {}
        from_user = message.get("from") or {}
        chat_id = str(chat.get("id") or "")

        if text == "/start":
            linked_student = _find_student_by_chat_id(db, chat_id)
            if linked_student:
                _send_parent_panel_message(
                    token,
                    settings,
                    linked_student,
                    _build_overview_summary(linked_student),
                    image_source=_resolved_image(settings.welcome_image_url, default=DEFAULT_WELCOME_IMAGE),
                )
            else:
                _send_message(token, chat_id, GENERIC_START_TEXT)
            continue

        if not text.startswith("/start "):
            student = _find_student_by_chat_id(db, chat_id)
            action = PARENT_BUTTON_TO_ACTION.get(text)

            if student and text.lower() in PARENT_MENU_COMMANDS:
                _send_parent_panel_message(
                    token,
                    settings,
                    student,
                    _build_overview_summary(student),
                    image_source=_resolved_image(settings.welcome_image_url, default=DEFAULT_WELCOME_IMAGE),
                )
                continue

            if not student or not action:
                if student:
                    _send_message(token, chat_id, "Pastdagi keyboard tugmalaridan foydalaning yoki /menu deb yozing.")
                continue

            lock_key = _callback_lock_key(chat_id, student.id)
            if _is_callback_locked(lock_key):
                _send_message(token, chat_id, "Oldingi so'rov bajarilmoqda. Bir oz kuting.")
                continue

            _lock_callback(lock_key)
            try:
                _handle_parent_callback(token, settings, student, action)
            except Exception:
                try:
                    _send_parent_panel_message(
                        token,
                        settings,
                        student,
                        "So'rovni bajarib bo'lmadi. Bir ozdan keyin qayta urinib ko'ring.",
                        image_source=_resolved_image(settings.notification_image_url, default=DEFAULT_NOTIFICATION_IMAGE),
                    )
                except Exception:
                    pass
            finally:
                _unlock_callback(lock_key)
            continue

        payload_value = text.split(" ", 1)[1].strip()
        if not payload_value.startswith("parent_"):
            continue

        student = db.get(Student, payload_value.removeprefix("parent_"), options=_student_load_options())
        if not student:
            continue

        student.parent_telegram_chat_id = str(chat.get("id"))
        username = str(from_user.get("username") or chat.get("username") or "").strip()
        student.parent_telegram_handle = f"@{username}" if username else student.parent_telegram_handle
        student.parent_telegram_status = ParentTelegramStatus.CONNECTED
        db.add(
            SystemMessage(
                id=f"msg-{uuid4().hex[:12]}",
                student_id=student.id,
                title="Telegram ota-ona ulanishi",
                body="Ota-ona Telegram botga muvaffaqiyatli ulandi.",
                created_at=datetime.now(),
            )
        )
        db.commit()
        send_welcome_message(db, student)
        connected += 1
        live_events.publish(["students", "student-detail", "notifications", "dashboard"])

    db.commit()
    return {"connected": connected, "updates": len(updates)}


async def telegram_polling_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_sync_telegram_updates_in_thread)
        except Exception:
            pass

        await asyncio.sleep(TELEGRAM_POLL_IDLE_SLEEP_SECONDS)


def _sync_telegram_updates_in_thread() -> None:
    with SessionLocal() as db:
        settings = get_or_create_telegram_settings(db)
        if settings.enabled and _has_bot_token(settings):
            sync_telegram_updates(db, timeout_seconds=TELEGRAM_POLL_TIMEOUT_SECONDS)
