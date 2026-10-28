import { useEffect, useRef } from "react";
import * as THREE from "three";
import { clampToCell, type Patrimonio, type Sala } from "@/lib/asset-store";
import { settings, useSettings } from "@/lib/settings";

const STATUS_COLOR = {
  online: new THREE.Color("#4f9d78"),
  offline: new THREE.Color("#c96a6a"),
};

/** Reaplica as cores de status escolhidas em Configurações > Acessibilidade. */
function applyStatusColors() {
  const cfg = settings.get();
  STATUS_COLOR.online.set(cfg.corOnline);
  STATUS_COLOR.offline.set(cfg.corOffline);
}

const BODY_COLOR = "#c9ced6";
const BODY_SELECTED = "#dfe6f2";
const DETAIL_COLOR = "#e9ecf1";

const KIND_SIZE: Record<string, [number, number, number]> = {
  desktop: [0.7, 0.55, 0.5],
  notebook: [0.65, 0.22, 0.45],
  servidor: [0.8, 1.6, 0.8],
  switch: [1.1, 0.25, 0.6],
  impressora: [0.8, 0.6, 0.7],
};

export interface IsometricRoomHandle {
  rotate: (dir: 1 | -1) => void;
}

interface Props {
  sala: Sala;
  assets: Patrimonio[];
  focusId: string | null;
  selectedId: string | null;
  canDrag: boolean;
  onSelect: (id: string | null) => void;
  onRelocate: (id: string, x: number, z: number) => void;
  onBlocked?: ((id: string) => void) | undefined;
  onContextMenu?: ((id: string, clientX: number, clientY: number) => void) | undefined;
  onContextEmpty?: ((x: number, z: number, clientX: number, clientY: number) => void) | undefined;

  controlsRef?: React.MutableRefObject<IsometricRoomHandle | null>;
}

