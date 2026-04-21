from __future__ import annotations

import base64
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..core.config import BASE_DIR, get_settings
from ..core.security import decrypt_secret, encrypt_secret, hash_password, hash_token, password_needs_update, verify_password
from ..models import (
    AccountCredential,
    Attendance,
    AttendanceStatus,
    Group,
    ParentTelegramStatus,
    PasswordResetToken,
    PaymentStatus,
    Role,
    Student,
    Teacher,
    TeacherNote,
    User,
    UserStatus,
)


ATTENDED_STATUSES = {
    AttendanceStatus.PRESENT.value,
    AttendanceStatus.LATE.value,
    AttendanceStatus.EXCUSED.value,
    AttendanceStatus.NOT_PREPARED.value,
    AttendanceStatus.HOMEWORK_NOT_DONE.value,
}

COURSE_PRICES = {
    "Ingliz tili asoslari": Decimal("850000"),
    "Matematika tezkor kursi": Decimal("920000"),
    "IELTS intensiv": Decimal("1100000"),
}


def money_to_text(amount: Decimal | int | float | None) -> str:
    value = int(Decimal(amount or 0))
    return f"{value:,}".replace(",", " ") + " so'm"


def datetime_to_text(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M")


def today_iso() -> str:
    return date.today().isoformat()


def weekday_code(date_value: str) -> str:
    day = datetime.fromisoformat(f"{date_value}T12:00:00").weekday()
    return ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Yak"][day]


def is_attended(status: str) -> bool:
    return status in ATTENDED_STATUSES


def attendance_template(status: str) -> str | None:
    templates = {
        AttendanceStatus.PRESENT.value: "Davomat - Keldi",
        AttendanceStatus.ABSENT.value: "Davomat - Kelmadi",
        AttendanceStatus.LATE.value: "Davomat - Kechikdi",
        AttendanceStatus.EXCUSED.value: "Davomat - Sababli kelmadi",
        AttendanceStatus.NOT_PREPARED.value: "Davomat - Tayyor emas",
        AttendanceStatus.HOMEWORK_NOT_DONE.value: "Uy vazifasi - Bajarilmagan",
    }
    return templates.get(status)


def attendance_note_tag(status: str) -> str | None:
    tags = {
        AttendanceStatus.LATE.value: "LATE",
        AttendanceStatus.ABSENT.value: "ABSENT",
        AttendanceStatus.EXCUSED.value: "EXCUSED",
        AttendanceStatus.NOT_PREPARED.value: "NOT_PREPARED",
        AttendanceStatus.HOMEWORK_NOT_DONE.value: "HOMEWORK_NOT_DONE",
    }
    return tags.get(status)


def default_attendance_comment(status: str) -> str:
    comments = {
        AttendanceStatus.PRESENT.value: "O'z vaqtida darsda qatnashdi.",
        AttendanceStatus.ABSENT.value: "Bugungi darsga kelmadi.",
        AttendanceStatus.LATE.value: "Darsga kechikib keldi.",
        AttendanceStatus.EXCUSED.value: "Sababli ravishda darsda qatnasha olmadi.",
        AttendanceStatus.NOT_PREPARED.value: "Darsga tayyor emas holatda keldi.",
        AttendanceStatus.HOMEWORK_NOT_DONE.value: "Uy vazifasini bajarmagan.",
    }
    return comments.get(status, "Holat yangilandi.")


def decimal_amount(value: Decimal | int | float | None) -> Decimal:
    return Decimal(str(value or 0))


def payment_remaining_amount(expected_amount: Decimal | int | float | None, paid_amount: Decimal | int | float | None) -> Decimal:
    remaining = decimal_amount(expected_amount) - decimal_amount(paid_amount)
    return remaining if remaining > 0 else Decimal("0")


def payment_status_for_values(
    expected_amount: Decimal | int | float | None,
    paid_amount: Decimal | int | float | None,
    due_date: date,
) -> PaymentStatus:
    expected = decimal_amount(expected_amount)
    paid = decimal_amount(paid_amount)

    if expected <= 0:
        return PaymentStatus.PAID if paid > 0 else PaymentStatus.UNPAID
    if expected > 0 and paid >= expected:
        return PaymentStatus.PAID
    if paid > 0:
        return PaymentStatus.PARTIAL
    if due_date < date.today():
        return PaymentStatus.OVERDUE
    return PaymentStatus.UNPAID


def payment_status_note_for_values(
    expected_amount: Decimal | int | float | None,
    paid_amount: Decimal | int | float | None,
    due_date: date,
) -> str:
    expected = decimal_amount(expected_amount)
    paid = decimal_amount(paid_amount)
    status = payment_status_for_values(expected, paid, due_date)

    if status == PaymentStatus.PAID:
        return "To'liq to'langan"
    if status == PaymentStatus.PARTIAL:
        return "Yarim to'langan" if expected > 0 and paid * 2 == expected else "Qisman to'langan"
    if status == PaymentStatus.OVERDUE:
        return "To'lanmagan, muddati o'tgan"
    return "To'lanmagan"


def student_payment_status(student: Student) -> PaymentStatus:
    if not student.payments:
        return PaymentStatus.UNPAID

    statuses = [
        payment_status_for_values(student.monthly_fee, payment.amount, payment.due_date)
        for payment in student.payments
    ]

    if PaymentStatus.OVERDUE in statuses:
        return PaymentStatus.OVERDUE
    if PaymentStatus.PARTIAL in statuses:
        return PaymentStatus.PARTIAL
    if PaymentStatus.UNPAID in statuses:
        return PaymentStatus.UNPAID
    return PaymentStatus.PAID


def session_user_payload(user: User) -> dict[str, str | None]:
    profile_id = user.student_profile.id if user.student_profile else user.teacher_profile.id if user.teacher_profile else user.id

    return {
        "id": user.id,
        "profileId": profile_id,
        "fullName": user.full_name,
        "role": user.role.value,
        "phone": user.phone,
        "email": user.email,
        "avatar": user.avatar,
    }


def teacher_profile_id_for_user(user: User) -> str | None:
    return user.teacher_profile.id if user.teacher_profile else None


def student_profile_for_user(user: User) -> Student | None:
    return user.student_profile


def account_credential_payload(user: User) -> dict[str, str] | None:
    if not user.account_credential:
        return None

    return {
        "loginIdentifier": user.account_credential.login_identifier,
        "password": decrypt_secret(user.account_credential.password_cipher),
        "issuedAt": datetime_to_text(user.account_credential.created_at),
    }


def upsert_account_credential(db: Session, user: User, login_identifier: str, password: str) -> None:
    account_credential = user.account_credential or db.scalar(select(AccountCredential).where(AccountCredential.user_id == user.id))

    if account_credential is None:
        db.add(
            AccountCredential(
                id=f"cred-{user.id}",
                user_id=user.id,
                login_identifier=login_identifier,
                password_cipher=encrypt_secret(password),
            )
        )
        return

    account_credential.login_identifier = login_identifier
    account_credential.password_cipher = encrypt_secret(password)


def get_user_by_identifier(db: Session, identifier: str) -> User | None:
    normalized = identifier.strip().lower()
    return db.scalar(
        select(User).where(
            or_(
                func.lower(User.phone) == normalized,
                func.lower(User.email) == normalized,
            )
        )
    )


def authenticate_user(db: Session, identifier: str, password: str) -> User:
    user = get_user_by_identifier(db, identifier)

    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Invalid credentials")

    if user.status != UserStatus.ACTIVE:
        raise ValueError("Account is not active")

    if password_needs_update(user.password_hash):
        user.password_hash = hash_password(password)

    return user


def create_registration(db: Session, payload: dict[str, str]) -> dict[str, str]:
    raise ValueError("Public registration is disabled. Admin account creates all users.")


def create_reset_token(db: Session, identifier: str) -> dict[str, str]:
    user = get_user_by_identifier(db, identifier)
    if not user:
        raise ValueError("Foydalanuvchi topilmadi.")

    raw_token = f"reset-{datetime.now().timestamp_ns()}"
    db.add(
        PasswordResetToken(
            id=f"reset-{datetime.now().timestamp_ns()}",
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(UTC) + timedelta(minutes=get_settings().reset_token_ttl_minutes),
        )
    )
    db.commit()
    return {"message": "Tiklash tokeni yaratildi.", "token": raw_token}


def reset_password(db: Session, token: str, password: str) -> dict[str, str]:
    reset_entry = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token)))

    if not reset_entry or reset_entry.used_at is not None or reset_entry.expires_at < datetime.now(UTC):
        raise ValueError("Tiklash tokeni yaroqsiz yoki muddati tugagan.")

    user = db.get(User, reset_entry.user_id)
    if not user:
        raise ValueError("Foydalanuvchi topilmadi.")

    user.password_hash = hash_password(password)
    upsert_account_credential(db, user, user.email or user.phone, password)
    reset_entry.used_at = datetime.now(UTC)
    db.commit()
    return {"message": "Parol yangilandi."}


