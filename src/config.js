// 월드 설정: 섬, 지역, 상수
// 좌표계: x = 동쪽, z = 남쪽(+), -z = 북쪽. 1 단위 = 1m.

export const WORLD = {
  half: 5200, // 지도 범위 ±half
  waterLevel: 0,
  seaFloor: -32,
};

// type: tropical(열대), sand(모래섬), spire(탑섬), lava(용암), teFiti, dark(마탕기), rock
// blobs: 섬 중심 기준 좌표. h=최고 높이, flat=정상부 평탄 비율(작을수록 절벽), pow=경사 곡률
export const ISLANDS = [
  {
    id: 'motunui', name: '모투누이', x: 0, z: 0, radius: 360, type: 'tropical', startDiscovered: true,
    desc: '모아나의 고향 마을',
    blobs: [
      { x: 0, z: -125, r: 185, h: 105, flat: 1, pow: 1.7 },
      { x: 0, z: 25, r: 262, h: 4, flat: 0.36 },
      { x: -175, z: -35, r: 105, h: 34, flat: 1, pow: 1.3 },
      { x: 165, z: -70, r: 110, h: 28, flat: 1, pow: 1.4 },
      { x: 0, z: -255, r: 90, h: 20, flat: 0.8, pow: 1.2 },
    ],
  },
  {
    id: 'maui', name: '마우이의 섬', x: 1150, z: -1350, radius: 170, type: 'sand',
    desc: '마우이가 천 년 동안 갇혀 있던 섬',
    blobs: [
      { x: 0, z: 0, r: 125, h: 6, flat: 0.5 },
      { x: 25, z: -45, r: 60, h: 34, flat: 0.55, pow: 1.2 },
    ],
  },
  {
    id: 'kakamora_rock', name: '카카모라 암초', x: 2150, z: -520, radius: 80, type: 'rock',
    desc: '코코넛 해적 카카모라가 출몰하는 바다',
    blobs: [{ x: 0, z: 0, r: 55, h: 14, flat: 0.6, pow: 1.3 }],
  },
  {
    id: 'lalotai', name: '괴물의 섬 (랄로타이 입구)', x: 2750, z: -2150, radius: 200, type: 'spire',
    desc: '꼭대기에서 괴물들의 세계로 뛰어들 수 있다',
    blobs: [
      { x: 0, z: 0, r: 140, h: 5, flat: 0.45 },
      { x: 0, z: 0, r: 34, h: 150, flat: 0.28 },
    ],
  },
  {
    id: 'tefiti', name: '테 피티', x: 3750, z: -3550, radius: 260, type: 'teFiti', blighted: true,
    desc: '생명의 여신 테 피티가 있던 섬',
    blobs: [
      { x: 0, z: 0, r: 210, h: 7, flat: 0.5 },
      { x: -40, z: -60, r: 90, h: 38, flat: 1, pow: 1.4 },
    ],
  },
  {
    id: 'clam', name: '거대 조개의 바다', x: -1650, z: -1900, radius: 90, type: 'rock',
    desc: '배를 삼키는 거대한 조개가 산다',
    blobs: [{ x: 60, z: 40, r: 45, h: 10, flat: 0.6 }],
  },
  {
    id: 'matangi', name: '마탕기의 섬', x: -2650, z: -2950, radius: 220, type: 'dark',
    desc: '박쥐 날개를 가진 반신 마탕기의 둥지',
    blobs: [
      { x: 0, z: 0, r: 170, h: 8, flat: 0.5 },
      { x: 20, z: -30, r: 90, h: 70, flat: 1, pow: 1.1 },
    ],
  },
  {
    id: 'motufetu', name: '모투페투', x: -3500, z: -4300, radius: 230, type: 'tropical', sunken: true,
    desc: '바다 사람들을 이어주던 전설의 섬',
    blobs: [
      { x: 0, z: 0, r: 190, h: 8, flat: 0.45 },
      { x: 30, z: -20, r: 80, h: 45, flat: 1, pow: 1.3 },
    ],
  },
  // 작은 섬들 (탐험, 코코넛 보급)
  {
    // 위에서 보면 거북이 모양: 등껍질 언덕 + 머리(북쪽) + 네 발 + 꼬리
    id: 'turtle', name: '거북이 섬', x: 720, z: 680, radius: 215, type: 'sand', turtles: true,
    desc: '아기 거북이와 어른 거북이 100마리가 사는 섬',
    blobs: [
      { x: 0, z: 0, r: 150, h: 4, flat: 0.5 },
      { x: 0, z: 10, r: 85, h: 18, flat: 0.95 },
      { x: 0, z: -150, r: 40, h: 6, flat: 0.5 },
      { x: -120, z: -70, r: 46, h: 3, flat: 0.5 },
      { x: 120, z: -70, r: 46, h: 3, flat: 0.5 },
      { x: -95, z: 100, r: 38, h: 3, flat: 0.5 },
      { x: 95, z: 100, r: 38, h: 3, flat: 0.5 },
      { x: 0, z: 165, r: 22, h: 2, flat: 0.6 },
    ],
  },
  { id: 'palm', name: '야자수 섬', x: -900, z: -300, radius: 120, type: 'tropical', blobs: [{ x: 0, z: 0, r: 90, h: 7, flat: 0.5 }, { x: 20, z: 10, r: 40, h: 18, flat: 1 }] },
  { id: 'coral', name: '산호 섬', x: 400, z: -700, radius: 90, type: 'sand', blobs: [{ x: 0, z: 0, r: 60, h: 5, flat: 0.5 }] },
  { id: 'twin_a', name: '쌍둥이 섬 (동)', x: 1850, z: -1500, radius: 100, type: 'tropical', blobs: [{ x: 0, z: 0, r: 70, h: 16, flat: 0.7, pow: 1.2 }] },
  { id: 'twin_b', name: '쌍둥이 섬 (서)', x: 1700, z: -1620, radius: 90, type: 'tropical', blobs: [{ x: 0, z: 0, r: 60, h: 14, flat: 0.7, pow: 1.2 }] },
  { id: 'bird', name: '새들의 섬', x: 3000, z: -900, radius: 110, type: 'tropical', blobs: [{ x: 0, z: 0, r: 80, h: 22, flat: 0.8, pow: 1.3 }] },
  { id: 'blight1', name: '시든 섬', x: 3000, z: -3100, radius: 110, type: 'tropical', blighted: true, blobs: [{ x: 0, z: 0, r: 80, h: 12, flat: 0.6 }] },
  { id: 'blight2', name: '잿빛 섬', x: 4200, z: -2700, radius: 110, type: 'tropical', blighted: true, blobs: [{ x: 0, z: 0, r: 75, h: 15, flat: 0.6 }] },
  { id: 'star', name: '별빛 섬', x: -1200, z: 900, radius: 110, type: 'sand', blobs: [{ x: 0, z: 0, r: 75, h: 6, flat: 0.5 }] },
  { id: 'banyan', name: '반얀 섬', x: -500, z: -1500, radius: 130, type: 'tropical', blobs: [{ x: 0, z: 0, r: 95, h: 12, flat: 0.5 }, { x: -20, z: 0, r: 45, h: 30, flat: 1, pow: 1.2 }] },
  { id: 'mist', name: '안개 섬', x: -2300, z: -1000, radius: 110, type: 'rock', blobs: [{ x: 0, z: 0, r: 70, h: 26, flat: 0.8, pow: 1.1 }] },
  { id: 'east', name: '해돋이 섬', x: 2300, z: 600, radius: 120, type: 'tropical', blobs: [{ x: 0, z: 0, r: 85, h: 10, flat: 0.5 }] },
];

