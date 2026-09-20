# 四季小径 · 小红书图文与视频成品

双击 `index.html` 可本地浏览整套成品，不需要启动项目服务。

项目中的 `promo/xiaohongshu-publish.zip` 是便于传到手机的发布包，包含图文、视频、文案、预览页和核验结果，不含 `source/` 制作工程。

## 直接使用

| 内容 | 文件 | 规格 |
| --- | --- | --- |
| 图文笔记 | `images/01-cover.png` 至 `images/06-ending.png` | 6 张，1080 × 1440，3:4，PNG |
| 介绍视频 | `video/intro.mp4` | 1080 × 1920，9:16，约 53 秒，中文神经女声版、背景旋律、中文字幕 |
| 单独试听 | `video/narration-natural.m4a` | 新版配音，无背景音乐，便于单独试听 |
| 视频封面 | `video/cover.png` | 1080 × 1920，PNG |
| 发布文案 | `copy.md` | 两套标题、正文、话题与发布前说明 |
| 字幕备份 | `video/subtitles.srt` | 与视频段落对应，不需要再次叠到成片上 |
| 分镜与配音 | `video/storyboard.md` | 每段时长、画面说明、完整口播 |
| 图文总览 | `contact-sheet.jpg` | 便于一次查看全部配图，不是正文配图 |
| 素材核验 | `verification.json` | 尺寸、编码、音轨、时长与画面抽检结果 |
| 配音核验 | `voice-verification.json` | 各段语速、时长、音频峰值及画面未改变的校验 |

成片采用实际项目截图、项目原有 Canvas 绘制函数和真实通关记录；移动部分是原游戏逻辑驱动的节选动画，不是未经剪辑的完整游玩录屏。LOVE 采用真实通关坐标重新排版，没有用文字字形替代轨迹。图片和视频都没有展示可识别的私人照片；成功画面的具体日期已遮为演示信息。

## 画面与声音来源

- 游戏图像、场景、小人、路线及页面：本项目 `src/scenery.ts`、`src/game.ts`、`src/App.tsx`、`src/Ending.tsx` 等。
- 背景音：按 `src/audio.ts` 已有旋律重新合成并降低音量，无外部商用音乐或游戏原声音轨。
- 中文配音：Microsoft `zh-CN-XiaoxiaoNeural` 神经合成女声，使用 `edge-tts` 生成。不是任何真人的录音或声音克隆。只把本套公开介绍文案发送给语音服务，不上传照片或视频。
- 配音优化：常规段落语速为 -6%；告白与求婚句为 -12%；照片墙段落为 -3% 以适配原镜头。仅调整两处标点与停顿，词句及原有字幕不变，背景旋律音量降低。
- 原系统朗读版保留在 `source/previous/intro-system-voice.mp4`，原配音片段保留在 `source/previous/audio/`，不放入新版发布压缩包。
- 页面 UI：Animal Island UI，作者 guokaigdg，项目使用版本 1.12.0。项目原 README 标明其许可证为 CC BY-NC 4.0；请保留署名，本套不增加任何商业授权。
- 玩法灵感：Nicky Case 的 it's a(door)able；未引入其图像或音频。
- 没有使用《星露谷物语》的图像、音乐或品牌作素材。

## 修改与再生成

不修改游戏业务代码，也不增加 npm 依赖。`source/` 是制作工程，不需要上传到小红书。

1. 在项目根目录启动已有 Vite 开发服务。
2. 打开 `/promo/xiaohongshu/source/render.html`。该制作页需要项目开发服务；交付预览页 `index.html` 不需要。
3. 修改口播时，先编辑 `source/story.json`。在独立 Python 环境安装 `edge-tts==7.2.8` 和 `imageio-ffmpeg==0.6.0` 后运行 `python promo/xiaohongshu/source/voice.py`。生成需要网络，脚本会检查配音是否超过镜头时长；不会回退成旧系统朗读声。
4. 使用支持 H.264/AAC MediaRecorder 的浏览器点击「生成带配音 MP4」。录制期间保持页面前台，约一分钟后下载。
5. 制作页的 `window.production.renderPoster(0)` 至 `renderPoster(5)` 可以生成对应图文；返回 PNG data URL。
6. `source/capture.mjs` 的 `capture(page, baseUrl)` 用于 Ego Browser 重新采集真实页面；它会自动隐藏照片内容与具体纪念日期，且不写入项目源码。

本次只生成文件，没有登录或发布到小红书，没有改动 Git 暂存区。

只替换配音、保留当前画面时，从项目根目录运行下面的命令。首次运行先创建独立环境，并安装上述两个制作依赖；不需要修改项目 `package.json`。

```sh
python3 -m venv /tmp/marry-me-voice-tools
/tmp/marry-me-voice-tools/bin/pip install edge-tts==7.2.8 imageio-ffmpeg==0.6.0
/tmp/marry-me-voice-tools/bin/python promo/xiaohongshu/source/voice.py --output promo/xiaohongshu/source/audio-natural
/tmp/marry-me-voice-tools/bin/python promo/xiaohongshu/source/remix.py
```

`remix.py` 以已归档的本支视频为画面源，复制 H.264 画面流，只重新编码声音。它会检查所有画面包与显示时间戳、配音时长、音量和文件完整性，再替换成片；此命令专用于本支已完成视频，不用于之后重剪的其他视频。

## 已完成核验

- 首版制作时原项目 `npm test`：11 项全部通过；本次配音优化未改动游戏代码。
- 首版制作时原页面四季实际通关：4 个房间均达到 100% 探索且获得钥匙，成功抵达求婚、成功与照片墙页面。
- 新版成片：约 53.1 秒，1080 × 1920，H.264 + AAC。全部 1515 个视频包及其解码、显示时间戳与原版一致，画面和字幕没有重新编码。
- 音轨：成功解码，非静音，采样中未检测到削波；各段配音均未超过镜头时长。未进行人工听审。
- 图文与封面尺寸、9 段口播时间、字幕总时长已由 `python3 promo/xiaohongshu/source/package.py` 检查。
- `source/verify.mjs` 提供 `verify(page, baseUrl)`，供 Ego Browser 复查实际 MP4 并更新 `verification.json`。
