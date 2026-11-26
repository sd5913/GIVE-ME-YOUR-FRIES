'use strict';
const english = {
  "操作指引 · 游戏正常进行": "Controls guide · Game is live",
  "隐藏指引": "Hide guide",
  "继续抓取或展翅离开": "Grab more or fly away",
  "张手再握拳可以继续抓；准备好后，双臂向两侧展开逃跑。": "Open and close your hand to grab another fry. When ready, spread both arms to escape.",
  "飞回巢穴": "Fly back to your nest",
  "继续拍翅越过货箱，侧倾绕开招牌，把薯条带回巢。": "Keep flapping over crates and leaning around signs to bring your fries home.",
  "拍动双臂两次": "Flap twice",
  "双肩和手肘保持入镜，上下拍动；下方会显示次数。": "Keep both shoulders and elbows in view. Flap up and down and watch the count.",
  "侧倾对准薯条": "Lean toward the fries",
  "向薯条盒侧倾，盒边亮起后就对准了。": "Lean toward the carton until its edge lights up.",
  "收翅俯冲": "Tuck to dive",
  "两侧手肘收向身体，短暂保持；不用先展翅。": "Bring both elbows close to your sides and hold briefly.",
  "张手再握拳": "Open, then close",
  "单手伸到胸前，张开五指后用同一只手握拳。": "Raise one hand to your chest. Open your palm, then make a fist with the same hand.",
  "展开双臂离开": "Spread your wings",
  "抓到薯条后直接展开双臂，保持片刻就能飞走。": "After grabbing a fry, spread both arms and hold briefly to fly away.",
  "准备正式出发": "Ready for takeoff",
  "目标：把薯条带回巢。练习所得不会计入正式得分。": "Take your fries back to the nest. Practice fries do not count toward your score.",
  "练习完成 · ": "Practice complete · Starting in ",
  " 秒后开始": " s",
  "体感练习 ": "Flight school ",
  " / 5 · 无攻击、无倒计时": " / 5 · No attacks or timer",
  "左": "left",
  "右": "right",
  "拍两下翅膀": "Flap twice",
  "按 W 或空格 · ": "W or Space · ",
  "张开双臂，上下扑动 · ": "Spread your arms and flap · ",
  "向": "Lean ",
  "倾斜": "",
  " · 飞向薯条盒": " · Head for the carton",
  "上半身缓慢朝薯条倾斜": "Lean your upper body toward the fries",
  "看准薯条": "Watch the fries",
  "等薯条盒边缘亮起": "Wait for the carton to light up",
  "自动俯冲": "Diving in",
  "对准即可降落，不用按键": "Line up and you will dive automatically",
  "把两侧手肘收向身体": "Bring both elbows in",
  "俯冲！": "Dive!",
  "空格 / W · 向上飞走，躲开游客": "Space / W · Fly up and away",
  "双臂展开，向上逃跑": "Spread both arms to escape",
  "展翅逃跑": "Fly away!",
  "鸟爪抓取中": "Grabbing",
  "握拳抓薯条": "Make a fist",
  "每按一次 E 抓一根": "Press E once per fry",
  "握紧刚才伸出的那只手": "Close the same hand you opened",
  "再抢一根，还是逃？": "One more, or fly?",
  "抢薯条！": "Snatch a fry!",
  "再张手，或飞走": "Open again or fly away",
  "伸手张开五指": "Show an open palm",
  "E 抓一根 · ": "E to grab · ",
  "把一只手伸到胸前，掌心朝向摄像头": "Raise one hand to your chest, palm facing the camera",
  "向上逃跑！": "Fly away!",
  "空格 / W · 拍翅升空": "Space / W · Flap to climb",
  "展开双臂，拍翅升空": "Spread your arms and flap to climb",
  "拍翅！飞过货箱": "Flap over the crates!",
  "避开码头招牌": "Dodge the pier sign",
  "空格 / W · 向上飞": "Space / W · Climb",
  "A / ← · 飞到左边": "A / ← · Fly left",
  "D / → · 飞到右边": "D / → · Fly right",
  "拍动双臂，飞越货箱": "Flap both arms to clear the crates",
  "身体侧倾，绕开招牌": "Lean to dodge the sign",
  "沿栈道飞回巢穴": "Follow the pier home",
  "空格 / W 拍翅 · A / D 换边": "Space / W to flap · A / D to steer",
  "拍翅飞翔，侧倾绕开障碍": "Flap to fly and lean around obstacles",
  "薯条掉了！": "Fries dropped!",
  "落巢！": "Home!",
  " 根薯条": " to the nest",
  "偷到了！": "Got away with it!",
  "空爪回巢": "Home empty-clawed",
  "这趟带回 ": "Delivered this trip: ",
  " 根。巢里共有 ": ". In the nest: ",
  " 根薯条。": ".",
  "这趟的薯条掉了。巢里还有 ": "Fries dropped. Still in the nest: ",
  " 根。": ".",
  "擦碰！掉了 1 根": "Clipped it! Lost one fry",
  "漂亮！": "Nice!",
  "没赶回巢": "Time ran out",
  "请让两侧手肘保持入镜": "Keep both elbows in view",
  "已看到收翅，确认中…": "Tuck detected. Hold briefly…",
  "已识别张手 · 握紧同一只手": "Palm detected. Close the same hand",
  "请把刚才那只手放回镜头里": "Bring the same hand back into view",
  "已看到手 · 请张开五指": "Hand detected. Open your palm",
  "已看到手 · 请把手抬到胸口前": "Hand detected. Raise it to chest height",
  "还没看到手 · 掌心朝向摄像头": "Show your palm to the camera",
  "校准完成。开始体感后，张开双臂拍两下起飞。": "Calibrated. Start body mode and flap twice to take off.",
  "姿态识别中断。请重新开启摄像头。": "Pose tracking stopped. Restart the camera.",
  "手势识别中断。请重新开启摄像头。": "Hand tracking stopped. Restart the camera.",
  "关闭摄像头": "Stop camera",
  "开启摄像头": "Start camera",
  "系统默认摄像头": "System default camera",
  "视频输入 ": "Camera ",
  "体感请用 Chrome 打开本地试玩网址，再开启摄像头。": "Open the local game in Chrome to use body mode.",
  "等待相机权限…": "Waiting for camera permission…",
  "相机未输出视频": "No video from camera",
  "相机已断开。重新连接后点击开启摄像头。": "Camera disconnected. Reconnect it and select Start camera.",
  "正在加载身体和手势识别…": "Loading body and hand tracking…",
  "摄像头已连接": "Camera connected",
  " · 调整镜头，让双肩和两侧手肘入镜，再校准；不必拍到髋部。": " · Frame both shoulders and elbows, then calibrate. Hips can stay out of view.",
  "体感识别加载失败。检查网络后重新开启相机。": "Tracking failed to load. Check your connection and restart the camera.",
  "请允许 Chrome 访问摄像头，再点开启。": "Allow camera access in Chrome, then select Start camera.",
  "相机正被占用或读不到画面。关闭正在使用相机的页面后重试。": "Camera busy or unavailable. Close other camera apps or tabs and retry.",
  "未找到相机。检查 DJI 已进入 Webcam 模式并重新选择。": "No camera found. Check DJI Webcam mode and select the input again.",
  "相机启动失败。请重新选择视频输入。": "Could not start camera. Select the input again.",
  "请后退或调整镜头，让双肩入镜（只有脸无法识别拍翅）": "Step back or tilt the camera until both shoulders are visible",
  "请让两侧手肘入镜，再上下拍动双臂": "Keep both elbows in view, then flap",
  "摄像头已关闭。": "Camera off.",
  "在活动区中央正对屏幕，站稳约 1 秒。": "Face the screen and stand still for about one second.",
  "请让双肩和两侧手肘入镜，再开始体感。": "Keep shoulders and elbows in view before starting.",
  "用浏览器全屏": "Use browser fullscreen",
  "退出全屏": "Exit fullscreen",
  "全屏": "Fullscreen",
  "设置": "Settings",
  "声音": "Sound",
  "海鸥俯冲": "Gull Dive",
  "抢薯条，飞回巢。": "Snatch the fries. Fly home.",
  "抢走游客的薯条，看他气得脸红！拍翅向上逃跑，飞越货箱、绕开招牌，把薯条带回巢。": "Steal a fry before the tourist catches you. Flap over crates, dodge pier signs and bring your haul home.",
  "拍翅": "Flap",
  "起飞、逃跑、飞越货箱": "Take off, escape and clear crates",
  "侧倾": "Lean",
  "转向、绕开招牌": "Steer and dodge signs",
  "靠近薯条": "Approach",
  "键盘自动俯冲 · 体感收翅": "Keyboard: auto-dive · Body: tuck",
  "抓一根": "Grab a fry",
  "键盘按 E · 体感张手再握拳": "Press E or open and close one hand",
  "开始体感": "Play with camera",
  "键盘试玩": "Play with keyboard",
  "空格": "Space",
  "拍翅、升空、逃跑": "flap, climb and escape",
  "左右转向": "steer",
  "每按一次抓一根": "grab one per press",
  "对准薯条后自动俯冲。游客变红时，立即拍翅飞走！": "Line up to dive. When the tourist turns red, flap away!",
  "体感：收翅俯冲，单手张开再握拳抓一根；游客变红时双臂展开逃跑。回巢路上拍翅越过货箱，侧倾绕开招牌。": "Body mode: tuck to dive. Open and close one hand to grab. Spread both arms to escape. Flap over crates and lean around signs on the way home.",
  "摄像头预览": "Camera preview",
  "视频输入": "Camera input",
  "校准站位": "Calibrate",
  "用 USB 连接 DJI 并选 Webcam，开启后在上方选择对应输入。": "For DJI, connect via USB and choose Webcam mode, then start the camera and select its input above.",
  "第": "Trip",
  "趟": "",
  "巢内": "Nest",
  "回巢倒计时": "Time to reach home",
  "游客要出手了": "Incoming swing!",
  "爪上薯条": "Fries held",
  "抓到了！": "Got it!",
  "请让肩膀和髋部重新入镜": "Bring your shoulders and elbows into view",
  "码头飞行": "Pier flight",
  "再飞一趟": "Fly again",
  "返回设置": "Settings",
  "重练": "Retry",
  "跳过练习": "Skip practice",
  "第一人称码头，屏幕两侧是海鸥的翅膀": "First-person pier view with gull wings",
  "镜像摄像头预览": "Mirrored camera preview",
  "校准进度": "Calibration progress",
  "体感动作练习": "Body control practice",
  "↑ 拍翅飞越": "↑ Flap over",
  "巢穴": "Nest"
};
let gameLanguage='zh-CN';
try { if(localStorage.getItem('gull-language')==='en') gameLanguage='en'; } catch {}
function tr(source) { return gameLanguage==='en' ? english[source] ?? source : source; }

