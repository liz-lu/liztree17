/**
 * A deterministic, local-only tree-form study. Coordinates are in model units;
 * +Y is up and the ground plane is Y = 0. There are no rendering dependencies.
 *
 * `group: null` identifies the shared trunk and roots. Every other piece belongs
 * to one of the four functional limbs, including its attached leaves. The
 * sampled points are ready for variable-radius tube meshes (not flat ribbons).
 * Leaf center is the middle of the blade; axis follows its length and side its
 * width. Both vectors are unit length and perpendicular to one another.
 * parentId/attachT describe the actual sampled-parent connection. Every leaf
 * also exposes its fixed blade base for growth and wind deformation.
 */

const GROUPS = ['campus', 'internships', 'projects', 'future'];
const add = (a, b) => a.map((value, i) => value + b[i]);
const sub = (a, b) => a.map((value, i) => value - b[i]);
const mul = (a, amount) => a.map(value => value * amount);
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = value => {
  const length = Math.hypot(...value);
  return length > 1e-8 ? mul(value, 1 / length) : [0, 1, 0];
};

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform Catmull-Rom passes through the control points. Endpoint extrapolation
// preserves each limb's initial tangent and keeps its first point inside its
// parent. Radius interpolation is intentionally monotone and never overshoots.
function sampleCurve(controlPoints, controlRadii, count = 28) {
  const points = [];
  const radii = [];
  const last = controlPoints.length - 1;
  for (let i = 0; i < count; i += 1) {
    const along = (i / (count - 1)) * last;
    const segment = Math.min(last - 1, Math.floor(along));
    const t = along - segment;
    const p1 = controlPoints[segment];
    const p2 = controlPoints[segment + 1];
    const p0 = segment > 0 ? controlPoints[segment - 1] : sub(mul(p1, 2), p2);
    const p3 = segment + 2 <= last ? controlPoints[segment + 2] : sub(mul(p2, 2), p1);
    const t2 = t * t;
    const t3 = t2 * t;
    points.push(p1.map((_, axis) => 0.5 * (
      2 * p1[axis] + (-p0[axis] + p2[axis]) * t
      + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
      + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
    )));
    const ease = t * t * (3 - 2 * t);
    radii.push(Math.max(0.025,
      controlRadii[segment] * (1 - ease) + controlRadii[segment + 1] * ease));
  }
  return { points, radii };
}

function onBranch(branch, t) {
  const along = clamp(t, 0, 1) * (branch.points.length - 1);
  const index = Math.min(branch.points.length - 2, Math.floor(along));
  const fraction = along - index;
  return {
    point: mix(branch.points[index], branch.points[index + 1], fraction),
    tangent: unit(sub(branch.points[index + 1], branch.points[index])),
    radius: branch.radii[index] * (1 - fraction) + branch.radii[index + 1] * fraction,
  };
}

function atHeight(branch, height) {
  for (let index = 0; index < branch.points.length - 1; index += 1) {
    const a = branch.points[index];
    const b = branch.points[index + 1];
    if (a[1] <= height && b[1] >= height) {
      const fraction = (height - a[1]) / (b[1] - a[1]);
      return {
        point: mix(a, b, fraction),
        t: (index + fraction) / (branch.points.length - 1),
      };
    }
  }
  return { point: branch.points[branch.points.length - 1].slice(), t: 1 };
}