// 테 카의 용암 방벽: 테 피티 주위를 둘러싼 용암 섬들
const TF = ISLANDS.find((i) => i.id === 'tefiti');
for (let k = 0; k < 11; k++) {
  const a = (k / 11) * Math.PI * 2 + 0.2;
  const R = 470;
  ISLANDS.push({
    id: `lava${k}`, name: '용암 방벽', x: TF.x + Math.sin(a) * R, z: TF.z + Math.cos(a) * R,
    radius: 90, type: 'lava', lavaRing: true, blighted: true,
    blobs: [{ x: 0, z: 0, r: 62, h: 22 + (k % 3) * 8, flat: 1, pow: 1.1 }],
  });
}

// 모투누이 암초 (배가 부딪히는 바위, 남쪽은 열려 있음)
export const REEF = { x: 0, z: 0, r: 440, gapAngle: 0, gapWidth: 0.42 };

// 특별한 지역
export const ZONES = {
  kakamora: { x: 2050, z: -650, r: 650 },
  storm: { x: -3500, z: -4300, r: 750 },
  clam: { x: -1650, z: -1900, r: 160 },
  lalotaiArena: { x: 9000, z: 9000, r: 120 }, // 지도 밖, 지하 세계
};

export const BOAT_START = { x: 30, z: 241, yaw: 0.1 };
export const PLAYER_START = { x: 6, z: 70 };