def update_current_user_profile(db: Session, user: User, payload: dict[str, str | None]) -> dict[str, str | None]:
    full_name = str(payload["fullName"]).strip()
    phone = str(payload["phone"]).strip()
    email = str(payload["email"]).strip().lower() if payload.get("email") else None

    if not full_name:
        raise ValueError("Ismni kiriting.")
    if not phone:
        raise ValueError("Telefon raqamini kiriting.")

    if db.scalar(select(User.id).where(User.phone == phone, User.id != user.id)):
        raise ValueError("Bu telefon bilan foydalanuvchi allaqachon mavjud.")

    if email and db.scalar(select(User.id).where(User.email == email, User.id != user.id)):
        raise ValueError("Bu email bilan foydalanuvchi allaqachon mavjud.")

    if user.teacher_profile:
        if db.scalar(select(Teacher.id).where(Teacher.phone == phone, Teacher.id != user.teacher_profile.id)):
            raise ValueError("Bu telefon bilan o'qituvchi allaqachon mavjud.")
        if email and db.scalar(select(Teacher.id).where(Teacher.email == email, Teacher.id != user.teacher_profile.id)):
            raise ValueError("Bu email bilan o'qituvchi allaqachon mavjud.")

    if user.student_profile and db.scalar(select(Student.id).where(Student.phone == phone, Student.id != user.student_profile.id)):
        raise ValueError("Bu telefon bilan o'quvchi allaqachon mavjud.")

    user.full_name = full_name
    user.phone = phone
    user.email = email

    if user.teacher_profile:
        user.teacher_profile.full_name = full_name
        user.teacher_profile.phone = phone
        user.teacher_profile.email = email
        user.teacher_profile.specialization = str(payload.get("specialization") or "").strip() or None

    if user.student_profile:
        user.student_profile.full_name = full_name
        user.student_profile.phone = phone

        parent_name = str(payload.get("parentName") or "").strip()
        parent_phone = str(payload.get("parentPhone") or "").strip()
        parent_telegram_handle = str(payload.get("parentTelegramHandle") or "").strip() or None

        if parent_name:
            user.student_profile.parent_name = parent_name
        if parent_phone:
            user.student_profile.parent_phone = parent_phone

        user.student_profile.parent_telegram_handle = parent_telegram_handle
        user.student_profile.parent_telegram_status = ParentTelegramStatus.CONNECTED if parent_telegram_handle else ParentTelegramStatus.MISSING

    if user.account_credential:
        user.account_credential.login_identifier = user.email or user.phone

    db.commit()
    db.refresh(user)
    return session_user_payload(user)


