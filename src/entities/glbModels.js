// 사용자가 올린 캐릭터 GLB 모델 (assets/models/*.glb)
// 파일이 없거나 불러오기에 실패하면 기존 도형 모델을 그대로 사용한다.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MODEL_FILES = {
  moana: { url: 'assets/models/moana.glb', height: 1.65 },
  maui: { url: 'assets/models/maui.glb', height: 2.6 },
  heihei: { url: 'assets/models/heihei.glb', height: 0.7 },
};

export async function loadCharacterModels(onEach) {
  const loader = new GLTFLoader();
  const out = {};
  await Promise.all(Object.entries(MODEL_FILES).map(async ([key, info]) => {
    try {
      const gltf = await loader.loadAsync(info.url);
      out[key] = gltf.scene;
    } catch (e) {
      console.warn(`[모델] ${key} 불러오기 실패, 기본 모델 사용`, e);
    }
    if (onEach) onEach(key, !!out[key]);
  }));
  return out;
}

// GLB를 발바닥이 y=0, 가운데가 원점, 키가 height가 되도록 맞춘다
function fitModel(scene, height, yaw) {
  const model = scene;
  model.rotation.set(0, yaw, 0);
  model.scale.setScalar(1);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(height / box.getSize(new THREE.Vector3()).y);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

// 도형 모델(parts)의 몸통 안에 GLB를 끼워 넣고, 도형 부품은 숨긴다.
// keep: 계속 보여야 하는 부품(심장 등). arm: 들고 있는 물건(노, 갈고리)을 붙인 팔.
export function attachGLB(parts, scene, { height, yaw = 0, keep = [], arm = null }) {
  const holder = new THREE.Group();
  holder.name = 'glb';
  const box = fitModel(scene, height, yaw);
  holder.add(scene);
  for (const ch of parts.body.children) {
    if (keep.includes(ch)) continue;
    if (arm && ch === arm) {
      // 팔 자체(피부 원기둥)는 숨기고, 들고 있는 물건만 남긴다
      ch.visible = true;
      for (const g of ch.children) if (g.isMesh) g.visible = false;
      continue;
    }
    ch.visible = false;
  }
  parts.body.add(holder);
  parts.glb = holder;
  parts.glbBox = box;
  return holder;
}
