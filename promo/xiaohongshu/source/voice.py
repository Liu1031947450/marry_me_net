import argparse
import json
import math
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Generate neural Chinese narration without changing scene timing.")
parser.add_argument("--output", type=Path, default=root / "audio")
args = parser.parse_args()
audio = args.output
audio.mkdir(exist_ok=True)
story = json.loads((root / "story.json").read_text())
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
voice = "zh-CN-XiaoxiaoNeural"
spoken = {
    "love": "原来，每一步都在写——我爱你。",
    "close": "四季小径，把喜欢做成可以亲手走完的礼物。",
}
report = []
with tempfile.TemporaryDirectory(prefix="neural-voice-", dir=audio.parent) as temporary:
    staging = Path(temporary)
    for scene in story:
        rate = -12 if scene["id"] in ("love", "proposal") else -6
        output = staging / f"{scene['id']}.wav"
        media = staging / f"{scene['id']}.mp3"
        text = spoken.get(scene["id"], scene["voice"])
        assert "".join(character for character in text if character.isalnum()) == "".join(character for character in scene["voice"] if character.isalnum())
        for attempt in range(3):
            subprocess.run([sys.executable, "-m", "edge_tts", "--voice", voice, f"--rate={rate:+d}%", "--text", text, "--write-media", str(media)], check=True, timeout=90)
            subprocess.run([ffmpeg, "-y", "-v", "error", "-i", str(media), "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", str(output)], check=True, timeout=30)
            with wave.open(str(output)) as recording:
                duration = recording.getnframes() / recording.getframerate()
            if duration < scene["duration"] - 0.45:
                break
            rate = math.ceil((100 + rate) * duration / (scene["duration"] - 0.55) - 100)
            if rate > 15:
                raise RuntimeError(f"{scene['id']}: fitting narration would require an unnatural speed")
        assert 0.5 < duration < scene["duration"] - 0.45, f"{scene['id']}: voice {duration:.2f}s exceeds scene"
        report.append({"id": scene["id"], "voice": voice, "rate": rate, "text": text, "duration": round(duration, 3), "sceneDuration": scene["duration"]})
        print(f"{scene['id']}: {duration:.2f}s / {scene['duration']:.2f}s, rate {rate:+d}%", flush=True)
    for scene in story:
        (staging / f"{scene['id']}.wav").replace(audio / f"{scene['id']}.wav")
(audio / "narration.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