def change_current_user_password(db: Session, user: User, current_password: str, new_password: str) -> dict[str, str]:
    if not verify_password(current_password, user.password_hash):
        raise ValueError("Joriy parol noto'g'ri.")
    if len(new_password.strip()) < 6:
        raise ValueError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.")

    user.password_hash = hash_password(new_password)
    upsert_account_credential(db, user, user.email or user.phone, new_password.strip())
    db.commit()
    return {"message": "Parol yangilandi."}


def save_user_avatar(db: Session, user: User, file_name: str, data_url: str) -> dict[str, str | None]:
    if ";base64," not in data_url:
        raise ValueError("Rasm formati noto'g'ri.")

    header, encoded = data_url.split(";base64,", 1)
    mime_type = header.removeprefix("data:").strip().lower()
    extension = Path(file_name).suffix.lower() or {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
    }.get(mime_type, "")

    if mime_type not in {"image/png", "image/jpeg", "image/webp"} or extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise ValueError("Faqat PNG, JPG yoki WEBP rasm yuklang.")

    try:
        content = base64.b64decode(encoded)
    except ValueError as exc:
        raise ValueError("Rasmni o'qib bo'lmadi.") from exc

    upload_dir = BASE_DIR / "uploads" / "avatars"
    upload_dir.mkdir(parents=True, exist_ok=True)

    if user.avatar and user.avatar.startswith("/uploads/avatars/"):
        previous_file = BASE_DIR / user.avatar.lstrip("/")
        if previous_file.exists():
            previous_file.unlink(missing_ok=True)

    next_name = f"{user.id}-{uuid4().hex[:10]}{extension}"
    relative_path = Path("uploads") / "avatars" / next_name
    target_path = BASE_DIR / relative_path
    target_path.write_bytes(content)

    user.avatar = f"/{relative_path.as_posix()}"
    db.commit()
    db.refresh(user)
    return session_user_payload(user)


