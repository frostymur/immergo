import asyncio
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List

import edge_tts
from pydub import AudioSegment

from app.services.llm import VOICE_MAP


async def synthesize_line(text: str, voice: str, output_path: str) -> None:
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)


async def synthesize_text(text: str, lang: str = "en", voice: str | None = None) -> str:
    """Synthesize a single text to an MP3 temp file. Returns the file path."""
    voice = voice or VOICE_MAP.get(lang, VOICE_MAP["en"])
    fd, out_path = tempfile.mkstemp(suffix=".mp3", prefix="immergo_tts_")
    os.close(fd)
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(out_path)
    return out_path


VOICE_LANG_PREFIXES = {"kz": "kk-KZ-", "ru": "ru-RU-", "en": "en-US-"}



async def list_voices() -> dict[str, list[dict[str, str]]]:
    result = {"kz": [], "ru": [], "en": []}
    
    # Curated English Voices with Personalities and Accents
    en_voices = [
        {"id": "en-GB-RyanNeural", "name": "Charon", "gender": "Informative", "accent": "gb"},
        {"id": "en-US-ChristopherNeural", "name": "Charon", "gender": "Informative", "accent": "us"},
        {"id": "en-AU-WilliamNeural", "name": "Charon", "gender": "Informative", "accent": "au"},

        {"id": "en-GB-SoniaNeural", "name": "Aoede", "gender": "Breezy", "accent": "gb"},
        {"id": "en-US-AriaNeural", "name": "Aoede", "gender": "Breezy", "accent": "us"},
        {"id": "en-AU-NatashaNeural", "name": "Aoede", "gender": "Breezy", "accent": "au"},

        {"id": "en-GB-AlfieNeural", "name": "Puck", "gender": "Upbeat", "accent": "gb"},
        {"id": "en-US-GuyNeural", "name": "Puck", "gender": "Upbeat", "accent": "us"},
        {"id": "en-AU-NeilNeural", "name": "Puck", "gender": "Upbeat", "accent": "au"},

        {"id": "en-GB-MiaNeural", "name": "Leda", "gender": "Youthful", "accent": "gb"},
        {"id": "en-US-JennyNeural", "name": "Leda", "gender": "Youthful", "accent": "us"},
        {"id": "en-AU-CarlyNeural", "name": "Leda", "gender": "Youthful", "accent": "au"},

        {"id": "en-GB-ThomasNeural", "name": "Algieba", "gender": "Smooth", "accent": "gb"},
        {"id": "en-US-EricNeural", "name": "Algieba", "gender": "Smooth", "accent": "us"},
        {"id": "en-AU-DuncanNeural", "name": "Algieba", "gender": "Smooth", "accent": "au"},

        {"id": "en-GB-ElliotNeural", "name": "Enceladus", "gender": "Breathy", "accent": "gb"},
        {"id": "en-US-SteffanNeural", "name": "Enceladus", "gender": "Breathy", "accent": "us"},
        {"id": "en-AU-TimNeural", "name": "Enceladus", "gender": "Breathy", "accent": "au"},

        {"id": "en-GB-LibbyNeural", "name": "Kore", "gender": "Firm", "accent": "gb"},
        {"id": "en-US-MichelleNeural", "name": "Kore", "gender": "Firm", "accent": "us"},
        {"id": "en-AU-JoanneNeural", "name": "Kore", "gender": "Firm", "accent": "au"},

        {"id": "en-GB-OliverNeural", "name": "Fenrir", "gender": "Excitable", "accent": "gb"},
        {"id": "en-US-RogerNeural", "name": "Fenrir", "gender": "Excitable", "accent": "us"},
        {"id": "en-AU-DarrenNeural", "name": "Fenrir", "gender": "Excitable", "accent": "au"},
    ]
    result["en"] = en_voices

    try:
        import edge_tts
        voices = await edge_tts.list_voices()
        for v in voices:
            sn = v.get("ShortName", "")
            if sn.startswith("kk-KZ-"):
                result["kz"].append({"id": sn, "name": v.get("FriendlyName", sn).split(" - ")[-1].replace(" (Neural)", ""), "gender": v.get("Gender", "")})
            elif sn.startswith("ru-RU-"):
                result["ru"].append({"id": sn, "name": v.get("FriendlyName", sn).split(" - ")[-1].replace(" (Neural)", ""), "gender": v.get("Gender", "")})
    except Exception:
        pass
        
    for lang in ["kz", "ru"]:
        if not result[lang]:
            default = VOICE_MAP.get(lang, VOICE_MAP["en"])
            result[lang] = [{"id": default, "name": default, "gender": ""}]
            
    return result



def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _concat_raw_mp3(segment_files: List[str], output_path: str) -> None:
    """Fallback concatenation by appending MP3 frames. Removes intermediate ID3 tags."""
    with open(output_path, "wb") as out:
        for i, seg in enumerate(segment_files):
            with open(seg, "rb") as f:
                data = f.read()
            if i == 0:
                out.write(data)
            else:
                # Strip leading ID3 tag if present to avoid corrupting stream
                if data.startswith(b"ID3"):
                    idx = data.find(b"\xff\xfb")
                    if idx == -1:
                        idx = data.find(b"\xff\xf3")
                    if idx == -1:
                        idx = data.find(b"\xff\xfa")
                    if idx > 0:
                        data = data[idx:]
                out.write(data)


async def generate_podcast_audio(
    dialogue: List[dict[str, str]],
    lang: str = "en",
) -> str:
    """Render a dialogue to a single MP3 file. Returns path to the combined MP3."""
    voice = VOICE_MAP.get(lang, VOICE_MAP["en"])
    tmp_dir = tempfile.mkdtemp(prefix="podcast_")
    segment_files: List[str] = []

    try:
        tasks = []
        for i, line in enumerate(dialogue):
            text = line.get("text", "").strip()
            if not text:
                continue
            path = os.path.join(tmp_dir, f"line_{i:04d}.mp3")
            segment_files.append(path)
            tasks.append(synthesize_line(text, voice, path))

        await asyncio.gather(*tasks)

        out_fd, out_path = tempfile.mkstemp(suffix=".mp3")
        os.close(out_fd)

        if _has_ffmpeg():
            # ffmpeg concat demuxer for reliable MP3 concatenation
            list_path = os.path.join(tmp_dir, "concat_list.txt")
            with open(list_path, "w") as f:
                for seg in segment_files:
                    f.write(f"file '{Path(seg).as_posix()}'\n")
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", list_path,
                    "-acodec", "copy",
                    out_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            # Fallback: append MP3 frames
            _concat_raw_mp3(segment_files, out_path)

        return out_path
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
