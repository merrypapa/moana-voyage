// 이야기 진행 (퀘스트 단계) + 대사
// 1장: 모투누이 → 마우이 → 카카모라 → 랄로타이(타마토아) → 테 카/테 피티
// 2장: 탈라의 부름 → 선원 모으기 → 거대 조개 → 마탕기 → 날로의 폭풍 → 모투페투
import * as THREE from 'three';
import { ISLANDS, ZONES, REEF } from '../config.js';

const isl = (id) => ISLANDS.find((i) => i.id === id);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const T = '탈라 할머니', TUI = '투이 족장', SINA = '시나', MOANA = '모아나', MAUI = '마우이', NAR = '이야기';

export const STAGES = [
  // ---------- 1장 ----------
  { id: 'intro', ch: 1, title: '모투누이의 아침', text: '광장에 계신 투이 족장(아빠)과 이야기하기', target: (g) => g.npcs.tui.pos },
  { id: 'coconuts', ch: 1, title: '마을 돕기', text: '야자수를 흔들어 코코넛 3개 모으기', target: (g) => g.village.nearestHarvestPalm(g.leader.worldPos()) },
  { id: 'coconutsReturn', ch: 1, title: '마을 돕기', text: '투이 족장에게 코코넛 가져가기', target: (g) => g.npcs.tui.pos },
  { id: 'tala', ch: 1, title: '할머니의 비밀', text: '서쪽 해변에서 춤추는 탈라 할머니 만나기', target: (g) => g.npcs.tala.pos },
  { id: 'cave', ch: 1, title: '숨겨진 동굴', text: '폭포 옆 숨겨진 동굴에서 북 치기', target: (g) => g.village.drumPos },
  { id: 'heart', ch: 1, title: '테 피티의 심장', text: '탈라 할머니에게 돌아가기', target: (g) => g.npcs.tala.pos },
  { id: 'setsail', ch: 1, title: '항해의 시작', text: '해변의 배에 올라 키를 잡고(H/⛵) 암초 밖으로 나가기', target: (g) => (g.leader.onBoat ? V(REEF.x, 0, REEF.z + REEF.r + 60) : g.boat.root.position) },
  { id: 'findMaui', ch: 1, title: '반신 마우이', text: '북동쪽 마우이의 섬을 찾아 마우이 만나기', target: (g) => g.maui.worldPos() },
  { id: 'kakamora', ch: 1, title: '코코넛 해적', text: '카카모라 해적선 4척 물리치기', target: () => V(ZONES.kakamora.x, 0, ZONES.kakamora.z) },
  { id: 'lalotai', ch: 1, title: '괴물의 세계로', text: '괴물의 섬 절벽을 올라 꼭대기에서 뛰어들기', target: (g) => g.locations.spireBase },
  { id: 'tamatoa', ch: 1, title: '반짝이 게 타마토아', text: '빛나는 이끼로 타마토아를 속이고 갈고리 되찾기', target: (g) => g.tamatoa.hookTarget() },
  { id: 'shapeshift', ch: 1, title: '변신 연습', text: '마우이로 바꿔(Tab/🔄) 매로 변신(Q/변신)해서 높이 날기', target: () => null },
  { id: 'teka', ch: 1, title: '용암의 방벽', text: '남동쪽 테 피티로! 테 카를 피해 용암 방벽 안으로 들어가기', target: () => V(isl('tefiti').x, 0, isl('tefiti').z) },
  { id: 'restore', ch: 1, title: '테 카의 정체', text: '테 카에게 다가가 심장 돌려주기', target: (g) => g.teka.pos },
  { id: 'homecoming', ch: 1, title: '고향으로', text: '모투누이로 돌아가 마을 사람들 만나기', target: (g) => g.npcs.tui.pos },
  // ---------- 2장 ----------
  { id: 'call', ch: 2, title: '2장 · 조상의 부름', text: '해변의 탈라 할머니와 이야기하기', target: (g) => g.npcs.tala.pos },
  { id: 'crew', ch: 2, title: '새로운 선원', text: '모니, 로토, 켈레에게 함께 가자고 하기', target: (g) => g.nextCrewTarget() },
  { id: 'clam', ch: 2, title: '거대 조개의 바다', text: '북서쪽 거대 조개의 소용돌이를 빠져나가기', target: () => V(ZONES.clam.x, 0, ZONES.clam.z) },
  { id: 'matangi', ch: 2, title: '마탕기의 섬', text: '박쥐 날개의 반신 마탕기 만나기', target: (g) => g.ch2.matangiPos },
  { id: 'flowers', ch: 2, title: '빛나는 꽃', text: '마탕기의 섬에서 빛나는 꽃 3송이 찾기', target: (g) => g.ch2.nearestFlower(g.leader.worldPos()) },
  { id: 'flowersReturn', ch: 2, title: '빛나는 꽃', text: '마탕기에게 꽃 가져가기', target: (g) => g.ch2.matangiPos },
  { id: 'storm', ch: 2, title: '날로의 폭풍', text: '폭풍을 뚫고 모투페투가 가라앉은 곳으로', target: () => V(ZONES.storm.x, 0, ZONES.storm.z) },
  { id: 'raise', ch: 2, title: '섬 끌어올리기', text: '마우이의 갈고리(F/행동)로 모투페투 끌어올리기 ×5', target: () => V(ZONES.storm.x, 0, ZONES.storm.z) },
  { id: 'finale', ch: 2, title: '다시 이어진 바다', text: '떠오른 모투페투에 발 딛기', target: () => V(ZONES.storm.x, 0, ZONES.storm.z) },
  { id: 'free', ch: 3, title: '자유 항해', text: '넓은 바다를 마음껏 탐험하세요! 🌊', target: () => null },
];