def student_query():
    return select(Student).options(
        selectinload(Student.group).selectinload(Group.course),
        selectinload(Student.group).selectinload(Group.teacher),
        selectinload(Student.course),
        selectinload(Student.user).selectinload(User.account_credential),
        selectinload(Student.attendances),
        selectinload(Student.payments),
        selectinload(Student.notes),
        selectinload(Student.homework_items),
        selectinload(Student.messages),
        selectinload(Student.notifications),
    )


def teacher_query():
    return select(Teacher).options(
        selectinload(Teacher.groups),
        selectinload(Teacher.notes),
        selectinload(Teacher.user).selectinload(User.account_credential),
    )


def latest_payment_for_student(student: Student):
    return sorted(student.payments, key=lambda item: item.due_date.isoformat(), reverse=True)[0] if student.payments else None


def latest_note_for_student(student: Student) -> TeacherNote | None:
    return sorted(student.notes, key=lambda item: item.note_date.isoformat(), reverse=True)[0] if student.notes else None


def attendance_percent_for_student(student: Student) -> int:
    if not student.attendances:
        return 0

    attended_count = len([entry for entry in student.attendances if is_attended(entry.status.value)])
    return round((attended_count / len(student.attendances)) * 100)


def effective_parent_telegram_status(student: Student) -> ParentTelegramStatus:
    return ParentTelegramStatus.CONNECTED if student.parent_telegram_chat_id else ParentTelegramStatus.MISSING


def student_summary_payload(student: Student, *, include_credentials: bool = False, parent_telegram_connect_url: str | None = None) -> dict[str, object]:
    latest_note = latest_note_for_student(student)

    payload: dict[str, object] = {
        "id": student.id,
        "fullName": student.full_name,
        "phone": student.phone,
        "parentName": student.parent_name,
        "parentPhone": student.parent_phone,
        "parentTelegramStatus": effective_parent_telegram_status(student).value,
        "parentTelegramConnectUrl": parent_telegram_connect_url,
        "group": student.group.name if student.group else "Biriktirilmagan",
        "course": student.course.title if student.course else "Biriktirilmagan",
        "attendancePercent": attendance_percent_for_student(student),
        "paymentStatus": student_payment_status(student).value,
        "monthlyFee": money_to_text(student.monthly_fee or 0),
        "lastTeacherNote": latest_note.comment if latest_note else "So'nggi izoh mavjud emas.",
        "teacherName": student.group.teacher.full_name if student.group and student.group.teacher else "-",
        "room": student.group.room if student.group and student.group.room else "-",
        "schedule": student.group.schedule_label if student.group else "Jadval biriktirilmagan",
    }

    if include_credentials and student.user:
        payload["accountCredentials"] = account_credential_payload(student.user)

    return payload
