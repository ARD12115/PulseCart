'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function ThreeJSBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.02);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Lighting
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

    // Scroll interaction
    let scrollProgress = 0;
    let targetScrollProgress = 0;

    function updateScroll() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      targetScrollProgress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
    }
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    // Pointer interaction
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    function onPointerMove(e: PointerEvent) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      targetMouseX = ((x / rect.width) * 2 - 1) * 0.7;
      targetMouseY = (-(y / rect.height) * 2 + 1) * 0.5;
    }
    window.addEventListener('pointermove', onPointerMove);

    // Resize handling
    function onResize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // Animation Loop
    const clock = new THREE.Clock();

    function animate() {
      if (!mounted) return;
      requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      scrollProgress += (targetScrollProgress - scrollProgress) * 0.07;
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      const scrollPosX = Math.sin(scrollProgress * Math.PI * 2) * 1.6;
      const scrollPosY = -scrollProgress * 2.2 + Math.cos(scrollProgress * Math.PI) * 0.5;
      const scrollZoomZ = 6.2 - scrollProgress * 3.8;

      camera.position.x = scrollPosX + currentMouseX * 0.5;
      camera.position.y = scrollPosY + currentMouseY * 0.4;
      camera.position.z = scrollZoomZ;
      camera.lookAt(scrollPosX * 0.5, scrollPosY * 0.5, 0);

      masterGroup.rotation.y = elapsedTime * 0.18 + scrollProgress * Math.PI * 3 + currentMouseX * 0.4;
      masterGroup.rotation.x = scrollProgress * 1.8 + currentMouseY * 0.3;
      masterGroup.rotation.z = Math.sin(scrollProgress * Math.PI * 2) * 0.4;

      innerCore.rotation.x = elapsedTime * 0.35 + scrollProgress * 4.0;
      innerCore.rotation.y = elapsedTime * 0.5 + scrollProgress * 5.0;
      innerWire.rotation.x = innerCore.rotation.x;
      innerWire.rotation.y = innerCore.rotation.y;

      const armorScale = 1.0 + scrollProgress * 0.85 + Math.sin(elapsedTime * 2) * 0.05;
      armorMesh.scale.set(armorScale, armorScale, armorScale);
      armorMesh.rotation.y = -elapsedTime * 0.4 - scrollProgress * 3.0;

      ring1.rotation.z = elapsedTime * 0.45 + scrollProgress * 6.0;
      ring2.rotation.x = elapsedTime * -0.55 - scrollProgress * 5.0;
      ring3.rotation.y = elapsedTime * 0.3 + scrollProgress * 4.0;

      const orbitExpansion = 1.0 + scrollProgress * 0.9;
      for (let i = 0; i < satellites.length; i++) {
        const s = satellites[i];
        s.angle += s.speed * (1.0 + scrollProgress * 2.5);
        const r = s.radius * orbitExpansion;
        s.mesh.position.x = Math.cos(s.angle) * r;
        s.mesh.position.z = Math.sin(s.angle) * r;
        s.mesh.position.y = s.y + Math.sin(elapsedTime * 2 + i) * 0.2;
        s.mesh.rotation.x += 0.02 + scrollProgress * 0.05;
        s.mesh.rotation.y += 0.03 + scrollProgress * 0.05;
      }

      particles.rotation.y = elapsedTime * 0.03 + scrollProgress * 1.2;
      particles.position.y = -scrollProgress * 2.0;

      gridHelper.position.z = ((elapsedTime * 0.6 + scrollProgress * 8.0) % 2) - 1;
      gridHelper.position.y = -2.6 + scrollProgress * 1.4;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full z-[-1] pointer-events-none"
      style={{ backgroundColor: 'transparent' }}
    />
  );
}