export const LINES = {
  opening: [
    { who: NAR, text: '아주 먼 옛날, 생명의 여신 테 피티의 심장을 반신 마우이가 훔쳐 갔어요.' },
    { who: NAR, text: '그 뒤로 어둠이 섬에서 섬으로 퍼지기 시작했고… 이제 모투누이까지 다가오고 있어요.' },
    { who: NAR, text: '바다는 한 소녀를 골랐어요. 바로 모투누이 족장의 딸, 모아나!' },
  ],
  tuiIntro: [
    { who: TUI, text: '모아나, 잘 잤니? 오늘은 마을 사람들을 도와주는 날이란다.' },
    { who: MOANA, text: '네, 아빠! 뭐부터 할까요?' },
    { who: TUI, text: '요즘 코코넛이 이상하구나. 야자수를 흔들어서 코코넛 3개만 가져와 주렴.' },
    { who: TUI, text: '(야자수 가까이에서 상호작용 E / 버튼을 누르면 흔들 수 있어요.)' },
  ],
  blackCoconut: [
    { who: MOANA, text: '어…? 이 코코넛, 속이 까맣게 썩었어!' },
    { who: MOANA, text: '물고기도 줄었다던데… 섬에 무슨 일이 생긴 걸까?' },
  ],
  tuiCoconuts: [
    { who: TUI, text: '고맙다, 모아나. 그런데 이 까만 코코넛은…' },
    { who: TUI, text: '걱정 마라. 우리 섬 안에 필요한 건 다 있어. 절대 암초 밖으로 나가선 안 된다.' },
    { who: SINA, text: '(엄마) 모아나, 할머니가 해변에서 널 찾으시더라.' },
  ],
  tala: [
    { who: T, text: '우리 모아나 왔구나. 오늘도 바다가 너를 부르지?' },
    { who: MOANA, text: '할머니, 코코넛이 썩어가요. 물고기도 사라지고…' },
    { who: T, text: '그건 어둠 때문이란다. 마우이가 테 피티의 심장을 훔친 날부터 시작된 어둠.' },
    { who: T, text: '너에게 보여줄 게 있어. 폭포 옆, 숨겨진 동굴로 가 보렴. 거기서 북을 쳐 보거라.' },
  ],
  cave: [
    { who: NAR, text: '둥! 둥! 둥! 동굴 안에 큰 배들이 잠들어 있어요.' },
    { who: NAR, text: '벽화 속 조상들이 별을 보며 바다를 건너던 모습이 눈앞에 펼쳐져요…' },
    { who: MOANA, text: '우리는… 항해자였어! 우리 조상들은 바다를 건너던 사람들이었어!' },
    { who: MOANA, text: '할머니한테 알려드려야 해!' },
  ],
  heart: [
    { who: T, text: '봤구나. 그래, 우리는 길을 찾는 사람들이란다.' },
    { who: T, text: '이걸 받으렴. 바다가 아주 오래전에 너에게 준… 테 피티의 심장이야.' },
    { who: NAR, text: '모아나의 목걸이 안에 초록빛 심장이 반짝여요! 💚' },
    { who: T, text: '마우이를 찾아서 바다 건너 테 피티에게 심장을 돌려주거라.' },
    { who: T, text: '해변에 배를 가져다 놓았단다. 내가 없어도… 바다 위의 가오리를 따라가렴.' },
  ],
  sailTutorial: [
    { who: NAR, text: '배 위 어디서든 H 키 또는 [⛵ 키 잡기] 버튼을 누르면 바로 배를 조종할 수 있어요.' },
    { who: NAR, text: '앞(W/조이스틱 위) = 돛 올리기, 뒤 = 돛 내리기, 좌우 = 방향 바꾸기. 바람 방향으로 가면 더 빨라요!' },
  ],
  stowaway: [
    { who: NAR, text: '달그락… 달그락… 배 위의 네모 상자가 흔들려요.' },
    { who: MOANA, text: '헤이헤이?! 너 언제 거기 들어갔어?!' },
    { who: '헤이헤이', text: '꼬꼬…? (멍~)' },
  ],
  maui: [
    { who: MAUI, text: '오오? 배다! 드디어 이 섬에서 나갈 수 있겠군!' },
    { who: MOANA, text: '당신이 마우이죠? 바람과 바다의 반신! 전 모투누이의 모아나예요.' },
    { who: MAUI, text: '그래, 바로 나야! 사람들한테 불도 주고, 섬도 끌어올리고… 뭐, 고맙다는 말은 됐어. 천만에!' },
    { who: MOANA, text: '고맙다고 안 했는데요. 이 심장을 테 피티에게 돌려줘야 해요. 같이 가요!' },
    { who: MAUI, text: '그건 저주받은 돌이야! …게다가 난 갈고리가 없으면 변신도 못 한다고.' },
    { who: MAUI, text: '좋아, 일단 배에 태워 줘. 갈고리부터 찾아야겠어.' },
  ],
  kakamoraStart: [
    { who: MAUI, text: '어이쿠… 코코넛 갑옷을 입은 꼬마 해적들, 카카모라다!' },
    { who: MAUI, text: '녀석들이 배에 올라오면 헤이헤이를 훔쳐 갈 거야. 헤이헤이는 상자에 숨겨 두는 게 좋아!' },
    { who: NAR, text: '배로 들이받거나, 코코넛을 던지거나(F), 노를 휘둘러서 해적선을 물리쳐요!' },
  ],
  kakamoraDone: [
    { who: MAUI, text: '하! 코코넛들 도망간다! 제법인데, 꼬마 항해사?' },
    { who: MAUI, text: '내 갈고리는 괴물의 세계 랄로타이에 있어. 동쪽의 뾰족한 섬 꼭대기가 입구야.' },
  ],
  spireTop: [
    { who: MAUI, text: '여기서 뛰어내려야 괴물의 세계로 갈 수 있어. 준비됐어?' },
  ],
  lalotai: [
    { who: NAR, text: '여기는 괴물들의 세계, 랄로타이. 반짝이는 보물이 가득해요.' },
    { who: '타마토아', text: '오호? 반짝반짝하지 않은 손님들이네? 내 보물 구경하러 왔니?' },
    { who: MAUI, text: '내 갈고리가 저 녀석 등껍질에 붙어 있어!' },
    { who: NAR, text: '빛나는 이끼(초록 불빛) 옆에서 상호작용하면 반짝이 미끼를 만들 수 있어요. 타마토아가 한눈을 팔 때 뒤로 가서 갈고리를 빼 와요!' },
  ],
  gotHook: [
    { who: MAUI, text: '내 갈고리! 드디어 돌아왔구나!' },
    { who: '타마토아', text: '안 돼~! 내 반짝이~!' },
    { who: MAUI, text: '저기 간헐천에 뛰어들면 위로 돌아갈 수 있어. 가자!' },
  ],
  shapeshift: [
    { who: MAUI, text: '천 년 만에 잡아보는 갈고리… 변신이 잘 될까?' },
    { who: NAR, text: 'Tab 키 또는 🔄 버튼으로 마우이를 조종할 수 있어요. Q 또는 [변신] 버튼으로 매가 되어 보세요!' },
    { who: NAR, text: '날 때: 스페이스/[점프]를 누르면 위로, C/[내려가기]를 누르면 아래로 가요.' },
  ],
  shapeshiftDone: [
    { who: MAUI, text: '하하! 아직 녹슬지 않았어! 크아악~ (매 울음소리)' },
    { who: MOANA, text: '좋아요, 이제 테 피티로 가요! 남동쪽 끝이에요.' },
    { who: MAUI, text: '거기엔 용암 악마 테 카가 있어. 조심해. 내가 녀석의 주의를 끌어 볼게.' },
  ],
  tekaAwake: [
    { who: NAR, text: '쿠구구궁… 용암 방벽 속에서 거대한 불의 악마, 테 카가 일어났어요!' },
    { who: MAUI, text: '불덩이를 피해! 빨간 원이 보이면 그 자리를 벗어나!' },
  ],
  tekaReveal: [
    { who: MOANA, text: '잠깐… 테 피티가 있던 자리가… 비어 있어.' },
    { who: MOANA, text: '테 카의 가슴에 나선 무늬가 있어. 테 피티와 똑같은 나선…' },
    { who: MOANA, text: '테 카는 괴물이 아니야. 심장을 잃어버린 테 피티야!' },
    { who: NAR, text: '바다가 길을 열어 줘요. 테 카가 다가오면 상호작용해서 심장을 돌려주세요.' },
  ],
  restored: [
    { who: NAR, text: '심장이 제자리를 찾자, 불길이 식고 초록 잎이 돋아나요…' },
    { who: NAR, text: '테 카는 다시 생명의 여신 테 피티가 되었어요! 🌺' },
    { who: MAUI, text: '테 피티… 정말 미안해요. 제가 잘못했어요.' },
    { who: NAR, text: '테 피티가 미소 지으며 마우이에게 새 갈고리를 선물해요. 시든 섬들이 모두 되살아나요!' },
    { who: MOANA, text: '이제 집으로 돌아가자! 모두에게 알려야 해.' },
  ],
  homecoming: [
    { who: TUI, text: '모아나! 정말 네가 해냈구나!' },
    { who: SINA, text: '코코넛도 다시 하얗고, 물고기도 돌아왔단다.' },
    { who: TUI, text: '이제 우리 모투누이 사람들은 다시 바다를 항해할 거야. 네가 길을 열었어.' },
    { who: NAR, text: '🎉 1장 완료! 모투누이에 다시 배들이 떠요.' },
  ],
  call: [
    { who: T, text: '(가오리 모습의 할머니 영혼이 반짝여요) 모아나, 더 먼 바다가 너를 부르고 있어.' },
    { who: T, text: '옛날 모든 바다 사람들을 이어주던 섬, 모투페투. 폭풍의 신 날로가 그 섬을 바다 밑에 가라앉혔단다.' },
    { who: T, text: '조상 타우타이 바사가 너를 기다린다. 혼자 가지 말고 믿을 수 있는 선원들과 함께 가렴.' },
  ],
  moni: [
    { who: '모니', text: '마우이랑 모험을 한다고?! 난 마우이 이야기를 전부 외우고 있어! 당연히 갈래!' },
  ],
  loto: [
    { who: '로토', text: '배를 고쳐 달라고? 좋아! 돛을 개량하면 훨씬 빨라질 거야. 뚝딱뚝딱~' },
    { who: NAR, text: '⛵ 배가 업그레이드되었어요! 속도가 빨라졌어요.' },
  ],
  kele: [
    { who: '켈레', text: '흠… 난 밭일이 좋은데. 그래도 누군가는 너희 먹을 걸 챙겨야겠지. 가자.' },
    { who: NAR, text: '켈레가 배에 먹을 것을 잔뜩 실었어요! (음식 +)' },
  ],
  simea: [
    { who: '시메아', text: '언니! 꼭 돌아와야 해. 약속!' },
    { who: MOANA, text: '약속할게, 시메아. 금방 올게!' },
  ],
  crewDone: [
    { who: MOANA, text: '모두 모였어! 북서쪽, 날로의 폭풍 너머로 출발!' },
  ],
  clamStart: [
    { who: '모니', text: '으악! 바다가 빙글빙글 돌아! 거대 조개의 소용돌이야!' },
    { who: MAUI, text: '돛을 활짝 펴고 바깥쪽으로 빠져나가! 내가 갈고리로 조개를 때려 줄게!' },
  ],
  clamDone: [
    { who: '로토', text: '휴우~ 내가 고친 돛 덕분이지! 그렇지?' },
    { who: MOANA, text: '저 섬… 박쥐 날개 모양 바위가 있어. 마탕기의 섬이야!' },
  ],
  matangi: [
    { who: '마탕기', text: '어머, 손님이네? 날로의 폭풍을 지나가려고? 호호, 쉽지 않을걸.' },
    { who: '마탕기', text: '내 섬에 핀 빛나는 꽃 세 송이를 찾아와. 그럼 폭풍을 뚫는 길을 알려주지.' },
  ],
  matangiDone: [
    { who: '마탕기', text: '잘했어. 폭풍의 눈은 모투페투 바로 위에 있어. 번개가 떨어지는 곳을 피해서 가.' },
    { who: '마탕기', text: '섬을 끌어올리는 건… 섬을 낚아 올리던 반신만 할 수 있겠지?' },
    { who: MAUI, text: '그건 내 전문이지!' },
  ],
  stormCenter: [
    { who: MOANA, text: '여기야! 바다 밑에 섬이 보여!' },
    { who: MAUI, text: '갈고리를 걸고… 끌어올린다! (마우이로 행동 버튼을 5번!)' },
  ],
  raised: [
    { who: NAR, text: '우르르르… 바다 밑에서 모투페투가 떠올라요! 폭풍이 걷혀요!' },
    { who: NAR, text: '흩어졌던 바다 사람들의 뱃길이 다시 하나로 이어졌어요. 🌈' },
  ],
  finale: [
    { who: MOANA, text: '우리가 해냈어! 이제 모든 바다가 이어졌어.' },
    { who: MAUI, text: '당연하지. 누가 도와줬는데? 천만에!' },
    { who: NAR, text: '🎉 축하해요! 모아나와 마우이의 항해가 끝났어요. 이제 넓은 바다를 자유롭게 탐험해 보세요!' },
  ],
};

export class Quests {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.flags = {};
  }
  get stage() { return STAGES[this.index]; }
  get id() { return this.stage.id; }
  idx(id) { return STAGES.findIndex((s) => s.id === id); }
  atLeast(id) { return this.index >= this.idx(id); }
  is(id) { return this.id === id; }

  setStage(id, silent = false) {
    const i = this.idx(id);
    if (i < 0) return;
    this.index = i;
    this.game.onStageEnter(this.stage, silent);
  }

  advance(fromId) {
    if (fromId && this.id !== fromId) return false;
    if (this.index >= STAGES.length - 1) return false;
    this.index++;
    this.game.audio.play('quest');
    this.game.hud.toast(`✨ 새 목표: ${this.stage.text}`);
    this.game.onStageEnter(this.stage, false);
    this.game.save();
    return true;
  }

  target() {
    const s = this.stage;
    try { return s.target ? s.target(this.game) : null; } catch { return null; }
  }
}