export function createTreeStudyModel() {
  const random = randomSource(0x27A11CE);
  const range = (min, max) => min + random() * (max - min);
  const branches = [];
  const leaves = [];
  const main = {};
  const matureSecondaries = [];

  function branch(id, group, points, radii, count, parentId = null, attachT = 0) {
    const sampled = sampleCurve(points, radii, count);
    const result = { id, group, parentId, attachT, ...sampled };
    branches.push(result);
    return result;
  }

  const trunk = branch('trunk', null, [
    [0, -12, 0], [0, 0, 0], [-1, 10, 1], [-4, 25, 2], [-7, 43, 1],
    [-9, 85, -3], [-6, 133, -6], [1, 178, -5], [6, 222, 0],
    [8, 262, 2], [6, 308, 4], [8, 352, 2],
  ], [40.5, 37.5, 33.7, 29.0, 25.0, 23.0, 20.8, 18.5, 16.3, 13.9, 12.3, 9.4]
    .map(radius => radius * 0.88), 116);

  // Six uneven, bent roots blend into the flared collar. Only a low shoulder
  // remains above soil. Curved low roots and a few genuine lateral forks remain
  // visible around the collar before their thin extremities disappear in earth.
  const rootAngles = [0.21, 1.03, 2.18, 3.62, 4.35, 5.66];
  rootAngles.forEach((angle, index) => {
    const length = range(83, 94);
    const turn = (index % 2 ? 1 : -1) * range(0.22, 0.42);
    const radial = (radius, theta, y) => [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
    const join = atHeight(trunk, range(3, 8));
    const root = branch(`root-${index + 1}`, null, [
      join.point,
      radial(range(28, 33), angle, 2.0),
      radial(range(47, 53), angle + turn * 0.44, 0.4),
      radial(range(63, 68), angle + turn, -2.5),
      radial(length * 0.88, angle + turn * 1.12, -11),
      radial(length, angle + turn * 0.70, -22),
    ], [range(9.5, 12.0), range(6.8, 8.5), 5.7, 3.3, 1.6, 0.18], 34, trunk.id, join.t);
    if ([0, 2, 5].includes(index)) {
      const attachT = 0.52;
      const fork = onBranch(root, attachT);
      const forkAngle = angle + turn + (index % 2 ? -0.37 : 0.34);
      branch(`root-${index + 1}-fork`, null, [
        fork.point, radial(60, forkAngle - 0.10, -0.8),
        radial(70, forkAngle + 0.09, -5.6), radial(79, forkAngle + 0.16, -16),
      ], [fork.radius * 0.68, 2.8, 1.4, 0.12], 22, root.id, attachT);
    }
  });

  // The three mature scaffolds occupy distinct azimuths, not one XY plane.
  // Their staggered junction heights avoid a symmetrical radial whorl.
  const radians = degrees => degrees * Math.PI / 180;
  const polar = (radius, angle, y) => [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  const mainAngles = { campus: radians(176), internships: radians(54), projects: radians(297) };
  const joins = {
    campus: atHeight(trunk, 130), internships: atHeight(trunk, 215),
    projects: atHeight(trunk, 300), future: atHeight(trunk, 343),
  };
  const ca = mainAngles.campus, ia = mainAngles.internships, pa = mainAngles.projects;
  main.campus = branch('campus-main', 'campus', [
    joins.campus.point, polar(36, ca - 0.12, 156), polar(73, ca + 0.07, 198),
    polar(108, ca - 0.05, 251), polar(140, ca + 0.04, 299),
    polar(160, ca - 0.02, 329), polar(178, ca, 343),
  ], [13.6, 12.2, 10.7, 8.9, 7.1, 4.8, 1.2].map(radius => radius * 0.90), 56, trunk.id, joins.campus.t);
  main.internships = branch('internships-main', 'internships', [
    joins.internships.point, polar(40, ia + 0.13, 239), polar(78, ia - 0.05, 265),
    polar(117, ia + 0.06, 297), polar(150, ia - 0.08, 332),
    polar(174, ia + 0.04, 357), polar(186, ia, 370),
  ], [12.9, 11.6, 10.1, 8.3, 6.7, 4.5, 1.1].map(radius => radius * 0.90), 56, trunk.id, joins.internships.t);
  main.projects = branch('projects-main', 'projects', [
    joins.projects.point, polar(43, pa - 0.14, 317), polar(83, pa + 0.08, 335),
    polar(115, pa - 0.04, 361), polar(142, pa + 0.07, 381),
    polar(163, pa - 0.03, 399), polar(181, pa, 407),
  ], [11.1, 10.0, 8.7, 7.2, 5.6, 3.8, 1.0].map(radius => radius * 0.84), 52, trunk.id, joins.projects.t);
  main.future = branch('future-main', 'future', [
    joins.future.point, [11, 375, 9], [3, 411, 14],
    [23, 445, 7], [9, 476, 18], [16, 499, 12],
  ], [12.4, 10.1, 7.8, 5.2, 2.8, 0.50].map(radius => radius * 0.74), 60, trunk.id, joins.future.t);

  function limb(id, group, parent, t, end, radius, depthBend = 0, count = 24) {
    const start = onBranch(parent, t);
    const delta = sub(end, start.point);
    const distance = Math.hypot(...delta);
    // Start in the parent center, initially following its tangent before the
    // child opens out. A conservative radius also avoids blunt oversized joins.
    const thickness = Math.min(radius, start.radius * 0.78);
    const shoulder = add(start.point, add(mul(start.tangent, distance * 0.17), mul(delta, 0.14)));
    const middle = add(mix(start.point, end, 0.64), [depthBend * 0.26, -distance * 0.06, depthBend]);
    // The supporting tiers retain enough wood to carry the next tier. Their
    // distal taper is deliberately slower than that of the leaf-bearing twigs.
    const supporting = id.includes('secondary');
    const shoot = id.includes('shoot');
    const taper = supporting ? [0.91, 0.64, group === 'future' ? 0.22 : 0.07] : shoot ? [0.87, 0.58, 0.17] : [0.82, 0.46, 0.085];
    if (supporting && group !== 'future') {
      const bendSide = unit(cross(delta, [0, 1, 0]));
      const elbow = add(add(mix(start.point, end, 0.43), mul(bendSide, depthBend * 1.45)),
        [0, -distance * 0.045, 0]);
      const upper = add(add(mix(start.point, end, 0.75), mul(bendSide, -depthBend * 0.45)),
        [0, distance * 0.018, 0]);
      return branch(id, group, [start.point, shoulder, elbow, upper, end],
        [thickness, thickness * 0.92, thickness * 0.74, thickness * 0.42, Math.max(0.025, thickness * 0.07)],
        count, parent.id, t);
    }
    return branch(id, group, [start.point, shoulder, middle, end],
      [thickness, thickness * taper[0], thickness * taper[1], Math.max(0.025, thickness * taper[2])], count,
      parent.id, t);
  }

  // A rounded radial crown: high at its center, naturally lower at the edges.
  // This constrains newly grown endpoints, never scales the finished tree.
  const crownTop = radius => 505 - 0.0024 * radius * radius;
  function inCrown(point, maximumRadius = 214) {
    const result = point.slice();
    const radius = Math.hypot(result[0], result[2]);
    if (radius > maximumRadius) {
      result[0] *= maximumRadius / radius;
      result[2] *= maximumRadius / radius;
    }
    result[1] = Math.min(result[1], crownTop(Math.hypot(result[0], result[2])));
    return result;
  }

  // Each functional scaffold fans through roughly 120 degrees. Radius, height
  // and attachment order are deliberately staggered, with inward/upward limbs
  // filling the central crown and fewer tips on the outer skirt.
  const fanOffsets = [-51, -18, 24, 53, -34, 7, -58, 39, -6, 59, -27, 22, -45, 4, 46];
  const fanRadii = [48, 79, 112, 151, 184, 61, 141, 192, 97, 164, 202, 123, 172, 143, 179];
  const layerDrops = [22, 12, 25, 31, 36, 16, 29, 44, 18, 39, 54, 20, 46, 30, 42];
  const attachmentBands = [0.18, 0.205, 0.23, 0.34, 0.38, 0.42, 0.54, 0.57, 0.60, 0.72, 0.76, 0.80, 0.88, 0.91, 0.94];
  const limbLengths = [110, 65, 145, 80, 95, 160, 105, 70, 135, 90, 150, 75, 125, 85, 95];
  const supportStrength = [1.12, 0.62, 0.88, 1.04, 0.56, 1.20, 0.80, 0.65, 1.05, 0.72, 1.13, 0.54, 0.91, 0.70, 0.48];
  const secondaryPlans = Object.fromEntries(GROUPS.slice(0, 3).map((group, groupIndex) => {
    const plans = fanOffsets.map((_, index) => {
      const t = attachmentBands[index];
      const fanIndex = (index + groupIndex * 4) % fanOffsets.length;
      let radius = fanRadii[(index + groupIndex * 3) % fanRadii.length]
        + Math.sin(index * 1.7 + groupIndex) * 3;
      let angle = mainAngles[group] + radians(fanOffsets[fanIndex]);
      let y = crownTop(radius) - layerDrops[(index + groupIndex * 2) % layerDrops.length]
        + Math.sin(index * 1.1 + groupIndex) * 5;
      const attachment = onBranch(main[group], t);
      if (index === 12) {
        radius = 181 + groupIndex * 3;
        y = attachment.point[1] + 2 - groupIndex;
      } else if (index === 13) {
        radius = 196 + groupIndex * 2;
        y = attachment.point[1] - 9 - groupIndex * 2;
      }
      // Only selected high-origin leaders reach the upper central crown. Lower
      // scaffolds carry shorter varied laterals instead of long upright rods.
      if (group === 'projects' && (index === 6 || index === 10)) {
        radius = index === 6 ? 64 : 54;
        angle = mainAngles[group] + radians(index === 6 ? 18 : -30);
        y = crownTop(radius) - 10;
      }
      const desired = polar(radius, angle, y);
      const delta = sub(desired, attachment.point);
      const distance = Math.hypot(...delta);
      const maximumLength = limbLengths[index] * (1 + groupIndex * 0.06);
      const end = distance > maximumLength
        ? add(attachment.point, mul(delta, maximumLength / distance)) : desired;
      return [t, end, supportStrength[index]];
    });
    return [group, plans];
  }));

  function attachLeaf(twig, t, sign, group, isBud = false) {
    const node = onBranch(twig, t);
    const reference = Math.abs(node.tangent[2]) < 0.88 ? [0, 0, 1] : [1, 0, 0];
    const localSide = unit(cross(node.tangent, reference));
    const localNormal = unit(cross(node.tangent, localSide));
    // Mature foliage turns around the twig instead of forming a flat feather:
    // successive blades can face forward, sideways or back into the crown.
    const turn = isBud ? range(-0.72, 0.72) : range(-Math.PI, Math.PI);
    const lateral = add(mul(localSide, Math.cos(turn) * sign), mul(localNormal, Math.sin(turn)));
    const axis = unit(add(add(mul(node.tangent, isBud ? 0.42 : 0.18), mul(lateral, 0.94)), [0, isBud ? 0.19 : 0.15, 0]));
    const normal = unit(add(localNormal, [range(-0.25, 0.25), range(-0.22, 0.22), 0]));
    const side = unit(cross(normal, axis));
    const length = isBud ? range(2.4, 4.0) : range(5.6, 8.7);
    const width = length * (isBud ? range(0.23, 0.32) : range(0.39, 0.49));
    // The blade's base lands beside the twig, rather than placing detached
    // leaf clouds around an unrelated random volume.
    const center = add(node.point, mul(axis, length * 0.50 + node.radius * 0.55));
    const base = sub(center, mul(axis, length * 0.50));
    leaves.push({
      center, axis, side, length, width, base, parentId: twig.id, attachT: t,
      shade: isBud ? range(0.57, 0.90) : range(0.07, 0.95), group,
    });
  }

  function growSpray(secondary, group, index) {
    for (let shootIndex = 0; shootIndex < 5; shootIndex += 1) {
      const t = 0.37 + shootIndex * 0.14;
      const attachment = onBranch(secondary, t);
      const alternate = shootIndex % 2 === 0 ? 1 : -1;
      const frameReference = Math.abs(attachment.tangent[1]) < 0.90 ? [0, 1, 0] : [0, 0, 1];
      const lateral = unit(cross(attachment.tangent, frameReference));
      const depth = unit(cross(attachment.tangent, lateral));
      const angle = index * 2.39996 + shootIndex * 2.10 + mainAngles[group];
      const radial = add(mul(lateral, Math.cos(angle)), mul(depth, Math.sin(angle) * 0.98));
      // Strong sideward growth breaks the former vertical, needle-like sprays.
      // Staggered azimuths make overlapping layers, not balls at branch tips.
      const direction = unit(add(add(mul(attachment.tangent, 0.29), radial), [0, 0.11, 0]));
      const end = inCrown(add(attachment.point, mul(direction, range(21, 34))), 208);
      // Some late shoots hang below their joints; the crown is not composed
      // solely of upward arrows. The curved shoulder keeps the bend organic.
      const drooping = (index + shootIndex * 2 + GROUPS.indexOf(group)) % 7 === 0;
      if (drooping) end[1] = Math.min(end[1], attachment.point[1] - range(6, 13));
      const shoot = limb(`${group}-shoot-${index}-${shootIndex}`, group,
        secondary, t, end, range(1.9, 3.2), alternate * 3.1, 20);

      for (let twigIndex = 0; twigIndex < 5; twigIndex += 1) {
        const twigT = 0.30 + twigIndex * 0.16;
        const origin = onBranch(shoot, twigT);
        const twigReference = Math.abs(origin.tangent[1]) < 0.90 ? [0, 1, 0] : [0, 0, 1];
        const twigSide = unit(cross(origin.tangent, twigReference));
        const twigDepth = unit(cross(origin.tangent, twigSide));
        const fan = angle + twigIndex * 2.19 + range(-0.28, 0.28);
        const spread = add(mul(twigSide, Math.cos(fan) * 0.92), mul(twigDepth, Math.sin(fan) * 0.96));
        const twigDirection = unit(add(add(mul(origin.tangent, 0.42), spread), [0, 0.10, 0]));
        const twigEnd = inCrown(add(origin.point, mul(twigDirection, range(12, 18))));
        if (drooping && twigIndex % 2 === 0) {
          twigEnd[1] = Math.min(twigEnd[1], origin.point[1] - range(4, 9));
        }
        const twig = limb(`${group}-twig-${index}-${shootIndex}-${twigIndex}`, group,
          shoot, twigT, twigEnd, range(0.42, 0.72), Math.sin(fan) * 1.25, 14);
        // Bare twig bases separate the clusters. Irregular, distal leaf nodes
        // replace the continuous comb of equally spaced opposite pairs.
        const crownRadius = Math.hypot(origin.point[0], origin.point[2]);
        const localDensity = crownRadius < 112 ? 9 : crownRadius > 174 ? 6 : 8;
        const leafCount = localDensity + (random() < 0.70 ? 1 : 0) + (random() < 0.17 ? 1 : 0);
        for (let leafIndex = 0; leafIndex < leafCount; leafIndex += 1) {
          const progress = leafIndex / (leafCount - 1);
          const leafT = clamp(0.27 + 0.69 * Math.sqrt(progress) + range(-0.025, 0.025), 0.24, 0.98);
          attachLeaf(twig, leafT, leafIndex % 2 ? -1 : 1, group);
        }
      }
    }
  }

  for (const group of GROUPS.slice(0, 3)) {
    secondaryPlans[group].forEach(([t, end, thicknessScale], index) => {
      const secondary = limb(`${group}-secondary-${index + 1}`, group,
        main[group], t, end, range(5.8, 7.8) * thicknessScale, range(-10, 10), 32);
      matureSecondaries.push(secondary);
      growSpray(secondary, group, index + 1);
    });
    // Extend foliage to the structural tip so the final taper is not stranded.
    const tip = onBranch(main[group], 0.96);
    const end = inCrown(add(tip.point, mul(tip.tangent, 15)));
    const twig = limb(`${group}-terminal-twig`, group, main[group], 0.94,
      end, 0.42, 1.5, 18);
    for (let i = 0; i < 8; i += 1) attachLeaf(twig, 0.23 + i * 0.095, i % 2 ? -1 : 1, group);
  }

  // The next station remains in bud at the crown height, without a bare pole
  // projecting above the mature canopy.
  const futurePlans = [
    [0.31, [39, 417, 35]], [0.49, [-27, 446, -15]],
    [0.65, [42, 472, -20]], [0.81, [-5, 491, 29]],
  ];
  futurePlans.forEach(([t, end], index) => {
    const secondary = limb(`future-secondary-${index + 1}`, 'future',
      main.future, t, end, 2.8 - index * 0.42, index % 2 ? -3 : 3, 28);
    const tip = onBranch(secondary, 0.83);
    const twig = limb(`future-bud-twig-${index + 1}`, 'future', secondary,
      0.80, add(tip.point, mul(tip.tangent, 8)), 0.24, 0.5, 12);
    for (let i = 0; i < 4; i += 1) attachLeaf(twig, 0.48 + i * 0.13, i % 2 ? -1 : 1, 'future', true);
  });
  for (let i = 0; i < 4; i += 1) attachLeaf(main.future, 0.95 + i * 0.014, i % 2 ? -1 : 1, 'future', true);

  // Finish each mature supporting limb with a short leafy continuation rather
  // than an exposed capped rod. Appending these after the existing growth keeps
  // the established seeded crown layout unchanged.
  matureSecondaries.forEach((secondary, index) => {
    const tip = onBranch(secondary, 1);
    const outward = unit([tip.point[0], 0, tip.point[2]]);
    const across = [-outward[2], 0, outward[0]];
    const direction = unit(add(add(mul(tip.tangent, 0.82), mul(outward, 0.16)),
      add([0, 0.025, 0], mul(across, (index % 2 ? 1 : -1) * 0.18))));
    const twig = limb(`${secondary.group}-crown-tip-twig-${index + 1}`, secondary.group,
      secondary, 0.965, inCrown(add(tip.point, mul(direction, range(7, 9)))),
      Math.min(0.48, tip.radius), (index % 2 ? 1 : -1) * 0.45, 14);
    for (let leafIndex = 0; leafIndex < 7; leafIndex += 1) {
      attachLeaf(twig, 0.23 + leafIndex * 0.12, leafIndex % 2 ? -1 : 1, secondary.group);
    }
  });

  // Interior infill is appended after every existing branch and leaf. This
  // preserves the established scaffold, roots, seeded geometry and anchors.
  // Each added blade belongs to a real twig, shoot and attached bough; there
  // are no detached foliage clouds or globally enlarged leaves.
  function infillEnd(point, maximumRadius = 188) {
    const end = inCrown(point, maximumRadius + (point[0] < -70 ? 12 : 0));
    const radius = Math.hypot(end[0], end[2]);
    const floor = radius < 75 ? 270 : radius < 125 ? 252 : 238;
    end[1] = clamp(end[1], floor, Math.min(492, crownTop(radius) - 4));
    return end;
  }

  function branchFrame(tangent) {
    const reference = Math.abs(tangent[1]) < 0.90 ? [0, 1, 0] : [0, 0, 1];
    const side = unit(cross(tangent, reference));
    return { side, depth: unit(cross(tangent, side)) };
  }

  const infillPlans = [];
  GROUPS.slice(0, 3).forEach((group, groupIndex) => {
    // Upper-trunk attachments wrap through a complete turn at staggered
    // heights. Their descendants bridge the gaps between the three scaffolds.
    for (let index = 0; index < 12; index += 1) {
      const height = 270 + index * 6.55 + groupIndex * 1.5 + Math.sin(index * 1.3) * 2;
      const join = atHeight(trunk, Math.min(349, height));
      const angle = mainAngles[group] + index * Math.PI * 2 / 12 + groupIndex * 0.37;
      const leftUpper = index >= 7 && Math.cos(angle) < -0.25;
      const radius = 50 + (index % 4) * 21 + range(-6, 6) + (leftUpper ? 24 : 0);
      infillPlans.push({
        parent: trunk, t: join.t, group,
        end: infillEnd(polar(radius, angle, 338 + index * 10 + groupIndex * 4 + (leftUpper ? 22 : 0))),
        radius: range(1.5, 2.25),
        mode: index >= 8 ? 'upright' : 'sweep',
      });
    }

    // Fine laterals grow from many positions along each mature main limb,
    // filling the middle crown rather than concentrating at the outer tips.
    for (let index = 0; index < 18; index += 1) {
      const t = 0.40 + index * 0.03;
      const origin = onBranch(main[group], t);
      const angle = mainAngles[group] + radians((index * 47 + groupIndex * 13) % 132 - 66);
      const radius = 76 + (index % 5) * 21 + range(-6, 6) + (group === 'campus' ? 18 : 0);
      const droop = index % 6 === 5 && origin.point[1] > 290;
      const height = droop ? origin.point[1] - range(7, 15)
        : Math.max(320, origin.point[1] + range(32, 82) + (group === 'campus' ? 18 : 0));
      infillPlans.push({
        parent: main[group], t, group,
        end: infillEnd(polar(radius, angle, height)), radius: range(1.25, 2.10),
        mode: droop ? 'droop' : 'sweep',
      });
    }

    // Existing high boughs support foliage around the central future line.
    // The new leaves stay assigned to mature groups; future itself stays in bud.
    const groupSecondaries = matureSecondaries.filter(secondary => secondary.group === group);
    for (let index = 0; index < 8; index += 1) {
      const parent = groupSecondaries[index * 2];
      const t = 0.48 + (index % 3) * 0.12;
      const origin = onBranch(parent, t);
      const leftUpper = index % 2 === 0;
      const angle = leftUpper ? radians([145, 168, 187, 202][index / 2] + groupIndex * 4)
        : mainAngles[group] + radians([-70, -40, 5, 53, 82, -97, 32, 101][index]);
      const radius = leftUpper ? [88, 108, 123, 102][index / 2] + groupIndex * 3
        : 30 + (index % 4) * 20 + range(-5, 5);
      const height = leftUpper ? crownTop(radius) - range(1, 7)
        : Math.max(390, origin.point[1] + range(25, 60));
      infillPlans.push({
        parent, t, group,
        end: infillEnd(polar(radius, angle, height)),
        radius: range(0.85, 1.70),
        mode: leftUpper ? 'sweep' : 'upright',
      });
    }
  });

  infillPlans.forEach((plan, index) => {
    const start = onBranch(plan.parent, plan.t);
    const delta = sub(plan.end, start.point);
    const across = unit([-delta[2], 0, delta[0]]);
    const bend = ((index % 5) - 2) * 2.3;
    const shoulder = add(start.point, [delta[0] * 0.33,
      plan.mode === 'upright' ? delta[1] * 0.24 : plan.mode === 'droop' ? 6 : delta[1] * 0.09,
      delta[2] * 0.33]);
    const elbow = add(mix(start.point, plan.end, 0.58), add(mul(across, bend),
      [0, plan.mode === 'droop' ? 4 : plan.mode === 'upright' ? 2 : -9, 0]));
    const upper = add(mix(start.point, plan.end, 0.82), mul(across, -bend * 0.36));
    const thickness = Math.min(plan.radius * (0.76 + (index % 5) * 0.13), start.radius * 0.76);
    const bough = branch(`${plan.group}-infill-bough-${index + 1}`, plan.group,
      [start.point, shoulder, elbow, upper, plan.end],
      [thickness, thickness * 0.86, thickness * 0.60, thickness * 0.30, Math.max(0.025, thickness * 0.07)],
      16, plan.parent.id, plan.t);
    for (let shootIndex = 0; shootIndex < 3; shootIndex += 1) {
      const t = [0.30, 0.59, 0.88][shootIndex];
      const node = onBranch(bough, t);
      const frame = branchFrame(node.tangent);
      const angle = index * 2.39996 + shootIndex * 2.15;
      const radial = add(mul(frame.side, Math.cos(angle)), mul(frame.depth, Math.sin(angle)));
      const direction = unit(add(add(mul(node.tangent, 0.26), radial), [0, 0.10, 0]));
      const shootEnd = infillEnd(add(node.point, mul(direction, range(23, 37))), 191);
      if (plan.mode === 'droop' && shootIndex !== 1) {
        shootEnd[1] = Math.max(Math.hypot(shootEnd[0], shootEnd[2]) < 75 ? 270 : 238,
          Math.min(shootEnd[1], node.point[1] - range(5, 11)));
      }
      const shoot = limb(`${plan.group}-infill-shoot-${index + 1}-${shootIndex}`, plan.group,
        bough, t, shootEnd,
        range(0.65, 1.15), Math.sin(angle) * 1.6, 12);

      for (let twigIndex = 0; twigIndex < 4; twigIndex += 1) {
        const twigT = 0.23 + twigIndex * 0.225;
        const attachment = onBranch(shoot, twigT);
        const twigFrame = branchFrame(attachment.tangent);
        const fan = angle + twigIndex * 2.13 + range(-0.20, 0.20);
        const lateral = add(mul(twigFrame.side, Math.cos(fan)), mul(twigFrame.depth, Math.sin(fan)));
        const twigDirection = unit(add(add(mul(attachment.tangent, 0.32), lateral), [0, 0.045, 0]));
        const twig = limb(`${plan.group}-infill-twig-${index + 1}-${shootIndex}-${twigIndex}`, plan.group,
          shoot, twigT, infillEnd(add(attachment.point, mul(twigDirection, range(16, 24))), 196),
          range(0.16, 0.32), Math.sin(fan) * 0.65, 12);
        // Blades occupy the full fine twig, including its interior nodes. This
        // produces connected foliage layers, not larger terminal pom-poms.
        for (let leafIndex = 0; leafIndex < 14; leafIndex += 1) {
          const leafT = clamp(0.08 + leafIndex * 0.068 + range(-0.012, 0.012), 0.06, 0.98);
          attachLeaf(twig, leafT, leafIndex % 2 ? -1 : 1, plan.group);
        }
      }
    }
  });

  // A few clean, open lateral gestures extend the lower crown. The existing
  // dense upper canopy stays intact; separated leaf sprays leave these arcs
  // legible instead of filling the added silhouette with another solid mass.
  const outreachPlans = [
    ['campus', 0.47, 178, 228, 276, 8],
    ['campus', 0.70, 160, 224, 331, 12],
    ['internships', 0.31, 18, 230, 286, 8],
    ['internships', 0.57, 40, 224, 343, 16],
    ['projects', 0.38, 292, 226, 328, 10],
    ['projects', 0.60, 255, 222, 366, 6],
  ];
  const outreachEnd = point => {
    const end = point.slice(), radius = Math.hypot(end[0], end[2]);
    if (radius > 233) { end[0] *= 233 / radius; end[2] *= 233 / radius; }
    return end;
  };
  outreachPlans.forEach(([group, t, degrees, radius, height, lift], index) => {
    const parent = main[group], start = onBranch(parent, t);
    const end = polar(radius, radians(degrees), height);
    const direction = unit(sub(end, start.point));
    const side = unit([-direction[2], 0, direction[0]]);
    const thickness = Math.min(4.6 - (index % 2) * 0.7, start.radius * 0.60);
    const bough = branch(`${group}-outreach-bough-${index + 1}`, group,
      [start.point, add(mix(start.point, end, 0.32), [0, lift, 0]),
        add(mix(start.point, end, 0.72), mul(side, index % 2 ? -4 : 4)), end],
      [thickness, thickness * 0.78, thickness * 0.39, 0.18], 28, parent.id, t);
    [0.46, 0.71, 0.91].forEach((attachT, cluster) => {
      const node = onBranch(bough, attachT), sign = (index + cluster) % 2 ? -1 : 1;
      const shootEnd = outreachEnd(add(node.point,
        add(mul(direction, 9 + cluster * 2), add(mul(side, sign * (13 - cluster)),
          [0, cluster === 1 ? 13 : -5 + index % 3 * 3, 0]))));
      const shoot = limb(`${group}-outreach-shoot-${index + 1}-${cluster}`, group,
        bough, attachT, shootEnd, 0.74, sign * 0.65, 14);
      for (let twigIndex = 0; twigIndex < 3; twigIndex += 1) {
        const twigT = 0.38 + twigIndex * 0.25, node = onBranch(shoot, twigT);
        const frame = branchFrame(node.tangent), fan = index * 1.8 + cluster * 2.1 + twigIndex * 2.4;
        const twigDirection = unit(add(mul(node.tangent, 0.42),
          add(mul(frame.side, Math.cos(fan)), mul(frame.depth, Math.sin(fan) * 0.65))));
        const twig = limb(`${group}-outreach-twig-${index + 1}-${cluster}-${twigIndex}`, group,
          shoot, twigT, outreachEnd(add(node.point, mul(twigDirection, 12 + twigIndex * 1.5))),
          0.22, 0.3 * sign, 10);
        const leafCount = cluster === 1 ? 13 : cluster === 0 ? 9 : 7;
        for (let leafIndex = 0; leafIndex < leafCount; leafIndex += 1) {
          attachLeaf(twig, 0.20 + leafIndex / (leafCount - 1) * 0.75,
            leafIndex % 2 ? -1 : 1, group);
        }
      }
    });
    // Finish the main gesture with a light, tapering tuft rather than a bare cap.
    for (let i = 0; i < 5; i += 1) attachLeaf(bough, 0.91 + i * 0.021, i % 2 ? -1 : 1, group);
  });

  const labels = { campus: '校园', internships: '实习', projects: '项目', future: '下一站' };
  const anchors = GROUPS.map(group => ({
    id: group, label: labels[group], position: main[group].points[main[group].points.length - 1].slice(),
  }));

  return { branches, leaves, anchors };
}
