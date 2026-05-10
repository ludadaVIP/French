from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
LESSON_DIR = DATA_DIR / "lessons"
PROGRESS_FILE = DATA_DIR / "progress" / "progress.json"
AUDIO_DIR = DATA_DIR / "audio"
AUDIO_CACHE_DIR = AUDIO_DIR / "edge-tts"
AUDIO_MANIFEST_FILE = AUDIO_CACHE_DIR / "manifest.json"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
AUDIO_TEXT_LIMIT = 5000

FRENCH_TTS_VOICES = [
    {
        "id": "fr-FR-VivienneMultilingualNeural",
        "name": "Vivienne",
        "style": "France French, smooth and friendly",
    },
    {
        "id": "fr-FR-DeniseNeural",
        "name": "Denise",
        "style": "France French, clear general practice",
    },
    {
        "id": "fr-FR-HenriNeural",
        "name": "Henri",
        "style": "France French, calm and clear",
    },
]
ALLOWED_TTS_VOICES = {voice["id"] for voice in FRENCH_TTS_VOICES}

app = Flask(__name__)


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def default_progress() -> dict[str, Any]:
    return {
        "currentLessonId": "alphabet",
        "blockStates": {},
        "heardBlocks": {},
        "visitedLessons": [],
        "completedLessons": [],
        "sessions": [],
    }


def get_progress() -> dict[str, Any]:
    return read_json(PROGRESS_FILE, default_progress())


def audio_file_is_usable(path: Path | None) -> bool:
    return bool(path and path.exists() and path.is_file() and path.stat().st_size > 1024)


def voice_for_text(text: str) -> str:
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()
    index = int(digest[:8], 16) % len(FRENCH_TTS_VOICES)
    return FRENCH_TTS_VOICES[index]["id"]


def tts_cache_key(text: str, voice: str) -> str:
    return hashlib.sha1(f"edge-tts-v1\n{voice}\n{text}".encode("utf-8")).hexdigest()


def tts_output_path(text: str, voice: str) -> tuple[str, Path]:
    cache_key = tts_cache_key(text, voice)
    output_dir = AUDIO_CACHE_DIR / "fr-FR" / voice
    return cache_key, output_dir / f"{cache_key}.mp3"


def update_audio_manifest(cache_key: str, text: str, voice: str, output_path: Path) -> None:
    manifest = read_json(AUDIO_MANIFEST_FILE, {"items": {}})
    items = manifest.setdefault("items", {})
    items[cache_key] = {
        "voice": voice,
        "language": "fr-FR",
        "engine": "edge-tts",
        "chars": len(text),
        "textPreview": text[:240],
        "path": output_path.relative_to(AUDIO_DIR).as_posix(),
        "bytes": output_path.stat().st_size if output_path.exists() else 0,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(AUDIO_MANIFEST_FILE, manifest)


async def generate_edge_audio(text: str, voice: str, output_path: Path) -> None:
    try:
        import edge_tts
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "edge-tts 还没有安装。请运行 start.py / start.bat，或在 backend 环境里安装 requirements.txt。"
        ) from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice=voice)
    await communicate.save(str(output_path))


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/api/health")
def health():
    return jsonify({"ok": True})


@app.route("/api/tts/voices")
def tts_voices():
    return jsonify(
        {
            "language": "fr-FR",
            "engine": "edge-tts",
            "randomMode": "stable-by-text",
            "voices": FRENCH_TTS_VOICES,
        }
    )


@app.route("/api/roadmap")
def roadmap():
    return jsonify(
        {
            "phases": [
                {
                    "id": "pronunciation",
                    "title": "发音系统",
                    "description": "先建立可读、可听、可模仿的基础。",
                    "lessons": [
                        {
                            "id": "alphabet",
                            "title": "认识字母",
                            "status": "active",
                            "goal": "听懂并读出 26 个法语字母名。",
                        },
                        {
                            "id": "letter-combinations",
                            "title": "常见字母组合",
                            "status": "ready",
                            "goal": "系统掌握元音组合、鼻化音、辅音变化、词尾与连读。",
                        },
                        {
                            "id": "word-reading",
                            "title": "从单词到短句",
                            "status": "ready",
                            "goal": "按阶梯练习词组、节奏组、连读、省音、否定和问句。",
                        },
                    ],
                },
                {
                    "id": "foundation",
                    "title": "基础表达",
                    "description": "用高频词和现在时搭出句子。",
                    "lessons": [
                        {
                            "id": "core-words",
                            "title": "基础单词",
                            "status": "ready",
                            "goal": "名词、形容词、人称、方向、时间。",
                        },
                        {
                            "id": "present-tense",
                            "title": "现在时表达",
                            "status": "ready",
                            "goal": "人称、动作、结果和基本否定。",
                        },
                    ],
                },
                {
                    "id": "verbs",
                    "title": "动词变位",
                    "description": "从规则动词到高频不规则动词。",
                    "lessons": [
                        {
                            "id": "regular-verbs",
                            "title": "-er / -ir / -re 规则动词",
                            "status": "ready",
                            "goal": "快速识别和产出基础变位。",
                        },
                        {
                            "id": "irregular-verbs",
                            "title": "être / avoir / aller / faire",
                            "status": "ready",
                            "goal": "优先掌握最高频不规则动词。",
                        },
                    ],
                },
                {
                    "id": "advanced",
                    "title": "复杂表达",
                    "description": "过去、将来、条件、虚拟等逐步推进。",
                    "lessons": [
                        {
                            "id": "past-future",
                            "title": "过去与将来",
                            "status": "ready",
                            "goal": "讲经历、计划和预测。",
                        },
                        {
                            "id": "mood",
                            "title": "条件式与虚拟式",
                            "status": "ready",
                            "goal": "表达假设、愿望、态度和不确定性。",
                        },
                    ],
                },
            ]
        }
    )


