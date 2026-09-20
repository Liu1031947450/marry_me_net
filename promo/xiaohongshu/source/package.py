import json
import wave
from pathlib import Path

from PIL import Image, ImageOps, ImageStat

root = Path(__file__).resolve().parents[1]
story = json.loads((root / "source/story.json").read_text())
descriptions = {
    "hook": "大字钩子 + 四季实际场景动态拼图。",
    "start": "真实开始菜单特写，强调探险开场不透露求婚。",
    "seasons": "依次展示春、夏、秋、冬；使用原游戏逻辑推进角色与镜头。",
    "walk": "春日小径移动、钥匙与出口机制；演示节选，不是完整通关录屏。",
    "lookback": "按实际通关坐标，依次描出四条路线。",
    "love": "完整 LOVE 路线停留，配像素爱心。",
    "proposal": "真实求婚页截图，放大呈现核心问题。",
    "success": "真实成功页 + 隐藏私人照片的照片墙，日期显示为演示信息。",
    "close": "项目名、电脑画面与手机截图，邀请观众分享想藏在终点的话。",
}


def timestamp(seconds, separator=","):
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    whole_seconds, remainder = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02}{separator}{remainder:03}"


assert timestamp(61.025) == "00:01:01,025"
assert timestamp(59.9996) == "00:01:00,000"
subtitles = []
web_subtitles = ["WEBVTT\n"]
storyboard = ["# 四季小径 · 视频分镜与口播", "", "画面主体约 52.9 秒；编码容器可能额外保留不足一秒的起止余量。", "", "| 时间 | 画面 | 口播 |", "| --- | --- | --- |"]
offset = 0
for index, scene in enumerate(story):
    with wave.open(str(root / f"source/audio/{scene['id']}.wav")) as recording:
        duration = recording.getnframes() / recording.getframerate()
        assert duration < scene["duration"] - 0.45
    start, end = offset, offset + scene["duration"]
    subtitle = "\n".join(scene["subtitle"])
    subtitles.append(f"{index + 1}\n{timestamp(start)} --> {timestamp(end)}\n{subtitle}\n")
    web_subtitles.append(f"{timestamp(start, '.')} --> {timestamp(end, '.')}\n{subtitle}\n")
    storyboard.append(f"| {start:.1f}–{end:.1f}s | {descriptions[scene['id']]} | {scene['voice']} |")
    offset = end
assert abs(offset - 52.9) < 0.01
(root / "video/subtitles.srt").write_text("\n".join(subtitles), encoding="utf-8")
(root / "video/subtitles.vtt").write_text("\n".join(web_subtitles), encoding="utf-8")
(root / "video/storyboard.md").write_text("\n".join(storyboard) + "\n", encoding="utf-8")

images = sorted((root / "images").glob("*.png"))
assert len(images) == 6
sheet = Image.new("RGB", (1080, 960), "#f6f2e7")
for index, path in enumerate(images):
    with Image.open(path) as image:
        assert image.size == (1080, 1440), (path.name, image.size)
        assert max(ImageStat.Stat(image.convert("RGB")).stddev) > 10, f"Blank poster: {path.name}"
        sheet.paste(ImageOps.fit(image.convert("RGB"), (360, 480)), (index % 3 * 360, index // 3 * 480))
sheet.save(root / "contact-sheet.jpg", quality=92)
with Image.open(root / "video/cover.png") as cover:
    assert cover.size == (1080, 1920)
for path in (root / "video").glob("frame-*.png"):
    path.rename(root / "source/assets" / path.name)
print("PASS: 6 posters, cover, 9 timed voice clips, SRT/VTT, storyboard, contact sheet")
