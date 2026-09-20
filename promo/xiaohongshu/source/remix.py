import array
import json
import math
import re
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg

root = Path(__file__).resolve().parent
video = root.parent / "video/intro.mp4"
archive = root / "previous"
archive.mkdir(exist_ok=True)
original = archive / "intro-system-voice.mp4"
if not original.exists():
    shutil.copy2(video, original)
if not (archive / "audio").exists():
    shutil.copytree(root / "audio", archive / "audio")
if not (archive / "verification.json").exists():
    shutil.copy2(root.parent / "verification.json", archive / "verification.json")
story = json.loads((root / "story.json").read_text())
settings = json.loads((root / "audio-natural/narration.json").read_text())
duration = json.loads((archive / "verification.json").read_text())["video"]["duration"]
sample_rate = 24000
sample_count = math.ceil(duration * sample_rate)
speech = array.array("f", [0]) * sample_count
music = array.array("f", [0]) * sample_count
offset = 0.55
for scene in story:
    with wave.open(str(root / "audio-natural" / f"{scene['id']}.wav")) as recording:
        assert recording.getframerate() == sample_rate
        assert recording.getnchannels() == 1 and recording.getsampwidth() == 2
        samples = array.array("h", recording.readframes(recording.getnframes()))
    assert 0.5 < len(samples) / sample_rate < scene["duration"] - 0.45
    start = round(offset * sample_rate)
    assert start + len(samples) <= sample_count
    for index, sample in enumerate(samples):
        speech[start + index] += sample / 32768
    offset += scene["duration"]

match = re.search(r"const melody = (\[[^\]]+\]);", (root / "render.js").read_text())
assert match, "Existing project melody is missing"
melody = json.loads(match.group(1))
story_duration = sum(scene["duration"] for scene in story)
for note_index in range(math.ceil(story_duration / 0.43)):
    frequency = melody[note_index % len(melody)]
    if not frequency:
        continue
    start = round((0.2 + note_index * 0.43) * sample_rate)
    volume = 0.018 * min(1, (story_duration - note_index * 0.43) / 2)
    for index in range(min(round(0.85 * sample_rate), sample_count - start)):
        time = index / sample_rate
        envelope = volume * time / 0.02 if time < 0.02 else volume * (0.0001 / volume) ** min(1, (time - 0.02) / 0.78)
        music[start + index] += envelope * math.sin(2 * math.pi * frequency * time)
mixed = array.array("f", (voice + background for voice, background in zip(speech, music)))
assert max(abs(sample) for sample in mixed) < 0.95, "Audio headroom is insufficient"
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()


def video_hash(movie):
    return subprocess.run([ffmpeg, "-v", "error", "-i", str(movie), "-map", "0:v:0", "-c", "copy", "-f", "hash", "-hash", "sha256", "-"], check=True, capture_output=True, text=True).stdout.strip()


def video_timeline(movie):
    output = subprocess.run([ffmpeg, "-v", "error", "-i", str(movie), "-map", "0:v:0", "-c", "copy", "-f", "framehash", "-hash", "sha256", "-"], check=True, capture_output=True, text=True).stdout
    packets = [line.split(",") for line in output.splitlines() if line and not line.startswith("#")]
    return [(int(packet[1]), int(packet[2]), packet[-1].strip()) for packet in packets]


with tempfile.TemporaryDirectory(prefix="remix-", dir=root) as temporary:
    staging = Path(temporary)
    for name, samples in [("narration", speech), ("mix", mixed)]:
        with wave.open(str(staging / f"{name}.wav"), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(sample_rate)
            output.writeframes(array.array("h", (round(sample * 32767) for sample in samples)).tobytes())
    result = staging / "intro.mp4"
    subprocess.run([ffmpeg, "-y", "-v", "error", "-copyts", "-i", str(original), "-i", str(staging / "mix.wav"), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(result)], check=True, timeout=120)
    before, after = video_hash(original), video_hash(result)
    assert before == after, "Video packets changed; original pictures must be preserved"
    timeline = video_timeline(original)
    assert timeline == video_timeline(result), "Frame decode or presentation times changed"
    decoded = subprocess.run([ffmpeg, "-v", "error", "-i", str(result), "-map", "0:a:0", "-ac", "1", "-ar", str(sample_rate), "-f", "f32le", "-"], check=True, capture_output=True).stdout
    samples = array.array("f")
    samples.frombytes(decoded)
    peak = max(abs(sample) for sample in samples)
    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    assert 0.01 < rms < 0.3 and peak < 0.999, "Encoded audio is silent or clipped"
    assert abs(len(samples) / sample_rate - duration) < 0.1
    preview = staging / "narration-natural.m4a"
    subprocess.run([ffmpeg, "-y", "-v", "error", "-i", str(staging / "narration.wav"), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(preview)], check=True, timeout=30)
    result.replace(video)
    preview.replace(root.parent / "video/narration-natural.m4a")
    for scene in story:
        shutil.copy2(root / "audio-natural" / f"{scene['id']}.wav", root / "audio" / f"{scene['id']}.wav")
    shutil.copy2(root / "audio-natural/narration.json", root / "audio/narration.json")
    report = {"result": "PASS", "voice": "zh-CN-XiaoxiaoNeural", "textChanged": "Punctuation only; words and existing subtitles unchanged", "videoPacketsUnchanged": before == after, "videoPresentationTimesUnchanged": True, "videoPacketCount": len(timeline), "videoSHA256": after.removeprefix("SHA256="), "decodedAudio": {"sampleRate": sample_rate, "duration": len(samples) / sample_rate, "peak": peak, "rms": rms}, "scenes": settings, "original": "source/previous/intro-system-voice.mp4", "listeningReview": "Not human-auditioned; naturalness remains subjective"}
    (root.parent / "voice-verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"PASS: neural narration mixed; video unchanged; audio peak {peak:.3f}, RMS {rms:.3f}")