const languageSelect=document.getElementById('language');
const staticLabels=[];
const words=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(words.nextNode()) {
  const node=words.currentNode, original=node.data, key=original.trim();
  if(Object.hasOwn(english,key)) staticLabels.push(()=>{node.data=original.replace(key,tr(key));});
}
for(const el of document.querySelectorAll('[aria-label]')){
  const key=el.getAttribute('aria-label');
  staticLabels.push(()=>el.setAttribute('aria-label',tr(key)));
}
function applyLanguage(){
  document.documentElement.lang=gameLanguage;
  languageSelect.value=gameLanguage;
  for(const render of staticLabels) render();
  document.title='GIVE ME YOUR FRIES! · '+tr('海鸥俯冲');
}
applyLanguage();
languageSelect.onchange=()=>{
  const previous=gameLanguage;
  gameLanguage=languageSelect.value;
  try { localStorage.setItem('gull-language',gameLanguage); } catch {}
  applyLanguage();
  // Some live labels replace the original HTML text nodes after initialization.
  const live=[document.getElementById('cameraStatus'),document.getElementById('fullscreen'),...device.options];
  for(const el of live){
    const current=el.textContent;
    const key=previous==='en' ? Object.keys(english).find(k=>english[k]===current) : current;
    if(key && Object.hasOwn(english,key)) el.textContent=tr(key);
  }
  if(stream && tracker && !calibration && !neutral && !document.getElementById('cameraStatus').classList.contains('error'))
    cameraStatus(stream.getVideoTracks()[0].label+tr(' · 调整镜头，让双肩和两侧手肘入镜，再校准；不必拍到髋部。'));
  updateCameraButtons();
};