@app.route("/api/lessons/<lesson_id>")
def lesson(lesson_id: str):
    lesson_path = LESSON_DIR / f"{lesson_id}.json"
    lesson_data = read_json(lesson_path)
    if lesson_data is None:
        return jsonify({"error": "Lesson not found"}), 404
    return jsonify(lesson_data)


@app.route("/api/progress", methods=["GET", "POST", "OPTIONS"])
def progress():
    if request.method == "OPTIONS":
        return "", 204

    if request.method == "GET":
        return jsonify(get_progress())

    payload = request.get_json(silent=True) or {}
    current = get_progress()
    updated = {
        **current,
        **payload,
        "blockStates": {
            **current.get("blockStates", {}),
            **payload.get("blockStates", {}),
        },
        "heardBlocks": {
            **current.get("heardBlocks", {}),
            **payload.get("heardBlocks", {}),
        },
        "visitedLessons": list(
            dict.fromkeys(
                [
                    *current.get("visitedLessons", []),
                    *payload.get("visitedLessons", []),
                ]
            )
        ),
    }
    write_json(PROGRESS_FILE, updated)
    return jsonify(updated)


@app.route("/api/tts", methods=["POST", "OPTIONS"])
def create_tts_audio():
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True) or {}
    text = " ".join(str(payload.get("text") or "").split())
    if not text:
        return jsonify({"error": "Text is required."}), 400
    if len(text) > AUDIO_TEXT_LIMIT:
        return jsonify({"error": f"Text is too long. Keep it under {AUDIO_TEXT_LIMIT} characters."}), 400

    requested_voice = str(payload.get("voice") or "").strip()
    voice = requested_voice if requested_voice in ALLOWED_TTS_VOICES else voice_for_text(text)
    cache_key, output_path = tts_output_path(text, voice)
    audio_path = f"/audio/{output_path.relative_to(AUDIO_DIR).as_posix()}"

    if audio_file_is_usable(output_path):
        update_audio_manifest(cache_key, text, voice, output_path)
        return jsonify(
            {
                "audio_path": audio_path,
                "audio_url": request.host_url.rstrip("/") + audio_path,
                "cached": True,
                "engine": "edge-tts",
                "language": "fr-FR",
                "voice": voice,
            }
        )

    try:
        asyncio.run(generate_edge_audio(text, voice, output_path))
        if not audio_file_is_usable(output_path):
            raise RuntimeError("Edge TTS returned an empty or unreadable MP3 file.")
    except Exception as exc:
        output_path.unlink(missing_ok=True)
        return jsonify({"error": f"Could not generate French audio with {voice}: {exc}"}), 502

    update_audio_manifest(cache_key, text, voice, output_path)
    return jsonify(
        {
            "audio_path": audio_path,
            "audio_url": request.host_url.rstrip("/") + audio_path,
            "cached": False,
            "engine": "edge-tts",
            "language": "fr-FR",
            "voice": voice,
        }
    )


@app.route("/audio/<path:filename>")
def serve_audio(filename: str):
    return send_from_directory(AUDIO_DIR, filename, max_age=31536000)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path: str):
    target = FRONTEND_DIST / path
    if path and target.exists() and target.is_file():
        return send_from_directory(FRONTEND_DIST, path)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return send_from_directory(FRONTEND_DIST, "index.html")

    return jsonify(
        {
            "message": "Frontend build not found. Run root start.py/start.bat or `npm run build` in frontend.",
            "api": "/api/roadmap",
        }
    )


if __name__ == "__main__":
    AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    port = int(os.environ.get("PORT", "5055"))
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