export function IsometricRoom({
  sala,
  assets,
  focusId,
  selectedId,
  canDrag,
  onSelect,
  onRelocate,
  onBlocked,
  onContextMenu,
  onContextEmpty,
  controlsRef,
}: Props) {
  const cores = useSettings();
  const mountRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    sync: (assets: Patrimonio[], selectedId: string | null) => void;
    focus: (id: string) => void;
    setDrag: (v: boolean) => void;
    setTheme: (dark: boolean) => void;
    rotate: (dir: 1 | -1) => void;
    handlers: {
      onSelect: Props["onSelect"];
      onRelocate: Props["onRelocate"];
      onBlocked?: Props["onBlocked"];
      onContextMenu?: Props["onContextMenu"];
      onContextEmpty?: Props["onContextEmpty"];
    };
  } | null>(null);

  // Cena criada uma única vez (câmera isométrica com rotação travada em 90º).
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f4f5f7");

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const target = new THREE.Vector3(0, 0, 0);
    // Direção isométrica base — a rotação apenas gira este vetor em passos de 90º.
    const ISO_BASE = new THREE.Vector3(1, 0.92, 1).normalize();
    const frustum = 12;
    const camera = new THREE.OrthographicCamera(-frustum, frustum, frustum, -frustum, 0.1, 200);
    camera.zoom = 2.1;

    let yaw = 0; // ângulo atual (rad)
    let yawTarget = 0; // ângulo alvo travado em múltiplos de 90º

    const isoDir = new THREE.Vector3();
    const applyCamera = () => {
      const aspect = width / height || 1;
      camera.left = -frustum * aspect;
      camera.right = frustum * aspect;
      camera.top = frustum;
      camera.bottom = -frustum;
      isoDir.copy(ISO_BASE).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      camera.position.copy(target).addScaledVector(isoDir, 60);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    };
    applyCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    // Iluminação suave e difusa
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3e8, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(14, 20, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -20;
    key.shadow.camera.right = 20;
    key.shadow.camera.top = 20;
    key.shadow.camera.bottom = -20;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-12, 10, -8);
    scene.add(fill);

    // Piso da sala
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(sala.largura, 0.2, sala.profundidade),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, metalness: 0 }),
    );
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grade alinhada exatamente às células unitárias usadas pelo snap (limites inteiros).
    const halfX = sala.largura / 2;
    const halfZ = sala.profundidade / 2;
    const gridPts: number[] = [];
    for (let x = Math.ceil(-halfX); x <= Math.floor(halfX); x++) {
      gridPts.push(x, 0, -halfZ, x, 0, halfZ);
    }
    for (let z = Math.ceil(-halfZ); z <= Math.floor(halfZ); z++) {
      gridPts.push(-halfX, 0, z, halfX, 0, z);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3));
    const gridMat = new THREE.LineBasicMaterial({ color: 0xdfe3e9 });
    const grid = new THREE.LineSegments(gridGeo, gridMat);
    grid.position.y = 0.003;
    scene.add(grid);

    // Marcador da célula da grade durante o arraste
    const snapMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: "#8894ab", transparent: true, opacity: 0.28 }),
    );
    snapMarker.rotation.x = -Math.PI / 2;
    snapMarker.position.y = 0.006;
    snapMarker.visible = false;
    scene.add(snapMarker);

    // Paredes baixas (maquete arquitetônica)
    const wallMat = new THREE.MeshStandardMaterial({ color: "#e9ecf1", roughness: 1 });
    const wallH = 1.1;
    const walls: [number, number, number, number, number][] = [
      [sala.largura, wallH, 0.18, 0, -sala.profundidade / 2],
      [sala.largura, wallH, 0.18, 0, sala.profundidade / 2],
    ];
    walls.forEach(([w, h, d, x, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, h / 2, z);
      m.receiveShadow = true;
      m.castShadow = true;
      scene.add(m);
    });
    [-1, 1].forEach((s) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH, sala.profundidade), wallMat);
      m.position.set((s * sala.largura) / 2, wallH / 2, 0);
      m.receiveShadow = true;
      m.castShadow = true;
      scene.add(m);
    });

    const group = new THREE.Group();
    scene.add(group);

    type Entry = {
      root: THREE.Group;
      body: THREE.MeshStandardMaterial;
      lights: THREE.MeshStandardMaterial[];
      ring: THREE.Mesh;
      height: number;
      desired: THREE.Vector2;
    };
    const entries = new Map<string, Entry>();
    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

    /** Modelos low poly montados a partir de primitivas nativas do Three.js. */
    const buildModel = (a: Patrimonio) => {
      const root = new THREE.Group();
      const body = new THREE.MeshStandardMaterial({
        color: BODY_COLOR,
        roughness: 0.6,
        metalness: 0.05,
        emissive: STATUS_COLOR[a.status].clone(),
        emissiveIntensity: 0.45,
      });
      const detail = new THREE.MeshStandardMaterial({ color: DETAIL_COLOR, roughness: 0.8, flatShading: true });
      const lightMats: THREE.MeshStandardMaterial[] = [];
      disposables.push(body, detail);

      const add = (
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        pos: [number, number, number],
        rot?: [number, number, number],
      ) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...pos);
        if (rot) m.rotation.set(...rot);
        m.castShadow = true;
        m.receiveShadow = true;
        disposables.push(geo);
        root.add(m);
        return m;
      };

      const led = (pos: [number, number, number], r = 0.045) => {
        const mat = new THREE.MeshStandardMaterial({
          color: STATUS_COLOR[a.status].clone(),
          emissive: STATUS_COLOR[a.status].clone(),
          emissiveIntensity: 1.1,
          roughness: 0.4,
        });
        lightMats.push(mat);
        disposables.push(mat);
        add(new THREE.SphereGeometry(r, 8, 6), mat, pos);
      };

      const [w, h, d] = KIND_SIZE[a.tipo] ?? [0.7, 0.6, 0.6];

      if (a.tipo === "servidor") {
        add(new THREE.BoxGeometry(w, h, d), body, [0, h / 2, 0]);
        // gavetas / racks
        for (let i = 0; i < 5; i++) {
          add(new THREE.BoxGeometry(w * 0.82, 0.16, 0.05), detail, [0, 0.28 + i * 0.26, d / 2 + 0.01]);
          led([w * 0.3, 0.28 + i * 0.26, d / 2 + 0.06], 0.035);
        }
        // pés e topo ventilado
        add(new THREE.BoxGeometry(w * 1.05, 0.06, d * 1.05), detail, [0, h + 0.03, 0]);
        [-1, 1].forEach((sx) =>
          [-1, 1].forEach((sz) =>
            add(new THREE.BoxGeometry(0.08, 0.06, 0.08), detail, [(sx * w) / 2.6, 0.03, (sz * d) / 2.6]),
          ),
        );
      } else if (a.tipo === "switch") {
        add(new THREE.BoxGeometry(w, h, d), body, [0, h / 2, 0]);
        // portas RJ45 em duas fileiras
        for (let i = 0; i < 8; i++) {
          const x = -w / 2 + 0.14 + i * ((w - 0.24) / 7);
          add(new THREE.BoxGeometry(0.07, 0.05, 0.03), detail, [x, h * 0.32, d / 2 + 0.005]);
          add(new THREE.BoxGeometry(0.07, 0.05, 0.03), detail, [x, h * 0.68, d / 2 + 0.005]);
        }
        led([w / 2 - 0.07, h * 0.55, d / 2 + 0.03], 0.035);
        add(new THREE.BoxGeometry(w * 0.92, 0.03, d * 0.9), detail, [0, h + 0.015, 0]);
      } else if (a.tipo === "desktop") {
        // conjunto unificado: mesa + PC apoiado no tampo
        const deskH = 0.72;
        const dw = 0.98;
        const dd = 0.66;
        add(new THREE.BoxGeometry(dw, 0.06, dd), detail, [0, deskH, 0]);
        [-1, 1].forEach((sx) =>
          [-1, 1].forEach((sz) =>
            add(new THREE.BoxGeometry(0.07, deskH, 0.07), body, [
              sx * (dw / 2 - 0.07),
              deskH / 2,
              sz * (dd / 2 - 0.07),
            ]),
          ),
        );
        // travessa da mesa
        add(new THREE.BoxGeometry(dw * 0.9, 0.05, 0.05), body, [0, deskH * 0.35, -dd / 2 + 0.09]);

        const topY = deskH + 0.03;
        // gabinete sobre a mesa
        add(new THREE.BoxGeometry(w * 0.42, h * 0.8, d * 0.62), body, [-dw * 0.3, topY + h * 0.4, -0.02]);
        add(new THREE.BoxGeometry(w * 0.24, 0.04, 0.03), detail, [-dw * 0.3, topY + h * 0.62, d * 0.3]);
        led([-dw * 0.3, topY + h * 0.28, d * 0.31], 0.035);
        // monitor centralizado sobre o tampo
        add(new THREE.BoxGeometry(w * 0.95, 0.5, 0.05), body, [dw * 0.12, topY + 0.42, -0.13]);
        add(new THREE.BoxGeometry(w * 0.82, 0.4, 0.02), detail, [dw * 0.12, topY + 0.42, -0.1]);
        add(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), detail, [dw * 0.12, topY + 0.11, -0.13]);
        add(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 6), detail, [dw * 0.12, topY + 0.015, -0.13]);
        // teclado
        add(new THREE.BoxGeometry(w * 0.8, 0.04, 0.2), detail, [dw * 0.12, topY + 0.02, 0.18]);
      } else if (a.tipo === "notebook") {
        add(new THREE.BoxGeometry(w, 0.07, d), body, [0, 0.035, 0]);
        add(new THREE.BoxGeometry(w * 0.8, 0.02, d * 0.55), detail, [0, 0.075, 0.06]);
        add(new THREE.BoxGeometry(w * 0.3, 0.015, d * 0.2), detail, [0, 0.075, -0.13]);
        // tampa inclinada
        const lid = add(new THREE.BoxGeometry(w, 0.05, d * 0.95), body, [0, 0.28, -d * 0.42], [-1.15, 0, 0]);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.02, d * 0.8), detail);
        screen.position.set(0, 0.04, 0);
        lid.add(screen);
        led([w * 0.38, 0.08, d * 0.4], 0.03);
      } else if (a.tipo === "impressora") {
        add(new THREE.BoxGeometry(w, h * 0.7, d), body, [0, h * 0.35, 0]);
        // bandeja de saída e alimentação
        add(new THREE.BoxGeometry(w * 0.85, 0.04, d * 0.6), detail, [0, h * 0.72, 0.06]);
        add(new THREE.BoxGeometry(w * 0.7, 0.05, d * 0.5), detail, [0, h * 0.2, d * 0.42], [0.35, 0, 0]);
        add(new THREE.BoxGeometry(w * 0.45, 0.1, 0.03), detail, [-w * 0.2, h * 0.5, d / 2 + 0.01]);
        led([w * 0.28, h * 0.5, d / 2 + 0.03]);
        add(new THREE.BoxGeometry(w * 0.6, 0.12, d * 0.7), body, [0, h * 0.78, -0.05]);
      } else {
        add(new THREE.BoxGeometry(w, h, d), body, [0, h / 2, 0]);
        led([0, h * 0.6, d / 2 + 0.03]);
      }

      root.position.set(a.x, 0, a.z);
      root.userData['id'] = a.id;
      root.traverse((o) => {
        o.userData['id'] = a.id;
      });

      const ringGeo = new THREE.RingGeometry(0.55, 0.72, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: STATUS_COLOR[a.status].clone(),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });
      disposables.push(ringGeo, ringMat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(a.x, 0.01, a.z);

      group.add(root);
      group.add(ring);
      entries.set(a.id, {
        root,
        body,
        lights: lightMats,
        ring,
        height: h,
        desired: new THREE.Vector2(a.x, a.z),
      });
    };

    let currentAssets: Patrimonio[] = [];
    const sync = (list: Patrimonio[], selected: string | null) => {
      currentAssets = list;
      const seen = new Set<string>();
      list.forEach((a) => {
        seen.add(a.id);
        let e = entries.get(a.id);
        if (!e) {
          buildModel(a);
          e = entries.get(a.id)!;
        }
        if (!dragging || dragging.id !== a.id) {
          e.desired.set(a.x, a.z);
        }
        e.body.emissive.copy(STATUS_COLOR[a.status]);
        e.body.emissiveIntensity = a.status === "offline" ? 0.75 : 0.4;
        e.body.color.set(a.id === selected ? BODY_SELECTED : BODY_COLOR);
        e.lights.forEach((m) => {
          m.color.copy(STATUS_COLOR[a.status]);
          m.emissive.copy(STATUS_COLOR[a.status]);
        });
        (e.ring.material as THREE.MeshBasicMaterial).color.copy(STATUS_COLOR[a.status]);
        (e.ring.material as THREE.MeshBasicMaterial).opacity = a.id === selected ? 0.95 : 0.5;
      });
      entries.forEach((e, id) => {
        if (!seen.has(id)) {
          group.remove(e.root);
          group.remove(e.ring);
          entries.delete(id);
        }
      });
    };

    // Interação: pan, zoom, seleção e drag-and-drop (raycasting)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let canDragRef = canDrag;
    let dragging: { id: string; from: THREE.Vector2; startX: number; startY: number; moved: boolean } | null =
      null;
    let panning: { x: number; y: number } | null = null;
    const handlers = { onSelect, onRelocate, onBlocked, onContextMenu, onContextEmpty };

    const setPointer = (e: PointerEvent | MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };

    const pickAssetId = () => {
      raycaster.setFromCamera(pointer, camera);
      const roots = [...entries.values()].map((e) => e.root);
      const hits = raycaster.intersectObjects(roots, true);
      return (hits[0]?.object.userData['id'] as string | undefined) ?? undefined;
    };

    const groundPoint = () => {
      raycaster.setFromCamera(pointer, camera);
      return raycaster.ray.intersectPlane(plane, hit) ? hit.clone() : null;
    };

    /** Trava anti-sobreposição: uma célula da grade só aceita um ativo. */
    const cellOccupied = (id: string, x: number, z: number) =>
      currentAssets.some(
        (a) => a.id !== id && Math.abs(a.x - x) < 0.5 && Math.abs(a.z - z) < 0.5,
      );

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 2) return;
      setPointer(e);
      const id = pickAssetId();
      if (id) {
        handlers.onSelect(id);
        if (canDragRef && e.button === 0) {
          const entry = entries.get(id)!;
          dragging = { id, from: entry.desired.clone(), startX: e.clientX, startY: e.clientY, moved: false };
          snapMarker.visible = true;
          renderer.domElement.setPointerCapture(e.pointerId);
          renderer.domElement.style.cursor = "grabbing";
        }
        return;
      }
      handlers.onSelect(null);
      panning = { x: e.clientX, y: e.clientY };
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      setPointer(e);
      if (dragging) {
        if (!dragging.moved && Math.hypot(e.clientX - dragging.startX, e.clientY - dragging.startY) < 5) return;
        dragging.moved = true;
        const gp = groundPoint();
        if (!gp) return;
        const entry = entries.get(dragging.id);
        if (!entry) return;
        const { x, z } = clampToCell(sala, gp.x, gp.z);
        entry.desired.set(x, z);
        snapMarker.position.set(x, 0.006, z);
        const blocked = cellOccupied(dragging.id, x, z);
        (snapMarker.material as THREE.MeshBasicMaterial).color.set(blocked ? "#c96a6a" : "#8894ab");
        return;
      }
      if (panning) {
        const dx = (e.clientX - panning.x) / camera.zoom / 26;
        const dy = (e.clientY - panning.y) / camera.zoom / 26;
        // deslocamento no plano do chão respeitando o ângulo isométrico atual
        const axis = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3(1, 0, -1).normalize().applyAxisAngle(axis, yaw);
        const fwd = new THREE.Vector3(1, 0, 1).normalize().applyAxisAngle(axis, yaw);
        target.addScaledVector(right, -dx).addScaledVector(fwd, -dy);
        panning = { x: e.clientX, y: e.clientY };
        applyCamera();
        return;
      }
      renderer.domElement.style.cursor = pickAssetId() ? (canDragRef ? "grab" : "pointer") : "default";
    };

    const endPointer = (e: PointerEvent) => {
      if (dragging) {
        const entry = entries.get(dragging.id);
        if (entry) {
          const x = entry.desired.x;
          const z = entry.desired.y;
          const moved =
            dragging.moved &&
            (Math.abs(x - dragging.from.x) > 0.01 || Math.abs(z - dragging.from.y) > 0.01);
          if (!moved) {
            entry.desired.copy(dragging.from);
          } else if (cellOccupied(dragging.id, x, z)) {
            entry.desired.copy(dragging.from);
            handlers.onBlocked?.(dragging.id);
          } else {
            handlers.onRelocate(dragging.id, x, z);
          }
        }
        dragging = null;
        snapMarker.visible = false;
      }
      panning = null;
      renderer.domElement.style.cursor = "default";
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      setPointer(e);
      const id = pickAssetId();
      if (id) {
        handlers.onSelect(id);
        handlers.onContextMenu?.(id, e.clientX, e.clientY);
        return;
      }
      // clique com botão direito no chão (grade vazia)
      const gp = groundPoint();
      if (!gp) return;
      const { x, z } = clampToCell(sala, gp.x, gp.z);
      handlers.onSelect(null);
      handlers.onContextEmpty?.(x, z, e.clientX, e.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * Math.exp(-dy * 0.0015), 0.5, 4);
      applyCamera();
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", endPointer);
    renderer.domElement.addEventListener("pointercancel", endPointer);
    renderer.domElement.addEventListener("contextmenu", onContext);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      width = mount.clientWidth;
      height = mount.clientHeight;
      renderer.setSize(width, height);
      applyCamera();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      // rotação suave até o ângulo travado
      if (Math.abs(yawTarget - yaw) > 0.0005) {
        yaw += (yawTarget - yaw) * 0.12;
        applyCamera();
      } else if (yaw !== yawTarget) {
        yaw = yawTarget;
        applyCamera();
      }
      // suavidade no arraste dos ativos
      entries.forEach((e) => {
        const p = e.root.position;
        const nx = p.x + (e.desired.x - p.x) * 0.28;
        const nz = p.z + (e.desired.y - p.z) * 0.28;
        p.set(nx, 0, nz);
        e.ring.position.set(nx, 0.01, nz);
      });
      renderer.render(scene, camera);
    };
    loop();

    api.current = {
      sync,
      focus: (id: string) => {
        const a = currentAssets.find((p) => p.id === id);
        if (!a) return;
        target.set(a.x, 0, a.z);
        camera.zoom = Math.max(camera.zoom, 1.8);
        applyCamera();
      },
      setDrag: (v) => {
        canDragRef = v;
      },
      setTheme: (dark: boolean) => {
        scene.background = new THREE.Color(dark ? "#171a21" : "#f4f5f7");
        (floor.material as THREE.MeshStandardMaterial).color.set(dark ? "#22262e" : "#ffffff");
        gridMat.color.set(dark ? "#3a404c" : "#dfe3e9");
        wallMat.color.set(dark ? "#2c313b" : "#e9ecf1");
      },
      rotate: (dir) => {
        yawTarget += (dir * Math.PI) / 2;
      },
      handlers,
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", endPointer);
      renderer.domElement.removeEventListener("pointercancel", endPointer);
      renderer.domElement.removeEventListener("contextmenu", onContext);
      renderer.domElement.removeEventListener("wheel", onWheel);
      disposables.forEach((d) => d.dispose());
      gridGeo.dispose();
      gridMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala.id, sala.largura, sala.profundidade]);

  useEffect(() => {
    if (api.current) api.current.handlers.onSelect = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (api.current) api.current.handlers.onRelocate = onRelocate;
  }, [onRelocate]);
  useEffect(() => {
    if (api.current) api.current.handlers.onBlocked = onBlocked;
  }, [onBlocked]);
  useEffect(() => {
    if (api.current) api.current.handlers.onContextMenu = onContextMenu;
  }, [onContextMenu]);

  useEffect(() => {
    if (api.current) api.current.handlers.onContextEmpty = onContextEmpty;
  }, [onContextEmpty]);
  useEffect(() => {
    api.current?.setDrag(canDrag);
  }, [canDrag]);
  useEffect(() => {
    applyStatusColors();
    api.current?.setTheme(cores.tema === "escuro");
    api.current?.sync(assets, selectedId);
  }, [assets, selectedId, cores.corOnline, cores.corOffline, cores.tema]);
  useEffect(() => {
    if (focusId) api.current?.focus(focusId);
  }, [focusId]);
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = { rotate: (d) => api.current?.rotate(d) };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);

  return <div ref={mountRef} className="h-full w-full" />;
}
