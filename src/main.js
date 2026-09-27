// 시작점: 타이틀 화면 → 게임
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);

const HELP = `
<table>
<tr><td>이동</td><td>WASD / 방향키 · 아이패드: 왼쪽 조이스틱</td></tr>
<tr><td>달리기</td><td>Shift 누르고 있기 · [🏃 달리기] 버튼(누르면 켜짐/꺼짐) · 조이스틱 끝까지 밀기</td></tr>
<tr><td>점프</td><td>Space · [점프]</td></tr>
<tr><td>상호작용</td><td>E · [상호작용] — 대화, 키 잡기, 돛대 오르기, 헤이헤이 안기/상자에 넣기, 배 타기/내리기</td></tr>
<tr><td>행동</td><td>F · [행동] — 모아나: 코코넛 던지기/노 휘두르기 · 마우이: 갈고리 내려치기</td></tr>
<tr><td>변신 (마우이)</td><td>Q · [변신] — 갈고리가 있으면 매로 변신! 날 때 Space=위, C=아래</td></tr>
<tr><td>먹기</td><td>R · [먹기]</td></tr>
<tr><td>캐릭터 전환</td><td>Tab · 🔄 (모아나 ↔ 마우이)</td></tr>
<tr><td>지도</td><td>M · 🗺️</td></tr>
<tr><td>카메라</td><td>마우스 드래그 / 화면 드래그 · 휠 / 두 손가락으로 확대</td></tr>
<tr><td>항해</td><td>배 뒤쪽 키에서 E → 앞=돛 올리기, 뒤=돛 내리기, 좌우=방향</td></tr>
</table>
<p>💙 바다에 빠져도 걱정 마세요. 바다가 모아나를 배 위로 데려다줘요!</p>`;

async function boot() {
  $('helpText').innerHTML = HELP;
  const game = new Game($('game'));
  window.game = game; // 디버그용
  try {
    game.init();
  } catch (e) {
    console.error(e);
    $('loading').textContent = '이 기기에서는 3D(WebGL)를 켤 수 없어요 😢';
    return;
  }
  // 타이틀 뒤로 바다를 보여주기
  game.camera.position.set(40, 30, 420);
  game.camera.lookAt(0, 20, 0);
  game.sky.update(0.3, game.camera.position, game.scene.fog, game.ocean, 0);
  game.ocean.update(0, game.camera, game.scene.fog);
  const titleLoop = () => {
    if (game.started) return;
    const t = performance.now() / 1000;
    game.camera.position.set(Math.sin(t * 0.05) * 450, 40, Math.cos(t * 0.05) * 450);
    game.camera.lookAt(0, 20, 0);
    game.ocean.update(t, game.camera, game.scene.fog);
    game.sky.update(0.3, game.camera.position, game.scene.fog, game.ocean, 0);
    game.renderer.render(game.scene, game.camera);
    requestAnimationFrame(titleLoop);
  };
  titleLoop();
  $('loading').textContent = '';
  if (Game.hasSave()) $('btnContinue').classList.remove('hidden');

  const begin = (isNew) => {
    game.audio.init();
    $('title').classList.add('hidden');
    if (isNew || !game.load()) {
      game.newGame();
      game.start();
      game.dialog.show(game.lines.opening, () => game.hud.toast('광장의 투이 족장에게 가 보세요! (⭐/나침반 방향)'));
    } else {
      game.start();
      game.hud.toast('이어서 모험을 시작해요! 🌊');
    }
    game.input.onFirstTouch = () => {};
    if (matchMedia('(pointer: coarse)').matches) document.getElementById('touch').classList.remove('hidden');
  };
  $('btnNew').addEventListener('click', () => {
    if (Game.hasSave() && !confirm('새로 시작하면 저장된 진행이 지워져요. 괜찮을까요?')) return;
    begin(true);
  });
  $('btnContinue').addEventListener('click', () => begin(false));
  $('btnHelp').addEventListener('click', () => { $('menu').classList.remove('hidden'); $('btnResume').onclick = () => $('menu').classList.add('hidden'); });
}

boot();
