'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeJSKineticSceneProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollProgress: number;
  targetMouseX: number;
  targetMouseY: number;
}

export default function ThreeJSKineticScene({
  containerRef,
  scrollProgress,
  targetMouseX,
  targetMouseY,
}: ThreeJSKineticSceneProps) {
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Reduced motion + low-end device guard
    const reduce =
      document.documentElement.dataset.motion === 'reduce' ||
      (document.documentElement.dataset.motion !== 'full' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches);
    const isCart = location.pathname.startsWith('/cart');
    const isMobile = matchMedia('(max-width: 650px)').matches;
    if (reduce || isMobile || isCart) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.02);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6.2);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xd4ff00, 2.8);
    dirLight1.position.set(6, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 2.2);
    dirLight2.position.set(-6, -5, -4);
    scene.add(dirLight2);

    // Master Group
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Core Monolith
    const coreGroup = new THREE.Group();
    masterGroup.add(coreGroup);

    const innerCoreGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const innerCoreMat = new THREE.MeshPhongMaterial({
      color: 0x111114,
      emissive: 0x1c2800,
      specular: 0xd4ff00,
      shininess: 100,
      flatShading: true,
    });
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    coreGroup.add(innerCore);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xd4ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.88,
    });
    const innerWire = new THREE.Mesh(innerCoreGeo, wireMat);
    innerWire.scale.set(1.03, 1.03, 1.03);
    coreGroup.add(innerWire);

    const armorGeo = new THREE.OctahedronGeometry(1.8, 0);
    const armorMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const armorMesh = new THREE.Mesh(armorGeo, armorMat);
    coreGroup.add(armorMesh);

    const ringGeo1 = new THREE.TorusGeometry(2.1, 0.035, 16, 80);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xd4ff00 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    coreGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(2.45, 0.025, 16, 80);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    coreGroup.add(ring2);

    const ringGeo3 = new THREE.TorusGeometry(2.8, 0.018, 16, 80);
    const ringMat3 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
    const ring3 = new THREE.Mesh(ringGeo3, ringMat3);
    ring3.rotation.z = Math.PI / 6;
    coreGroup.add(ring3);

    // Satellites
    const satCount = 10;
    const satellites: any[] = [];
    const satColors = [0xd4ff00, 0x00f0ff, 0xffffff, 0xd4ff00, 0x00f0ff];

    for (let i = 0; i < satCount; i++) {
      const satGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const col = satColors[i % satColors.length];
      const satMat = new THREE.MeshPhongMaterial({
        color: 0x0e0e11,
        emissive: col,
        emissiveIntensity: 0.55,
        flatShading: true,
      });
      const satMesh = new THREE.Mesh(satGeo, satMat);
      const satWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(satGeo),
        new THREE.LineBasicMaterial({ color: col }),
      );
      satMesh.add(satWire);

      const angle = (i / satCount) * Math.PI * 2;
      const radius = 3.2 + (i % 3) * 0.45;
      const yOffset = ((i % 5) - 2) * 0.65;

      satMesh.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
      masterGroup.add(satMesh);
      satellites.push({ mesh: satMesh, speed: 0.006 + (i % 3) * 0.003, radius, angle, y: yOffset });
    }

    // Grid
    const gridHelper = new THREE.GridHelper(40, 50, 0xd4ff00, 0x1f2410);
    gridHelper.position.y = -2.6;
    scene.add(gridHelper);

    // Particle swarm
    const particleCount = 340;
    const pGeometry = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);

    const colorLime = new THREE.Color(0xd4ff00);
    const colorCyan = new THREE.Color(0x00f0ff);
    const colorWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 18;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 16;

      const rand = Math.random();
      const c = rand > 0.6 ? colorLime : rand > 0.3 ? colorCyan : colorWhite;
      pColors[i * 3] = c.r;
      pColors[i * 3 + 1] = c.g;
      pColors[i * 3 + 2] = c.b;
    }

    pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeometry.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const pMaterial = new THREE.PointsMaterial({
      size: 0.048,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const particles = new THREE.Points(pGeometry, pMaterial);
    scene.add(particles);

    // Animation Loop
    const clock = new THREE.Clock();
    let running = true;
    let raf = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    // Visibility handling — pause when tab is hidden
    const onVis = () => {
      running = !document.hidden;
      if (running) {
        clock.getDelta();
        raf = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    function animate() {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      const scrollPosX = Math.sin(scrollProgress * Math.PI * 2) * 1.6;
      const scrollPosY = -scrollProgress * 2.2 + Math.cos(scrollProgress * Math.PI) * 0.5;
      const scrollZoomZ = 6.2 - scrollProgress * 3.8;

      camera.position.x = scrollPosX + currentMouseX * 0.5;
      camera.position.y = scrollPosY + currentMouseY * 0.4;
      camera.position.z = scrollZoomZ;
      camera.lookAt(scrollPosX * 0.5, scrollPosY * 0.5, 0);

      masterGroup.rotation.y = elapsedTime * 0.18 + currentMouseX * 0.4;
      masterGroup.rotation.x = currentMouseY * 0.3;
      masterGroup.rotation.z = Math.sin(elapsedTime * 0.5) * 0.4;

      innerCore.rotation.x = elapsedTime * 0.35;
      innerCore.rotation.y = elapsedTime * 0.5;
      innerWire.rotation.x = innerCore.rotation.x;
      innerWire.rotation.y = innerCore.rotation.y;

      const armorScale = 1.0 + Math.sin(elapsedTime * 2) * 0.05;
      armorMesh.scale.set(armorScale, armorScale, armorScale);
      armorMesh.rotation.y = -elapsedTime * 0.4;

      ring1.rotation.z = elapsedTime * 0.45;
      ring2.rotation.x = elapsedTime * -0.55;
      ring3.rotation.y = elapsedTime * 0.3;

      const orbitExpansion = 1.0 + Math.sin(elapsedTime * 0.5) * 0.3;
      for (let i = 0; i < satellites.length; i++) {
        const s = satellites[i];
        s.angle += s.speed;
        const r = s.radius * orbitExpansion;
        s.mesh.position.x = Math.cos(s.angle) * r;
        s.mesh.position.z = Math.sin(s.angle) * r;
        s.mesh.position.y = s.y + Math.sin(elapsedTime * 2 + i) * 0.2;
        s.mesh.rotation.x += 0.02;
        s.mesh.rotation.y += 0.03;
      }

      particles.rotation.y = elapsedTime * 0.03;
      particles.position.y = Math.sin(elapsedTime * 0.5) * 1.0;

      gridHelper.position.z = ((elapsedTime * 0.6) % 2) - 1;
      gridHelper.position.y = -2.6 + Math.sin(elapsedTime * 0.5) * 1.4;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      scene.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose();
        const material = object.material;
        if (material) {
          const materials = Array.isArray(material) ? material : [material];
          materials.forEach((m: any) => m.dispose());
        }
      });
      renderer.dispose();
    };
  }, [containerRef, scrollProgress, targetMouseX, targetMouseY]);

  return null;
}