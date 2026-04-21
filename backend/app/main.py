import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.router import api_router
from .core.config import BASE_DIR, get_settings
from .db.init_db import initialize_database
from .services.telegram_bot import telegram_polling_loop


settings = get_settings()


def _cors_origins() -> list[str]:
    configured = [
        origin.strip()
        for origin in settings.cors_origin.split(",")
        if origin.strip()
    ]
    default_frontend_origins = [
        "https://kurs-frontend-tizim.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    return list(dict.fromkeys([*configured, *default_frontend_origins]))


def _cors_origin_regex() -> str:
    return r"https://.*\.vercel\.app"


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    telegram_task = asyncio.create_task(telegram_polling_loop())
    try:
        yield
    finally:
        telegram_task.cancel()
        with suppress(asyncio.CancelledError):
            await telegram_task


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = BASE_DIR / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

telegram_assets_dir = BASE_DIR / "app" / "static" / "telegram-assets"
telegram_assets_dir.mkdir(parents=True, exist_ok=True)
app.mount("/telegram-assets", StaticFiles(directory=telegram_assets_dir), name="telegram-assets")

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
def root():
    return {"name": settings.app_name, "docs": "/docs"}
