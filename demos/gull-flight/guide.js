
'use strict';

// Non-blocking tutorial overlay.
// Never changes gameplay, input or timing.

const learnedActions = new Set();
const seenObstacleTypes = new Set();

const guideCopy = {
  flap: ['↕', '拍翅起飞', 'Flap to take off'],
  lean: ['↔', '侧倾对准游客', 'Lean toward the tourist'],
  tuck: ['↓', '收肘俯冲', 'Tuck elbows to dive'],
  grab: ['✋ → ✊', '张手再握拳', 'Open palm, then close'],
  escape: ['↑', '展开双臂逃跑', 'Spread your wings'],
  crates: ['↑', '拍翅飞越木箱', 'Flap over the crates'],
  sign: ['↔', '侧倾绕过路牌', 'Lean around the sign'],
  highCrates: ['↑', '拍翅飞越高箱堆', 'Flap over tall crates'],
  umbrella: ['↔', '绕开遮阳伞', 'Dodge the umbrella'],
  bunting: ['↔', '避开彩旗绳', 'Dodge the bunting'],
  restaurant: ['↔', '绕过餐厅招牌', 'Dodge the restaurant sign'],
  cart: ['↔', '绕开移动餐车', 'Dodge the moving cart'],
  gull: ['↔', '避让其他海鸥', 'Dodge the rival gull'],
  home: ['⌂', '飞回巢穴', 'Fly back to your nest']
};

let guideKey = '';
let guideShown = new Set();
let previousObstacle = null;

function resetGuide() {
  guideKey = '';
  guideShown.clear();
  previousObstacle = null;

  if (currentLevel === 1) {
    learnedActions.clear();
    seenObstacleTypes.clear();
  }

  document.getElementById('bodyLesson').hidden = true;
}

function guideCandidate(g) {
  if (g.phase === 'launch') return 'flap';

  if (g.phase === 'approach') {
    return isLinedUp(g) ? 'tuck' : 'lean';
  }

  if (g.phase === 'grab') {
    const npc = g.npcs?.[g.npcIndex];
    return npc?.stolen ? 'escape' : 'grab';
  }

  if (g.phase === 'chase') {
    const obstacle = upcomingObstacle(g);
    return obstacle ? obstacle.kind : 'home';
  }

  return '';
}

function updateGuide(g, now) {
  const panel = document.getElementById('bodyLesson');
  const key = guideCandidate(g);

  if (g.flaps >= 2) learnedActions.add('flap');
  if (g.phase === 'dive') {
    learnedActions.add('lean');
    learnedActions.add('tuck');
  }
  if (g.npcs?.some(n => n.stolen > 0)) {
    learnedActions.add('grab');
  }
  if (g.phase === 'chase') {
    learnedActions.add('escape');
  }

  const obstacle = g.phase === 'chase'
    ? upcomingObstacle(g)
    : null;

  if (previousObstacle?.passed) {
    seenObstacleTypes.add(previousObstacle.kind);
    previousObstacle = null;
  }

  if (!key) {
    panel.hidden = true;
    guideKey = '';
    return;
  }

  if (key !== guideKey || obstacle !== previousObstacle) {
    guideKey = key;
    previousObstacle = obstacle;

    const copy = guideCopy[key] || [
      '↔', '注意避让', 'Dodge the obstacle'
    ];

    const animate = currentLevel === 1
      ? !guideShown.has(key)
      : Boolean(obstacle && !seenObstacleTypes.has(key));

    guideShown.add(key);

    panel.dataset.animate = String(animate);
    panel.dataset.action = key === 'grab' ? 'hand' : key;

    document.getElementById('lessonProgress').textContent =
      currentLevel === 1
        ? 'LEVEL 01 · TUTORIAL'
        : 'LEVEL 02 · CHALLENGE';

    const english = document.documentElement.lang === 'en';

    document.getElementById('lessonTitle').textContent =
      english ? copy[2] : copy[1];

    document.getElementById('lessonDetail').textContent =
      mode === 'keyboard'
        ? (
            ['flap', 'crates', 'highCrates', 'escape'].includes(key)
              ? 'W / SPACE'
              : key === 'grab'
                ? 'E'
                : key === 'tuck'
                  ? 'AUTO DIVE'
                  : 'A / D'
          )
        : english ? copy[1] : copy[2];

    document.getElementById('lessonDemo').innerHTML = `
      <span>${copy[0]}</span>
      <svg viewBox="0 0 240 160">
        <g class="demo-person"
          fill="none"
          stroke="#fff2ca"
          stroke-width="10"
          stroke-linecap="round">
          <circle cx="120" cy="22" r="13"
            fill="#ffd46e" stroke="none"/>
          <path d="M120 47V104M120 104L100 145M120 104L140 145"/>
          <g class="demo-arm left">
            <path d="M110 52L77 69L42 61"/>
          </g>
          <g class="demo-arm right">
            <path d="M130 52L163 69L198 61"/>
          </g>
        </g>
      </svg>`;

    if (key === 'grab' && animate) {
      document.getElementById('lessonDemo').innerHTML =
        '<span class="hand-open">✋</span>' +
        '<span class="hand-closed">✊</span>';
    }
  }

  panel.hidden = [
    'setup', 'hit', 'home', 'result', 'dive'
  ].includes(g.phase);
}
