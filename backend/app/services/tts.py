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
