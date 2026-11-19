# GIVE ME YOUR FRIES! 更新日志

2026 年 11 月 19 日 · 当前版本 **v2.4** · [GitHub 游戏文件](https://github.com/sd5913/GIVE-ME-YOUR-FRIES/blob/main/GIVE_ME_YOUR_FRIES_DUO_GESTURE.html)

## Full-body Demo · 第一人称回巢跑酷 · 2026-11-19

- 新增独立 `demos/gull-flight/` 入口；键盘与身体互动共用第一人称长栈道、游客发怒和回巢障碍。
- 简化键盘：空格 / W 拍翅与逃跑，A / D 转向，E 每次抓一根；对准薯条后自动俯冲。取消 Shift 组合闪避。
- 原蓝色游客逐渐变红并生气，第二根薯条触发约 2.8 秒警戒；展翅向上逃跑，替代海边突然弹出的攻击者。
- 加长栈道，回巢限时 20 秒，新增拍翅飞越货箱与侧倾绕开招牌；擦碰只掉一根携带薯条并短时减速，巢内得分保留。
- 旧版俯视体感新增举手准备、自动校准、3 秒倒数开局及结算后举手重玩，并提供明确的第一人称键盘入口。
- 更新全身体感计划与 README 入口。保留原版 v2.4、旧俯视 Demo 及 `demos/archive/gull-flight-before-runner-2026-11-19/` 修改前第一人称副本。
- 通过键盘浏览器检查与体感模拟动作检查；DJI 摄像头实机效果待验证。

### English

- Added a separate first-person solo demo with a shared map and rules for keyboard and body controls.
- Reduced keyboard actions to flap/escape (Space or W), steer (A/D), and grab one fry (E); diving is automatic when aligned.
- The existing blue visitor gradually turns red. Collecting the second fry starts an approximately 2.8-second warning; spreading wings escapes upward.
- Extended the pier with a 20-second return timer, crates to fly over, and signs to steer around. An obstacle collision drops one carried fry and briefly slows flight; banked scores remain safe.
- Added hands-free preparation, calibration, countdown and replay to the legacy overhead demo. Archived the previous first-person prototype separately.
- Checked browser keyboard flows and simulated body controls. Real DJI camera validation remains pending.

## v2.4 · 开局前分步教学 · 2026-11-19

- 新增“摄像头手势教学”和“键盘教学”入口，完成模式与头像设置后进入练习。
- 摄像头教学先检查手部入镜并显示各玩家识别状态，再示范张手移动、拇指与食指捏合抓取、在镜头内松手回巢和飞出红圈。
- 在实际地图上练习飞进对应颜色的圈、抓一根薯条、送回巢穴和躲避游客。双人分别记录完成情况，两人完成后自动继续。
- 完成动作后短暂停留显示成功，回巢后保留 1.2 秒阅读反馈。全部完成后倒数 3 秒自动开始第一关。
- 练习期间暂停比赛计时，躲避练习提供 5 秒并允许重试。正式开局重置练习分数、携带量和倒计时。支持跳过练习。
- 摄像头或手势模型未就绪时，留在设置页显示提示，玩家可重试或选择键盘教学。
- 验证完成了单人、双人键盘全流程，以及模拟摄像头手势的入镜、移动、捏合、回巢、躲避与自动开赛。真人摄像头和双人现场试玩待验证。

### English

- Added separate camera-gesture and keyboard tutorials after mode and avatar setup.
- Camera guidance begins with live hand-detection status and illustrates open-hand flight, thumb/index pinching, in-frame release, and escaping the visitor warning circle.
- Practice tasks use the actual map and require each active player to complete the action. Completed steps advance automatically, followed by a three-second countdown into round one.
- Practice pauses the match timer, offers a repeatable five-second dodge exercise, and resets practice scores and carried fries before the match. Players can skip practice.
- Camera or model startup failure leaves the setup page available for retry or keyboard selection.
- Verified solo and duo keyboard flows and a simulated camera-hand flow through automatic match start. Real-camera reliability and in-person duo playtesting remain pending.

## v2.3 · 海鸥头像对齐

- 拍照取景框加上眉线和鸟嘴轮廓。拍摄后，游戏会尝试把照片里的眉毛和嘴对齐到海鸥脸上。
- 玩家卡片显示合成后的海鸥头像，可以在开局前查看或重拍。自动对齐不可用时，可按取景线拍摄。

## v2.2 · 游客塔防

- **抓到第一根薯条就会触发警戒。** 附近的游客头顶亮起叹号，地图上出现固定的红圈，游戏播放预警音并显示倒计时。
- 三关的撤离时间依次为 **1.65 秒、1.50 秒和 1.35 秒**。归零时游客发动范围攻击，红圈内的海鸥会被短暂击晕，脚上抓到的薯条全部掉落。
- 及时飞出红圈可以保住脚上的薯条。已带回巢穴的分数保留。

[查看 v2.2 提交](https://github.com/sd5913/Fun-interactive-game-with-two-person-cameras/commit/775d33ca64f872be677d5d5e6f95b18cc9b293b0)

## v2.1 · 双人手势与摄像头

- 把摄像头框移到两个计分栏之间、地图上缘，两个巢穴都能看见。
- 手势识别、摄像头预览和手部描线使用同一帧镜像画面，修正描线错位。
- 加快海鸥对手掌移动的响应，并按画面比例校正捏合距离。手短暂越过摄像头中线时，仍控制原来的海鸥。

[查看 v2.1 提交](https://github.com/sd5913/Fun-interactive-game-with-two-person-cameras/commit/956b97d5eeddcfe9f943d76bc027ef3094169d09)

## v2 · 模式、头像与偷薯条

- 新增单人和双人模式。单人使用整个镜头，双人各用镜头的一侧，在同一张大地图上飞行，各有自己的巢穴。
- 开局可以拍头像、上传照片或用默认头像。P1 是金帽海鸥，P2 是蓝巾海鸥，羽色也做了区分。
- 张手飞行，捏合抓薯条。抓到的薯条会直接画在海鸥脚上，飞行时也看得见。
- 移除用手势偷走整盒薯条的功能。鼠标或触屏可以重新摆放薯条盒，盒子落到海面或跨出岸边时会回到原位。
- 修复手离开镜头后海鸥自动回巢的问题。手出镜时海鸥停在原地并保留抓到的薯条，在镜头内主动松开手指仍可回巢。

[查看 v2 提交](https://github.com/sd5913/Fun-interactive-game-with-two-person-cameras/commit/56209d47ee86fcd9624770fc7b1b25d99218e893) · [查看初版备份](https://github.com/sd5913/Fun-interactive-game-with-two-person-cameras/tree/backup/pre-v2-2026-11-12)
