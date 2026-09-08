import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Check, ChevronDown, Download, FileUp, ImageDown, Info, Maximize2, Minimize2, MousePointer2, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import bustAsset from "./assets/bust.glb";
import torusAsset from "./assets/torus.glb";
import vaseAsset from "./assets/vase.glb";

const PAPER = "#f7f4ec";
const INITIAL = { spacing: 8, weight: 1.8, taper: 1.8, outline: .5, raggedness: 0, contrast: 80, angle: -12, light: 35, lineStyle: "straight", wave: 8, dottedEnds: true, dottedFade: 58 };
const PRESETS = [
  { id: "bust", label: "Greek bust", caption: "Greek bust" },
  { id: "knot", label: "KNOT", caption: "Torus knot" },
  { id: "vase", label: "Ceramic vase", caption: "Ceramic vase" },
  { id: "snow", label: "Snow mountain", caption: "Snow mountain" },
];
const BUNDLED_ASSETS = { bust: bustAsset, knot: torusAsset, vase: vaseAsset };

function project(point, camera, width, height) {
  const v = point.clone().project(camera);
  return { x: (v.x * .5 + .5) * width, y: (-v.y * .5 + .5) * height, z: v.z };
}
function hatchMaterial() {
  const uniforms = {
    uInk: { value: new THREE.Color("#10100f") },
    uPaper: { value: new THREE.Color(PAPER) },
    uLight: { value: new THREE.Vector3(.6, .8, .3).normalize() },
    uSpacing: { value: 8 },
    uWeight: { value: 1.15 },
    uTaper: { value: 2.2 },
    uRaggedness: { value: 0 },
    uContrast: { value: .68 },
    uAngle: { value: -12 },
    uLineStyle: { value: 0 },
    uWave: { value: 3 },
    uDottedEnds: { value: 1 },
    uDottedFade: { value: .58 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: "varying vec3 vNormal; varying vec3 vViewPosition; void main(){ vec4 viewPosition=modelViewMatrix*vec4(position,1.0); vViewPosition=viewPosition.xyz; vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*viewPosition; }",
    fragmentShader: "varying vec3 vNormal; varying vec3 vViewPosition; uniform vec3 uInk,uPaper,uLight; uniform float uSpacing,uWeight,uContrast,uAngle,uLineStyle,uWave,uDottedEnds,uDottedFade; float hatch(float value,float width){float d=abs(fract(value)-.5);return smoothstep(.5-width,.5,d);} float lineMask(vec2 pixel, vec2 normal, vec2 tangent, float shade){float distanceAlong=dot(pixel,tangent);float wave=uLineStyle*.5*uWave*sin(distanceAlong*.045);float width=.075*clamp(uWeight,.5,2.5)*mix(.55,1.75,shade);return hatch(dot(pixel,normal)/uSpacing+wave/uSpacing,width);} float terminal(float shade,float threshold){float band=max(fwidth(shade)*8.0,.25);return 1.0-smoothstep(.02,band,abs(shade-threshold));} float dotted(float mark,vec2 pixel,vec2 tangent,float endMask){if(uDottedEnds<.5||uDottedFade<.01)return mark;float silhouette=smoothstep(.55,1.25,length(vec2(dFdx(vViewPosition.z),dFdy(vViewPosition.z)))*14.);float terminalMask=max(endMask,silhouette*.35);float phase=fract(dot(pixel,tangent)/max(uSpacing*1.5,7.0));float pulse=1.0-smoothstep(.18,.181,abs(phase-.5));float curve=terminalMask*terminalMask*terminalMask;float fade=1.0-mix(.18,.92,uDottedFade)*curve;float endZone=smoothstep(.08,.081,terminalMask*uDottedFade);return mix(mark,mark*pulse*fade,endZone); } void main(){float rawShade=1.0-clamp(dot(normalize(vNormal),normalize(uLight))*.78+.22,0.0,1.0); float shade=pow(rawShade,mix(1.8,.62,clamp(uContrast,.2,1.0))); vec2 pixel=gl_FragCoord.xy; float angle=uAngle*.0174532925; vec2 firstNormal=vec2(-sin(angle),cos(angle)), firstTangent=vec2(cos(angle),sin(angle)); vec2 secondNormal=vec2(-sin(angle+1.5707963),cos(angle+1.5707963)), secondTangent=vec2(cos(angle+1.5707963),sin(angle+1.5707963)); float primaryThreshold=mix(.16,.48,uContrast); float secondaryThreshold=mix(.46,.72,uContrast); float sharedTerminal=max(terminal(shade,primaryThreshold),terminal(shade,secondaryThreshold)); float first=dotted(lineMask(pixel,firstNormal,firstTangent,shade),pixel,firstTangent,sharedTerminal); float second=dotted(lineMask(pixel,secondNormal,secondTangent,shade),pixel,secondTangent,sharedTerminal); float marks=step(primaryThreshold,shade)*first+step(secondaryThreshold,shade)*second; float wash=mix(.055,.018,uContrast)+shade*mix(.035,.075,uContrast); gl_FragColor=vec4(mix(uPaper,uInk,clamp(max(marks,wash),0.0,1.0)),1.0); }",
  });
  // Vary dash/gap ratios per line cell with a stable screen-space hash. The pulse
  // remains binary, so blank gaps stay truly empty instead of being connected by fades.
  material.fragmentShader = material.fragmentShader.replace("uniform float uSpacing,uWeight,uContrast,uAngle,uLineStyle,uWave,uDottedEnds,uDottedFade;", "uniform float uSpacing,uWeight,uTaper,uRaggedness,uContrast,uAngle,uLineStyle,uWave,uDottedEnds,uDottedFade;");
  material.fragmentShader = material.fragmentShader.replace("float phase=fract(dot(pixel,tangent)/max(uSpacing*1.5,7.0));float pulse=1.0-smoothstep(.18,.181,abs(phase-.5));", "float period=max(uSpacing*1.5,7.0);float along=dot(pixel,tangent)/period;float cell=floor(along);float local=fract(along);float row=floor(dot(pixel,vec2(-tangent.y,tangent.x))/max(uSpacing,1.0));float jitter=fract(sin(cell*17.17+row*31.73)*43758.5453);float dash=mix(.24,.70,jitter);float pulse=1.0-smoothstep(dash,dash+.001,local);");
  material.fragmentShader = material.fragmentShader.replace("float lineMask(vec2 pixel, vec2 normal, vec2 tangent, float shade){float distanceAlong=dot(pixel,tangent);float wave=uLineStyle*.5*uWave*sin(distanceAlong*.045);float width=.075*clamp(uWeight,.5,2.5)*mix(.55,1.75,shade);return hatch(dot(pixel,normal)/uSpacing+wave/uSpacing,width);}", "float lineMask(vec2 pixel, vec2 normal, vec2 tangent, float shade,float threshold,float secondary){float distanceAlong=dot(pixel,tangent);float wave=uLineStyle*.5*uWave*sin(distanceAlong*.045);float capBand=max(fwidth(shade)*9.0,.12);float cap=smoothstep(0.0,capBand,abs(shade-threshold));float span=max(abs(secondary-threshold),.001);float darkness=abs(secondary-threshold)<.001?clamp(shade,0.0,1.0):clamp((shade-threshold)/span,0.0,1.0);float taperedDarkness=pow(darkness,max(uTaper,.1));float width=.075*clamp(uWeight,.5,4.0)*mix(.30,3.2,taperedDarkness)*mix(.22,1.0,cap);float cell=floor(distanceAlong/max(uSpacing*.9,6.0));float row=floor(dot(pixel,normal)/max(uSpacing,1.0));float grain=fract(sin(cell*127.1+row*311.7)*43758.5453);float distress=mix(1.0,smoothstep(.22,.78,grain),clamp(uRaggedness,0.0,1.0)*.72);return hatch(dot(pixel,normal)/uSpacing+wave/uSpacing,width)*distress;}");
  material.fragmentShader = material.fragmentShader.replace("float silhouette=smoothstep(.55,1.25,length(vec2(dFdx(vViewPosition.z),dFdy(vViewPosition.z)))*14.);float terminalMask=max(endMask,silhouette*.35);", "float terminalMask=clamp(endMask,0.0,1.0);");
  material.fragmentShader = material.fragmentShader.replace("float primaryThreshold=mix(.16,.48,uContrast); float secondaryThreshold=mix(.46,.72,uContrast); float sharedTerminal=max(terminal(shade,primaryThreshold),terminal(shade,secondaryThreshold)); float first=dotted(lineMask(pixel,firstNormal,firstTangent,shade),pixel,firstTangent,sharedTerminal);", "float primaryThreshold=mix(.16,.48,uContrast); float secondaryThreshold=mix(.46,.72,uContrast); float dottedSolidThreshold=mix(.68,.50,uContrast); float brightTerminal=1.0-smoothstep(primaryThreshold,dottedSolidThreshold,shade); float first=dotted(lineMask(pixel,firstNormal,firstTangent,shade,primaryThreshold,dottedSolidThreshold),pixel,firstTangent,brightTerminal);");
  material.fragmentShader = material.fragmentShader.replace("float second=dotted(lineMask(pixel,secondNormal,secondTangent,shade),pixel,secondTangent,sharedTerminal);", "float second=lineMask(pixel,secondNormal,secondTangent,shade,secondaryThreshold,secondaryThreshold);");
  material.fragmentShader = material.fragmentShader.replace("float curve=terminalMask*terminalMask*terminalMask;float fade=1.0-mix(.18,.92,uDottedFade)*curve;float endZone=smoothstep(.08,.081,terminalMask*uDottedFade);return mix(mark,mark*pulse*fade,endZone);", "float dottedOnset=mix(.98,.08,clamp(uDottedFade,0.0,1.0));float dotAmount=smoothstep(dottedOnset,1.0,terminalMask);float fade=1.0-mix(.08,.92,dotAmount);float endZone=smoothstep(.04,.2,dotAmount);return mix(mark,mark*pulse*fade,endZone);");
  material.needsUpdate = true;
  material.userData.hatch = uniforms;
  return material;
}
function terrainSlabGeometry(top, widthSegments, heightSegments, bottomY = -.44) {
  const positions = [], indices = [], source = top.attributes.position;
  for (let i = 0; i < source.count; i += 1) positions.push(source.getX(i), source.getY(i), source.getZ(i));
  const sourceIndex = top.index;
  for (let i = 0; i < sourceIndex.count; i += 1) indices.push(sourceIndex.getX(i));
  const boundary = [];
  for (let x = 0; x <= widthSegments; x += 1) boundary.push(x);
  for (let y = 1; y <= heightSegments; y += 1) boundary.push(y * (widthSegments + 1) + widthSegments);
  for (let x = widthSegments - 1; x >= 0; x -= 1) boundary.push(heightSegments * (widthSegments + 1) + x);
  for (let y = heightSegments - 1; y > 0; y -= 1) boundary.push(y * (widthSegments + 1));
  const sideTopIndices = boundary.map((topIndex) => {
    const sideTopIndex = positions.length / 3, x = source.getX(topIndex), y = source.getY(topIndex), z = source.getZ(topIndex);
    positions.push(x, y, z); return sideTopIndex;
  });
  const bottomIndices = boundary.map((topIndex) => {
    const bottomIndex = positions.length / 3, x = source.getX(topIndex), z = source.getZ(topIndex);
    positions.push(x, bottomY, z); return bottomIndex;
  });
  for (let i = 0; i < boundary.length; i += 1) {
    const next = (i + 1) % boundary.length, a = sideTopIndices[i], b = sideTopIndices[next], ba = bottomIndices[i], bb = bottomIndices[next];
    indices.push(a, b, bb, a, bb, ba);
  }
  const center = positions.length / 3; positions.push(0, bottomY, 0);
  for (let i = 0; i < bottomIndices.length; i += 1) indices.push(center, bottomIndices[(i + 1) % bottomIndices.length], bottomIndices[i]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
function terrainCreaseLines(top, widthSegments, heightSegments, bottomY = -.44) {
  const source = top.attributes.position, boundary = [];
  for (let x = 0; x <= widthSegments; x += 1) boundary.push(x);
  for (let y = 1; y <= heightSegments; y += 1) boundary.push(y * (widthSegments + 1) + widthSegments);
  for (let x = widthSegments - 1; x >= 0; x -= 1) boundary.push(heightSegments * (widthSegments + 1) + x);
  for (let y = heightSegments - 1; y > 0; y -= 1) boundary.push(y * (widthSegments + 1));
  const point = (index, y = null) => new THREE.Vector3(source.getX(index), y === null ? source.getY(index) : y, source.getZ(index));
  const makeLine = (points, seed = 0) => {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", .12);
    const segments = Math.max(28, points.length * 3), sampled = curve.getPoints(segments);
    const jittered = sampled.map((item, index) => {
      const t = index / segments;
      if (index === 0 || index === segments) return item.clone();
      const tangent = sampled[index + 1].clone().sub(sampled[index - 1]).normalize();
      const axis = Math.abs(tangent.y) > .8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const offset = tangent.clone().cross(axis).normalize();
      const lowFrequencyNoise = Math.sin(t * Math.PI * 2 * 1.4 + seed) * .7 + Math.sin(t * Math.PI * 2 * 2.6 + seed * 1.7) * .3;
      return item.clone().addScaledVector(offset, lowFrequencyNoise * Math.sin(t * Math.PI) * .0035);
    });
    const geometry = new LineGeometry(); geometry.setPositions(jittered.flatMap((item) => [item.x, item.y, item.z]));
    const material = new LineMaterial({ color: "#10100f", linewidth: 1.6, transparent: true, opacity: .92, depthTest: true });
    const line = new Line2(geometry, material); line.computeLineDistances(); line.userData.crease = true; line.renderOrder = 3; return line;
  };
  const group = new THREE.Group(), corners = [boundary[0], boundary[widthSegments], boundary[widthSegments + heightSegments], boundary[widthSegments + heightSegments + widthSegments]];
  group.add(makeLine([...boundary.map((index) => point(index)), point(boundary[0])], .4));
  group.add(makeLine([...boundary.map((index) => point(index, bottomY)), point(boundary[0], bottomY)], 2.1));
  corners.forEach((index, corner) => group.add(makeLine([point(index), point(index, bottomY)], corner + 3.2)));
  group.userData.crease = true; return group;
}
function silhouetteShell(mesh, color = "#10100f") {
  const geometry = mesh.geometry.clone(), box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position), center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeVertexNormals();
  const position = geometry.attributes.position, normal = geometry.attributes.normal, amplitude = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * .0011;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i), noise = Math.sin(x * 7.13 + y * 11.71 + z * 13.37) * .62 + Math.sin(x * 17.3 - z * 9.1) * .24;
    position.setXYZ(i, x + normal.getX(i) * noise * amplitude, y + normal.getY(i) * noise * amplitude, z + normal.getZ(i) * noise * amplitude);
  }
  position.needsUpdate = true;
  const shell = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, depthWrite: false }));
  shell.position.copy(center); shell.scale.setScalar(1.012); shell.renderOrder = 0; shell.userData.silhouette = true;
  mesh.renderOrder = 1; return shell;
}
function terrain(kind = "snow") {
  const detailed = kind === "snow";
  const widthSegments = detailed ? 52 : 34, heightSegments = detailed ? 42 : 28;
  const geo = new THREE.PlaneGeometry(6.6, 5.4, widthSegments, heightSegments);
  geo.rotateX(-Math.PI / 2);
  const position = geo.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), z = position.getZ(i);
    let height = 0;
    if (kind === "ridge") {
      height = 1.55 * Math.exp(-((x + 1.55) ** 2 * .95 + (z + .25) ** 2 * 2.7)) + 1.25 * Math.exp(-((x - .65) ** 2 * 1.35 + (z - .15) ** 2 * 2.1));
    } else if (kind === "crater") {
      const radius = Math.sqrt((x + .1) ** 2 + (z + .05) ** 2);
      height = 1.45 * Math.exp(-((radius - 1.05) ** 2) * 5.5) - .55 * Math.exp(-(radius ** 2) * 2.8) + .35 * Math.exp(-((x - 1.8) ** 2 * 1.2 + (z + .65) ** 2 * 2.4));
    } else if (kind === "dunes") {
      height = .42 + .3 * Math.sin(x * 2.1 + z * .8) + .22 * Math.sin(x * 4.5 - z * 1.2) + .42 * Math.exp(-((x - .8) ** 2 * .75 + (z + .7) ** 2 * 1.8));
    } else {
      const main = 2.4 * Math.exp(-((x + .9) ** 2 * 1.1 + (z + .25) ** 2 * 1.55));
      const shoulder = .52 * Math.exp(-((x - 1.9) ** 2 * .8 + (z - .6) ** 2 * 2.1));
      const farPeak = detailed ? .92 * Math.exp(-((x - 2.15) ** 2 * 1.9 + (z + 1.2) ** 2 * 2.8)) : 0;
      const ridge = detailed ? .2 * Math.sin(x * 3.8 + z * .9) * Math.exp(-(x * x + z * z) * .32) : 0;
      height = main + shoulder + farPeak + ridge;
    }
    position.setY(i, Math.max(0, height + .1 * Math.sin(x * 2.2) * Math.cos(z * 2.8)));
  }
  geo.computeVertexNormals();
  const group = new THREE.Group(); group.userData.sample = true; group.userData.preset = kind;
  const surface = new THREE.Mesh(terrainSlabGeometry(geo, widthSegments, heightSegments), hatchMaterial());
  const outlineSource = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  group.add(silhouetteShell(outlineSource)); group.add(surface); group.add(terrainCreaseLines(geo, widthSegments, heightSegments));
  return group;
}
function presetModel(kind = "snow") {
  if (kind === "snow") return terrain("snow");
  const group = new THREE.Group();
  group.userData.sample = true; group.userData.preset = kind;
  const addMesh = (mesh) => {
    mesh.material = hatchMaterial();
    mesh.geometry.computeVertexNormals?.();
    mesh.add(silhouetteShell(mesh));
    group.add(mesh);
  };
  if (kind === "knot") {
    const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1.42, .34, 220, 32, 2, 3));
    mesh.position.y = .72;
    addMesh(mesh);
  } else if (kind === "vase") {
    const profile = [
      new THREE.Vector2(0, 0), new THREE.Vector2(.58, 0), new THREE.Vector2(.7, .16),
      new THREE.Vector2(.68, .55), new THREE.Vector2(.47, 1.18), new THREE.Vector2(.5, 1.55),
      new THREE.Vector2(.76, 1.93), new THREE.Vector2(.72, 2.32), new THREE.Vector2(.5, 2.58),
      new THREE.Vector2(.36, 2.7), new THREE.Vector2(.25, 2.7), new THREE.Vector2(.36, 2.52),
      new THREE.Vector2(.35, 2.2), new THREE.Vector2(.26, 1.62), new THREE.Vector2(.3, .32),
      new THREE.Vector2(0, .32),
    ];
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 56));
    mesh.position.y = -1.35;
    addMesh(mesh);
  } else if (kind === "bust") {
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24));
    shoulders.scale.set(1.8, .68, 1.03); shoulders.position.y = -1.38; addMesh(shoulders);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.48, .84, 36));
    torso.scale.z = .78; torso.position.y = -1.82; addMesh(torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.43, .56, .82, 28));
    neck.position.y = -.58; addMesh(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 30));
    head.scale.set(.82, 1.12, .83); head.position.y = .62; addMesh(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(1.04, 40, 24));
    hair.scale.set(.86, .96, .86); hair.position.set(0, .88, -.12); addMesh(hair);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.17, .42, 12));
    nose.rotation.x = Math.PI / 2; nose.position.set(0, .52, .8); addMesh(nose);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(.34, .1, .15));
    brow.position.set(-.28, .74, .72); brow.rotation.z = -.08; addMesh(brow);
    const browRight = brow.clone(); browRight.position.x = .28; addMesh(browRight);
  }
  return group;
}
function meshTargets(root) {
  if (root?.userData.sample) return [];
  const targets = [];
  root?.traverse((item) => { if (item.isMesh && !item.userData.silhouette) targets.push(item); });
  return targets;
}
function prepareImportedModel(object, ink) {
  const meshes = meshTargets(object);
  meshes.forEach((item) => {
    item.material = hatchMaterial();
    item.geometry.computeVertexNormals?.();
    item.add(silhouetteShell(item, ink));
  });
  return meshes.length ? object : null;
}
function loadBundledModel(url) {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error("Bundled model could not be read");
    return response.arrayBuffer();
  }).then((buffer) => new Promise((resolve, reject) => {
    createGltfLoader().parse(buffer, "", (gltf) => resolve(gltf.scene), reject);
  }));
}
function createGltfLoader() {
  const loader = new GLTFLoader(), draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  loader.setDRACOLoader(draco);
  return loader;
}
function fit(object) {
  const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const scale = 5.7 / Math.max(size.x, size.y, size.z, .01);
  // Object position is not scaled by its own scale. Offset by the scaled centre,
  // otherwise tall imported models are moved far below the camera.
  object.scale.setScalar(scale); object.position.copy(center).multiplyScalar(-scale); object.updateMatrixWorld(true);
}
function frameView(runtime, width, height) {
  if (!runtime?.model || !runtime?.camera || !runtime?.controls) return;
  const aspect = width / Math.max(height, 1), box = new THREE.Box3().setFromObject(runtime.model);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const offset = runtime.camera.position.clone().sub(runtime.controls.target);
  const direction = offset.lengthSq() > .0001 ? offset.normalize() : new THREE.Vector3(1, .7, 1).normalize();
  runtime.controls.target.copy(center);
  if (runtime.camera.isOrthographicCamera) {
    const viewHeight = Math.max(size.y, size.x / Math.max(aspect, .1), size.z) * 1.45;
    runtime.orthographic.top = viewHeight / 2; runtime.orthographic.bottom = -viewHeight / 2;
    runtime.orthographic.left = -viewHeight * aspect / 2; runtime.orthographic.right = viewHeight * aspect / 2;
    runtime.orthographic.updateProjectionMatrix();
    runtime.camera.position.copy(center).add(direction.multiplyScalar(Math.max(offset.length(), 10)));
  } else {
    const fov = runtime.camera.fov * Math.PI / 180;
    const distance = Math.max(size.x, size.y, size.z) * 1.45 / Math.max(2 * Math.tan(fov / 2), .1);
    runtime.camera.position.copy(center).add(direction.multiplyScalar(distance));
    runtime.camera.near = Math.max(.01, distance / 100); runtime.camera.far = Math.max(100, distance * 20);
    runtime.camera.updateProjectionMatrix();
  }
  runtime.controls.update();
}
function dottedRun(points, strokeWidth, settings, ink, allowDotted = true) {
  const d = (list) => list.map((point, index) => (index ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1)).join(""), strength = (settings.dottedFade ?? 58) / 100, raggedness = Math.min(1, Math.max(0, settings.raggedness ?? 0) / 100);
  const raggedPath = (list) => {
    if (raggedness < .01 || list.length < 3) return '<path stroke-width="' + strokeWidth.toFixed(2) + '" d="' + d(list) + '"/>';
    const random = (index, point) => { const value = Math.sin((index + 1) * 12.9898 + point.x * .137 + point.y * .173) * 43758.5453; return value - Math.floor(value); };
    return list.slice(0, -1).map((from, index) => {
      const to = list[index + 1], noise = random(index, from), keep = 1 - raggedness * (.16 + noise * .42), end = { x: from.x + (to.x - from.x) * keep, y: from.y + (to.y - from.y) * keep }, opacity = (1 - raggedness * (.08 + (1 - noise) * .22)).toFixed(2);
      return '<path stroke-width="' + strokeWidth.toFixed(2) + '" stroke-opacity="' + opacity + '" d="M' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + 'L' + end.x.toFixed(1) + ' ' + end.y.toFixed(1) + '"/>';
    }).join("");
  };
  if (allowDotted && points.length > 1) {
    const runAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x), targetAngle = settings.angle * Math.PI / 180;
    const angleDelta = Math.abs(Math.atan2(Math.sin(runAngle - targetAngle), Math.cos(runAngle - targetAngle)));
    // The perpendicular/dark cross-hatch family stays continuous; only the
    // primary (relative-bright) hatch direction receives terminal dashes.
    if (angleDelta > Math.PI * .28) allowDotted = false;
  }
  if (!allowDotted || !settings.dottedEnds || strength < .01 || points.length < 5) return raggedPath(points);
  const end = Math.max(1, Math.floor(points.length * (.06 + strength * .28))), solid = points.slice(end, points.length - end + 1), segments = [];
  const random = (index, side, point) => { const value = Math.sin((index + 1) * 12.9898 + side * 78.233 + point.x * .137 + point.y * .173) * 43758.5453; return value - Math.floor(value); };
  const drawTerminal = (start, direction) => {
    for (let i = 0; i < end; i += 1) {
      const from = points[start + i * direction], to = points[start + (i + 1) * direction], progress = (i + 1) / end;
      const opacity = (.04 + (1 - strength) * .3 + Math.pow(progress, 2.5) * (.66 + strength * .3)).toFixed(2);
      // Keep the blank gaps absolute, but vary each dash length deterministically
      // so terminal hatching does not resolve into a mechanical square grid.
      const dashLength = .24 + random(i, direction, from) * .46;
      const shortTo = { x: from.x + (to.x - from.x) * dashLength, y: from.y + (to.y - from.y) * dashLength };
      segments.push('<path stroke-width="' + strokeWidth.toFixed(2) + '" stroke-opacity="' + opacity + '" d="M' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + 'L' + shortTo.x.toFixed(1) + ' ' + shortTo.y.toFixed(1) + '"/>');
    }
  };
  drawTerminal(0, 1); drawTerminal(points.length - 1, -1);
  return raggedPath(solid) + segments.join("");
}
function fallbackSvg(settings, title, ink, paper) {
  const gap = Math.max(5, settings.spacing), contrast = settings.contrast / 100, taper = Math.max(settings.taper ?? 2.2, .1), angle = settings.angle * Math.PI / 180, slope = Math.tan(angle), lines = [];
  const makePoints = (x1, y1, x2, y2, seed = 0) => { const length = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / Math.max(length, 1), ny = (x2 - x1) / Math.max(length, 1), count = Math.max(2, Math.ceil(length / 14)), points = []; for (let i = 0; i <= count; i += 1) { const t = i / count, wave = settings.lineStyle === "wave" ? settings.wave * Math.sin((t * length + seed * 17) * .045) : 0; points.push({ x: x1 + (x2 - x1) * t + nx * wave, y: y1 + (y2 - y1) * t + ny * wave }); } return points; };
  const renderLine = (points, tone = .5) => dottedRun(points, settings.weight * (.3 + Math.pow(Math.min(1, Math.max(0, tone)), taper) * 1.5), settings, ink);
  for (let y = 172; y < 564; y += gap) {
    const left = 134 + Math.max(0, (y - 172) * .3), right = 831 - Math.max(0, (y - 172) * .22);
    if (left < right) lines.push(renderLine(makePoints(left, y + left * slope, right, y + right * slope, y), Math.min(1, Math.max(0, (y - 172) / 392))));
  }
  const cross = [];
  const crossSlope = Math.tan(angle + Math.PI / 2);
  for (let x = 230; x < 590; x += gap * 1.6) cross.push(dottedRun(makePoints(x, 218, x + 210, 218 + 210 * crossSlope, x), settings.weight * (.55 + .72 * 1.2), settings, ink, false));
  const baseFront = [], baseSide = [];
  for (let y = 0; y <= 220; y += gap) {
    const t = y / 220;
    baseFront.push(dottedRun(makePoints(105, 272 + y, 583, 425 + y, y), settings.weight * (.55 + (.6 + t * .25) * 1.2), settings, ink, false));
    baseSide.push(dottedRun(makePoints(583 + 312 * t, 425 - 50 * t + y * .55, 583 + 312 * t, 645 - 152 * t + y * .45, y + 2), settings.weight * (.55 + .72 * 1.2), settings, ink, false));
  }
  const caption = title === "Maungawhau" ? "Maungawhau, Auckland NZ" : title;
  const outlineWeight = (settings.outline * (1.3 + contrast * .55)).toFixed(2), surfaceOpacity = (.42 + contrast * .58).toFixed(2), shadowOpacity = (.45 + contrast * .55).toFixed(2);
  return '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720"><title>' + caption + ' — Hatch Studio</title><rect width="1000" height="720" fill="' + paper + '"/><g fill="none" stroke="' + ink + '" stroke-linecap="round" stroke-width="' + settings.weight + '"><path d="M105 493L105 272L294 149C369 75 470 83 548 143C612 190 667 180 755 253L895 375L895 493L583 645Z" fill="' + paper + '"/><g clip-path="url(#surface)" opacity="' + surfaceOpacity + '">' + lines.join("") + '</g><g clip-path="url(#shadow)" opacity="' + shadowOpacity + '">' + cross.join("") + '</g><g clip-path="url(#front)">' + baseFront.join("") + '</g><g clip-path="url(#side)">' + baseSide.join("") + '</g><path stroke-width="' + outlineWeight + '" d="M105 493L583 645L895 493M105 272L583 425L895 375M583 425L583 645"/><path stroke-width="' + outlineWeight + '" d="M294 149C328 213 352 244 405 263C452 282 500 246 548 143M548 143C584 205 638 223 704 247"/></g><text x="500" y="694" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" letter-spacing="1" fill="' + ink + '">' + caption + '</text><defs><clipPath id="surface"><path d="M105 272L294 149C369 75 470 83 548 143C612 190 667 180 755 253L895 375L583 425Z"/></clipPath><clipPath id="shadow"><path d="M286 156C330 212 358 250 410 267C460 281 500 245 548 143C590 196 653 217 737 246L704 330L532 315L400 385Z"/></clipPath><clipPath id="front"><path d="M105 272L583 425L583 645L105 493Z"/></clipPath><clipPath id="side"><path d="M583 425L895 375L895 493L583 645Z"/></clipPath></defs></svg>';
}
function vectorizeMesh(root, camera, settings, title, ink, paper) {
  // Keep the export in the same normalized camera view as the canvas, but use a
  // denser screen-space raster than the preview's display pixels. This avoids
  // stair-stepped silhouettes and missing hatch runs in the standalone SVG.
  const width = 1000, height = 720, rasterWidth = 720, rasterHeight = 518, contrast = settings.contrast / 100, faces = [], light = new THREE.Vector3(Math.cos(settings.light * Math.PI / 180), .8, Math.sin(settings.light * Math.PI / 180)).normalize();
  root.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.userData.silhouette || !mesh.geometry?.attributes?.position) return;
    const geo = mesh.geometry, attr = geo.attributes.position, index = geo.index, count = index ? index.count / 3 : attr.count / 3, stride = Math.max(1, Math.floor(count / 7000));
    for (let f = 0; f < count; f += stride) {
      const ids = [0, 1, 2].map((n) => index ? index.getX(f * 3 + n) : f * 3 + n);
      const a = new THREE.Vector3().fromBufferAttribute(attr, ids[0]).applyMatrix4(mesh.matrixWorld), b = new THREE.Vector3().fromBufferAttribute(attr, ids[1]).applyMatrix4(mesh.matrixWorld), c = new THREE.Vector3().fromBufferAttribute(attr, ids[2]).applyMatrix4(mesh.matrixWorld);
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize(), center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      if (normal.dot(camera.position.clone().sub(center).normalize()) < .015) continue;
      const p = [a, b, c].map((point) => project(point, camera, width, height));
      if (p.every((point) => point.x < -40 || point.x > width + 40 || point.y < -40 || point.y > height + 40)) continue;
      const rawShade = 1 - Math.max(0, Math.min(1, normal.dot(light) * .78 + .22)), shadeExponent = 1.8 + (.62 - 1.8) * contrast;
      faces.push({ p, depth: (p[0].z + p[1].z + p[2].z) / 3, shade: Math.pow(rawShade, shadeExponent) });
    }
  });
  if (!faces.length) return fallbackSvg(settings, title, ink, paper);
  const depth = new Float32Array(rasterWidth * rasterHeight); depth.fill(Infinity);
  const shade = new Float32Array(rasterWidth * rasterHeight), visible = new Uint8Array(rasterWidth * rasterHeight);
  const edgeAt = (x, y) => Math.max(0, Math.min(rasterWidth - 1, x)) + Math.max(0, Math.min(rasterHeight - 1, y)) * rasterWidth;
  const barycentric = (px, py, a, b, c) => {
    const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(den) < .00001) return null;
    const u = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / den;
    const v = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / den;
    const w = 1 - u - v;
    return u >= 0 && v >= 0 && w >= 0 ? [u, v, w] : null;
  };
  for (const face of faces) {
    const p = face.p.map((point) => ({ x: point.x * rasterWidth / width, y: point.y * rasterHeight / height, z: point.z }));
    const minX = Math.max(0, Math.floor(Math.min(p[0].x, p[1].x, p[2].x))), maxX = Math.min(rasterWidth - 1, Math.ceil(Math.max(p[0].x, p[1].x, p[2].x)));
    const minY = Math.max(0, Math.floor(Math.min(p[0].y, p[1].y, p[2].y))), maxY = Math.min(rasterHeight - 1, Math.ceil(Math.max(p[0].y, p[1].y, p[2].y)));
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      const weights = barycentric(x + .5, y + .5, p[0], p[1], p[2]); if (!weights) continue;
      const z = p[0].z * weights[0] + p[1].z * weights[1] + p[2].z * weights[2], index = edgeAt(x, y);
      if (z < depth[index]) { depth[index] = z; shade[index] = face.shade; visible[index] = 1; }
    }
  }
  const paths = [], scaleX = width / rasterWidth, scaleY = height / rasterHeight, gap = Math.max(4, settings.spacing) / Math.min(scaleX, scaleY), taper = Math.max(settings.taper ?? 2.2, .1), primaryThreshold = .16 + contrast * .32, secondaryThreshold = .46 + contrast * .26, appendScanline = (intercept, threshold, angle = settings.angle, seed = 0) => {
    const radians = angle * Math.PI / 180, slope = Math.tan(radians), steep = Math.abs(Math.cos(radians)) < Math.abs(Math.sin(radians)), inverseSlope = Math.abs(slope) < .0001 ? 0 : 1 / slope, span = steep ? rasterHeight : rasterWidth;
    const pointAt = (distance) => {
      const rawX = steep ? intercept + distance * inverseSlope : distance, rawY = steep ? distance : intercept + distance * slope, wave = settings.lineStyle === "wave" ? settings.wave * Math.sin((distance * Math.min(scaleX, scaleY) + seed) * .045) : 0;
      return steep ? { x: rawX * scaleX + wave, y: rawY * scaleY } : { x: rawX * scaleX, y: rawY * scaleY + wave };
    };
    const solidThreshold = .68 + contrast * (.50 - .68), renderRun = (from, to, tone = .5) => { const darknessRange = threshold < solidThreshold ? solidThreshold - threshold : 1 - threshold, darkness = Math.pow(Math.min(1, Math.max(0, (tone - threshold) / Math.max(darknessRange, .001))), taper), strokeWidth = settings.weight * (.3 + darkness * 1.5), points = [], samples = Math.max(2, Math.ceil((to - from) / 8)); for (let i = 0; i <= samples; i += 1) points.push(pointAt(from + (to - from) * i / samples)); return dottedRun(points, strokeWidth, settings, ink); };
    let start = null, tone = .5;
    for (let distance = 0; distance <= span; distance += 1) {
      const rawX = steep ? intercept + distance * inverseSlope : distance, rawY = steep ? distance : intercept + distance * slope, px = Math.round(rawX), py = Math.round(rawY), inside = px >= 0 && px < rasterWidth && py >= 0 && py < rasterHeight, index = inside ? edgeAt(px, py) : 0, on = inside && visible[index] && shade[index] > threshold;
      if (on && start === null) { start = distance; tone = shade[index]; }
      if (on && start !== null) tone = Math.max(tone, shade[index]);
      if ((!on || distance === span) && start !== null) { if (distance - start > 2) paths.push(renderRun(start, Math.min(distance, span), tone)); start = null; tone = .5; }
    }
  };
  for (let intercept = -rasterHeight; intercept < rasterHeight * 1.5; intercept += gap) appendScanline(intercept, primaryThreshold, settings.angle, intercept);
  for (let intercept = -rasterWidth; intercept < rasterWidth * 1.5; intercept += gap * 1.6) appendScanline(intercept, secondaryThreshold, settings.angle + 90, intercept + 17);
  const boundary = [];
  for (let y = 0; y < rasterHeight; y += 2) { let left = -1, right = -1; for (let x = 0; x < rasterWidth; x += 1) if (visible[edgeAt(x, y)]) { if (left < 0) left = x; right = x; } if (left >= 0) boundary.push([left * width / rasterWidth, y * height / rasterHeight, right * width / rasterWidth]); }
  const contour = boundary.map((point) => ({ x: point[0], y: point[1] })).concat(boundary.slice().reverse().map((point) => ({ x: point[2], y: point[1] })));
  const smoothedContour = contour.map((point, index) => { const from = Math.max(0, index - 2), to = Math.min(contour.length - 1, index + 2); let x = 0, y = 0; for (let i = from; i <= to; i += 1) { x += contour[i].x; y += contour[i].y; } const count = to - from + 1; return { x: x / count, y: y / count }; });
  const smoothPath = (points) => { if (points.length < 2) return ""; let d = "M" + points[0].x.toFixed(1) + " " + points[0].y.toFixed(1); for (let i = 1; i < points.length - 1; i += 1) { const next = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 }; d += " Q" + points[i].x.toFixed(1) + " " + points[i].y.toFixed(1) + " " + next.x.toFixed(1) + " " + next.y.toFixed(1); } const last = points[points.length - 1]; return d + " Q" + last.x.toFixed(1) + " " + last.y.toFixed(1) + " " + last.x.toFixed(1) + " " + last.y.toFixed(1) + " Z"; };
  const outline = smoothedContour.length ? '<path stroke-width="' + settings.outline.toFixed(2) + '" d="' + smoothPath(smoothedContour) + '"/>' : '';
  return '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720"><title>' + title + ' — Hatch Studio</title><rect width="1000" height="720" fill="' + paper + '"/><g fill="none" stroke="' + ink + '" stroke-width="' + settings.weight + '" stroke-linecap="round" stroke-linejoin="round">' + paths.join("") + outline + '</g></svg>';
}
function outputSvg(root, camera, settings, title, ink, paper) {
  if (!root || !camera) return fallbackSvg(settings, title, ink, paper);
  return vectorizeMesh(root, camera, settings, title, ink, paper);
}
function Range({ label, value, min, max, step, suffix, onChange }) {
  return <label className="range-row"><span>{label}</span><output>{value}{suffix}</output><input aria-label={label} type="range" min={min} max={max} step={step || 1} value={value} onChange={(e) => onChange(Number(e.target.value))}/></label>;
}
function applyViewportAppearance(runtime, paper, ink, settings) {
  if (!runtime) return;
  runtime.scene.background = new THREE.Color(paper);
  runtime.renderer.setClearColor(paper, 1);
  runtime.outlinePass.visibleEdgeColor.set(ink); runtime.outlinePass.hiddenEdgeColor.set(ink);
  runtime.outlinePass.edgeStrength = settings.outline > 0 ? 2.2 + settings.outline * .9 : 0;
  runtime.outlinePass.edgeThickness = Math.max(settings.outline, .001);
  const radians = settings.light * Math.PI / 180;
  runtime.scene.traverse((item) => {
    if ((item.userData.hatchOutline || item.userData.silhouette || item.userData.crease) && item.material?.color) item.material.color.set(ink);
    if (item.userData.silhouette) { item.visible = settings.outline > 0; item.scale.setScalar(1 + settings.outline * .0075); }
    if (item.userData.crease && item.material) { item.material.opacity = Math.min(1, settings.outline * .58); item.material.linewidth = settings.outline; }
    const uniforms = item.material?.userData?.hatch;
    if (!uniforms?.uWeight || !uniforms?.uTaper || !uniforms?.uRaggedness) return;
    uniforms.uInk.value.set(ink); uniforms.uPaper.value.set(paper); uniforms.uSpacing.value = settings.spacing;
    uniforms.uWeight.value = settings.weight; uniforms.uTaper.value = settings.taper ?? 2.2; uniforms.uRaggedness.value = (settings.raggedness ?? 0) / 100; uniforms.uContrast.value = settings.contrast / 100;
    uniforms.uAngle.value = settings.angle; uniforms.uLineStyle.value = settings.lineStyle === "wave" ? 1 : 0;
    uniforms.uWave.value = settings.wave; uniforms.uDottedEnds.value = settings.dottedEnds ? 1 : 0; uniforms.uDottedFade.value = (settings.dottedFade ?? 58) / 100;
    uniforms.uLight.value.set(Math.cos(radians), .8, Math.sin(radians)).normalize();
  });
}
function Viewport({ source, preset, paper, ink, settings, cameraMode, autoRotate, onRuntime, onLoadState, onVectorChange }) {
  const host = useRef(null), live = useRef(null), vectorCallback = useRef(onVectorChange), vectorFrame = useRef(null), requestVectorRef = useRef(null);
  useEffect(() => { vectorCallback.current = onVectorChange; }, [onVectorChange]);
  useEffect(() => {
    const element = host.current, scene = new THREE.Scene(), orthographic = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 100), perspective = new THREE.PerspectiveCamera(36, 1, .1, 100), camera = orthographic;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const initialPosition = new THREE.Vector3(7.3, 5.4, 8.3); orthographic.position.copy(initialPosition); perspective.position.copy(initialPosition); scene.background = new THREE.Color(paper);
    renderer.setClearColor(paper, 1); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; element.appendChild(renderer.domElement);
    const composer = new EffectComposer(renderer), renderPass = new RenderPass(scene, camera), outlinePass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    outlinePass.edgeStrength = 2.2; outlinePass.edgeGlow = 0; outlinePass.edgeThickness = 1.15; outlinePass.pulsePeriod = 0; outlinePass.visibleEdgeColor.set(ink); outlinePass.hiddenEdgeColor.set(ink);
    composer.addPass(renderPass); composer.addPass(outlinePass); outlinePass.renderToScreen = true;
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, .75, 0); controls.minDistance = 4.5; controls.maxDistance = 18;
    const requestVector = () => {
      if (vectorFrame.current) return;
      vectorFrame.current = requestAnimationFrame(() => { vectorFrame.current = null; if (live.current) vectorCallback.current?.(live.current); });
    };
    requestVectorRef.current = requestVector;
    controls.addEventListener("change", requestVector);
    scene.add(new THREE.HemisphereLight(0xfffdf6, 0x766d5c, 2.6)); const light = new THREE.DirectionalLight(0xffffff, 3.2); light.position.set(4, 7, 4); scene.add(light);
    const model = presetModel(preset); scene.add(model); outlinePass.selectedObjects = meshTargets(model); live.current = { scene, camera, orthographic, perspective, renderer, composer, renderPass, outlinePass, controls, model, cameraMode: "orthographic" }; onRuntime(live.current);
    const resize = () => { const rect = element.getBoundingClientRect(), aspect = rect.width / Math.max(rect.height, 1), viewHeight = 7.4; orthographic.top = viewHeight / 2; orthographic.bottom = -viewHeight / 2; orthographic.left = -viewHeight * aspect / 2; orthographic.right = viewHeight * aspect / 2; orthographic.updateProjectionMatrix(); perspective.aspect = aspect; perspective.updateProjectionMatrix(); renderer.setSize(rect.width, rect.height, false); composer.setSize(rect.width, rect.height); outlinePass.resolution.set(rect.width, rect.height); scene.traverse((item) => { if (item.material?.resolution) item.material.resolution.set(rect.width, rect.height); }); frameView(live.current, rect.width, rect.height); requestVector(); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize(); requestVector();
    let frame; const draw = () => { controls.update(); composer.render(); frame = requestAnimationFrame(draw); }; draw();
    return () => { cancelAnimationFrame(frame); if (vectorFrame.current) cancelAnimationFrame(vectorFrame.current); requestVectorRef.current = null; controls.removeEventListener("change", requestVector); observer.disconnect(); controls.dispose(); composer.dispose(); renderer.dispose(); element.replaceChildren(); };
  }, []);
  useEffect(() => {
    const current = live.current; if (!current) return;
    current.controls.autoRotate = autoRotate; current.controls.autoRotateSpeed = .7;
  }, [autoRotate]);
  useEffect(() => {
    const current = live.current; if (!current || current.cameraMode === cameraMode) return;
    const next = cameraMode === "perspective" ? current.perspective : current.orthographic;
    next.position.copy(current.camera.position); next.quaternion.copy(current.camera.quaternion); next.updateProjectionMatrix();
    current.controls.object = next; current.camera = next; current.cameraMode = cameraMode; current.renderPass.camera = next; current.outlinePass.renderCamera = next; current.controls.update(); frameView(current, current.renderer.domElement.clientWidth, current.renderer.domElement.clientHeight); onRuntime(current); requestVectorRef.current?.();
  }, [cameraMode, onRuntime]);
  useEffect(() => {
    if (!live.current) return;
    applyViewportAppearance(live.current, paper, ink, settings);
    requestVectorRef.current?.();
  }, [paper, ink, settings]);
  useEffect(() => {
    if (!live.current) return;
    if (!source?.file) {
      const current = live.current;
      let cancelled = false;
      const swapPreset = (next, shouldFit = false) => {
        if (!next || cancelled) return;
        if (shouldFit) fit(next);
        current.scene.remove(current.model); current.model = next; current.scene.add(next);
        current.outlinePass.selectedObjects = meshTargets(next);
        applyViewportAppearance(current, paper, ink, settings);
        frameView(current, current.renderer.domElement.clientWidth, current.renderer.domElement.clientHeight);
        onRuntime(current); requestVectorRef.current?.();
      };
      if (BUNDLED_ASSETS[preset]) {
        onLoadState({ status: "loading", message: "" });
          loadBundledModel(BUNDLED_ASSETS[preset]).then((object) => {
          const next = prepareImportedModel(object, ink);
          if (!next) throw new Error("Bundled model has no mesh data");
          next.userData.sample = true; next.userData.preset = preset;
          swapPreset(next, true); onLoadState({ status: "ready", message: "" });
        }).catch((error) => {
          if (cancelled) return;
          console.error("Bundled bust loading failed", error);
          swapPreset(presetModel(preset)); onLoadState({ status: "idle", message: "" });
        });
      } else {
        swapPreset(presetModel(preset)); onLoadState({ status: "idle", message: "" });
      }
      return () => { cancelled = true; };
    }
    const current = live.current, lower = source.file.name.toLowerCase();
    let cancelled = false;
    const fail = (error) => {
      if (cancelled) return;
      console.error("Model loading failed", error);
      onLoadState({ status: "error", message: "Couldn’t read this model. Try a self-contained GLB, OBJ, or STL." });
    };
    const replace = (object) => {
      if (cancelled) return;
      const prepared = prepareImportedModel(object, ink);
      if (!prepared) { fail(new Error("No mesh data found")); return; }
      try {
        fit(prepared);
        current.scene.remove(current.model);
        current.model = prepared;
        current.scene.add(prepared);
        current.outlinePass.selectedObjects = meshTargets(prepared);
        applyViewportAppearance(current, paper, ink, settings);
        frameView(current, current.renderer.domElement.clientWidth, current.renderer.domElement.clientHeight);
        current.controls.update();
        onRuntime(current); requestVectorRef.current?.();
        onLoadState({ status: "ready", message: "" });
      } catch (error) { fail(error); }
    };
    onLoadState({ status: "loading", message: "" });
    if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
      source.file.arrayBuffer().then((buffer) => createGltfLoader().parse(buffer, "", (gltf) => replace(gltf.scene), fail)).catch(fail);
    } else if (lower.endsWith(".obj")) {
      source.file.text().then((text) => replace(new OBJLoader().parse(text))).catch(fail);
    } else if (lower.endsWith(".stl")) {
      source.file.arrayBuffer().then((buffer) => replace(new THREE.Mesh(new STLLoader().parse(buffer)))).catch(fail);
    }
    return () => { cancelled = true; };
  }, [source, preset]);
  return <div className="viewport" ref={host}><div className="viewport-fade"/></div>;
}
function PresetThumbnail({ kind }) {
  const paths = {
    bust: "M22 45C24 38 29 35 36 33C35 30 34 26 35 21C36 14 40 11 48 11C56 11 61 16 61 23C61 27 60 30 58 33C66 35 72 39 75 45Z",
    knot: "M26 26C18 16 26 10 36 14C43 17 48 22 53 17C60 10 71 14 69 23C68 30 61 34 66 40C72 47 61 51 54 45C48 40 45 34 39 40C32 47 22 43 26 35C29 31 30 29 26 26Z",
    vase: "M43 12L53 12C52 16 55 20 58 24C60 28 57 32 59 38C60 42 64 44 66 46H30C34 43 38 42 38 37C39 31 36 29 39 24C42 20 44 16 43 12Z",
    snow: "M9 45C18 40 22 34 27 31C33 27 36 11 44 13C52 15 53 31 59 34C65 37 72 32 87 42L87 48L9 48Z",
  };
  return <svg className="preset-art" viewBox="0 0 96 56" aria-hidden="true"><rect x="5" y="8" width="86" height="40" rx="5" fill="#f7f4ec"/><path d={paths[kind]} fill="#e4dfcf" stroke="#17161a" strokeWidth="1.1"/><path d={paths[kind]} fill="none" stroke="#17161a" strokeWidth=".55" strokeDasharray="2 2" opacity=".72"/><path d="M9 48H87" stroke="#17161a" strokeWidth="1"/></svg>;
}
function PanelSection({ name, label, open, onToggle, className = "", children }) {
  return <section className={`control-section ${className}`}>
    <button type="button" className="section-heading section-toggle" aria-expanded={open} onClick={() => onToggle(name)}>
      <strong>{label}</strong><ChevronDown size={15}/>
    </button>
    {open && <div className="section-content">{children}</div>}
  </section>;
}
export function App() {
  const [settings, setSettings] = useState(INITIAL), [model, setModel] = useState(null), [preset, setPreset] = useState("bust"), [paper, setPaper] = useState(PAPER), [ink, setInk] = useState("#10100f"), [cameraMode, setCameraMode] = useState("orthographic"), [autoRotate, setAutoRotate] = useState(true), [showPanel, setShowPanel] = useState(true), [isFullscreen, setIsFullscreen] = useState(false), [panelPosition, setPanelPosition] = useState(null), [isDraggingPanel, setIsDraggingPanel] = useState(false), [vectorSvg, setVectorSvg] = useState(""), [openSections, setOpenSections] = useState({ model: true, camera: true, hatching: true, colors: true }), [toast, setToast] = useState(""), [loadState, setLoadState] = useState({ status: "idle", message: "" });
  const runtime = useRef(null), input = useRef(null), panelDrag = useRef(null);
  const modelTitle = model?.name || PRESETS.find((item) => item.id === preset)?.caption || "Maungawhau";
  const updateVectorPreview = useCallback((current) => {
    if (!current?.model || !current?.camera) return;
    setVectorSvg(outputSvg(current.model, current.camera, settings, modelTitle, ink, paper));
  }, [settings, modelTitle, ink, paper]);
  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const update = (key, value) => setSettings({ ...settings, [key]: value });
  const toggleSection = (name) => setOpenSections((current) => ({ ...current, [name]: !current[name] }));
  const toggleFullscreen = () => setIsFullscreen((value) => { const next = !value; if (next) setPanelPosition(null); return next; });
  const startPanelDrag = (event) => {
    if (!isFullscreen || event.button !== 0) return;
    const panel = event.currentTarget.closest(".control-panel"), rect = panel?.getBoundingClientRect();
    if (!rect) return;
    panelDrag.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height };
    setIsDraggingPanel(true);
    event.preventDefault();
  };
  useEffect(() => {
    const move = (event) => {
      const drag = panelDrag.current;
      if (!drag) return;
      const left = Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX));
      const top = Math.max(8, Math.min(window.innerHeight - drag.height - 8, event.clientY - drag.offsetY));
      setPanelPosition({ left, top });
    };
    const stop = () => { if (panelDrag.current) { panelDrag.current = null; setIsDraggingPanel(false); } };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, []);
  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);
  const panelStyle = isFullscreen && panelPosition ? { left: panelPosition.left, top: panelPosition.top, right: "auto" } : undefined;
  const selectFile = (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!/\.(glb|gltf|obj|stl)$/i.test(file.name)) { notify("Use a GLB, glTF, OBJ, or STL file"); return; }
    setLoadState({ status: "loading", message: "" });
    setPreset(null); setModel({ file, name: file.name, size: file.size }); notify("Reading model locally");
  };
  const choosePreset = (id) => { setModel(null); setPreset(id); notify(PRESETS.find((item) => item.id === id)?.label + " preset loaded"); };
  const triggerDownload = (blob, filename) => {
    const link = document.createElement("a"), url = URL.createObjectURL(blob);
    link.href = url; link.download = filename; link.style.display = "none";
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const download = () => {
    try {
      const svg = vectorSvg || outputSvg(runtime.current?.model, runtime.current?.camera, settings, modelTitle, ink, paper);
      triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), (model?.name || "maungawhau").replace(/\.[^.]+$/, "") + "-hatch.svg");
      notify("SVG saved");
    } catch (error) { console.error("SVG export failed", error); notify("SVG export failed"); }
  };
  const downloadPng = async () => {
    const svg = (vectorSvg || outputSvg(runtime.current?.model, runtime.current?.camera, settings, modelTitle, ink, paper)).replace(/<rect\b[^>]*\/?>/i, "");
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = svgUrl; });
      const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 720;
      const context = canvas.getContext("2d"); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG encoding failed");
      triggerDownload(blob, (model?.name || "maungawhau").replace(/\.[^.]+$/, "") + "-hatch.png"); notify("Transparent PNG saved");
    } catch (error) { console.error("PNG export failed", error); notify("PNG export failed"); }
    URL.revokeObjectURL(svgUrl);
  };
  const resetSettings = () => { setSettings({ ...INITIAL }); notify("Settings reset"); };
  return <main className={"app-shell" + (showPanel ? "" : " panel-hidden") + (isFullscreen ? " is-fullscreen" : "")} id="top">
    <header className="topbar"><a className="wordmark" href="#top">HATCH<span>STUDIO</span></a><div className="top-status"><span className="dot"/> local renderer <span className="divider"/> SVG / pen plotter</div><button className={"icon-button panel-toggle " + (showPanel ? "active" : "")} aria-label={showPanel ? "Hide settings" : "Show settings"} aria-pressed={showPanel} title={showPanel ? "Hide settings" : "Show settings"} onClick={() => setShowPanel((value) => !value)}><SlidersHorizontal size={16}/></button></header>
    <section className="workspace">
      <div className="hero-copy"><p className="eyebrow">3D → linework</p><h1>Turn a model into<br/><em>drawn terrain.</em></h1><p>Upload a model, find the view, and export a real SVG built from outlines and shade-driven hatch strokes.</p></div>
      <div className="model-stage"><Viewport source={model} preset={preset || "bust"} paper={paper} ink={ink} settings={settings} cameraMode={cameraMode} autoRotate={autoRotate} onRuntime={(value) => { runtime.current = value; }} onVectorChange={updateVectorPreview} onLoadState={setLoadState}/>{vectorSvg && <div className="vector-stage" aria-hidden="true" dangerouslySetInnerHTML={{ __html: vectorSvg }}/>}<div className="interaction-hint" style={{ "--hint-paper": paper }}><MousePointer2 size={14}/> drag to orbit · scroll to zoom</div><button type="button" className="fullscreen-toggle" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={isFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></div>
    </section>
    <aside className={"control-panel" + (showPanel ? "" : " hidden") + (isDraggingPanel ? " panel-dragging" : "")} style={panelStyle}>
      <div className="panel-brand" onPointerDown={startPanelDrag} title={isFullscreen ? "Drag to move settings" : undefined}><span>HatchKit</span><Sparkles size={15}/></div><div className="panel-divider"/>
      <PanelSection name="model" label="Model" open={openSections.model} onToggle={toggleSection}><button className="upload-card" onClick={() => input.current?.click()}><FileUp size={19}/><span><b>{model?.name || "Choose a 3D file"}</b><small>{loadState.status === "loading" ? "Loading locally…" : model ? (model.size / 1024 / 1024).toFixed(model.size > 1048576 ? 1 : 2) + " MB" : "GLB · glTF · OBJ · STL"}</small></span><ChevronDown size={15}/></button><input ref={input} type="file" accept=".glb,.gltf,.obj,.stl" hidden onChange={selectFile}/>{loadState.status === "error" && <p className="load-error" role="alert">{loadState.message}</p>}<div className="preset-label">Presets</div><div className="preset-grid">{PRESETS.map((item) => <button key={item.id} className={"preset-card" + (preset === item.id && !model ? " selected" : "")} aria-pressed={preset === item.id && !model} title={item.label} onClick={() => choosePreset(item.id)}><PresetThumbnail kind={item.id}/><span>{item.label}</span></button>)}</div></PanelSection>
      <PanelSection name="camera" label="Camera" open={openSections.camera} onToggle={toggleSection}><div className="segmented"><button className={cameraMode === "perspective" ? "selected" : ""} onClick={() => setCameraMode("perspective")}>Perspective</button><button className={cameraMode === "orthographic" ? "selected" : ""} onClick={() => setCameraMode("orthographic")}>Orthographic</button></div><div className="camera-note"><Maximize2 size={14}/> {cameraMode === "perspective" ? "perspective view" : "axonometric view"} · orbit directly in the 3D view</div><button className={"toggle-row " + (autoRotate ? "on" : "")} aria-pressed={autoRotate} onClick={() => setAutoRotate((value) => !value)}><span>Auto rotate model</span><span className="toggle-track"><span className="toggle-thumb"/></span></button></PanelSection>
      <PanelSection name="hatching" label="Hatching" open={openSections.hatching} onToggle={toggleSection} className="hatch-controls"><div className="style-row"><span>Line type</span><div className="segmented hatch-style"><button className={settings.lineStyle === "straight" ? "selected" : ""} onClick={() => update("lineStyle", "straight")}>Straight</button><button className={settings.lineStyle === "wave" ? "selected" : ""} onClick={() => update("lineStyle", "wave")}>Wavy</button></div></div>{settings.lineStyle === "wave" && <Range label="Wave curvature" value={settings.wave} min={8} max={24} step={.5} suffix=" px" onChange={(v) => update("wave", v)}/>}<Range label="Line spacing" value={settings.spacing} min={4} max={18} suffix=" px" onChange={(v) => update("spacing", v)}/><Range label="Stroke weight" value={settings.weight} min={.5} max={4} step={.05} suffix=" px" onChange={(v) => update("weight", v)}/><Range label="Stroke taper" value={settings.taper ?? 2.2} min={.5} max={5} step={.1} suffix=" ×" onChange={(v) => update("taper", v)}/><Range label="Raggedness" value={settings.raggedness ?? 0} min={0} max={100} suffix="%" onChange={(v) => update("raggedness", v)}/><Range label="Outline thickness" value={settings.outline} min={0} max={4} step={.1} suffix=" px" onChange={(v) => update("outline", v)}/><Range label="Contrast" value={settings.contrast} min={20} max={100} suffix="%" onChange={(v) => update("contrast", v)}/><Range label="Hatch angle" value={settings.angle} min={-45} max={45} suffix="°" onChange={(v) => update("angle", v)}/><Range label="Light direction" value={settings.light} min={-180} max={180} suffix="°" onChange={(v) => update("light", v)}/><button className={"toggle-row dotted-toggle " + (settings.dottedEnds ? "on" : "")} aria-pressed={settings.dottedEnds} onClick={() => update("dottedEnds", !settings.dottedEnds)}><span>Dotted line ends</span><span className="toggle-track"><span className="toggle-thumb"/></span></button>{settings.dottedEnds && <Range label="Dotted fade" value={settings.dottedFade ?? 58} min={0} max={100} suffix="%" onChange={(v) => update("dottedFade", v)}/>}</PanelSection>
      <PanelSection name="colors" label="Paper & ink" open={openSections.colors} onToggle={toggleSection} className="colors"><label className="color-row"><span>Ink</span><output>{ink}</output><input aria-label="Ink color" type="color" value={ink} onChange={(e) => setInk(e.target.value)}/></label><label className="color-row"><span>Paper</span><output>{paper}</output><input aria-label="Paper color" type="color" value={paper} onChange={(e) => setPaper(e.target.value)}/></label></PanelSection>
      <div className="panel-footer"><button className="copy-button" onClick={resetSettings}><RotateCcw size={15}/> Reset</button><button className="png-button" onClick={downloadPng}><ImageDown size={15}/> PNG</button><button className="export-button" onClick={download}><Download size={15}/> Export SVG</button></div>
    </aside>
    <footer className="page-footer"><span><Info size={14}/> Nothing leaves your device</span><span>3D view · vector export</span></footer>{toast && <div className="toast"><Check size={15}/> {toast}</div>}
  </main>;
}
