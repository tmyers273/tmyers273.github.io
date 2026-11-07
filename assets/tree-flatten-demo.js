const mount = document.getElementById("tree-flatten-demo");
if (!mount) {
  throw new Error("missing #tree-flatten-demo");
}

const featureNames = [
  "income",
  "credit_score",
  "age",
  "dependents",
  "debt_ratio",
  "open_accounts",
  "utilization",
];

const compiledExampleTrees = {
  baseScore: 0.0,
  learningRate: 0.1,
  depth: 3,
  trees: [
    {
      name: "tree-0",
      nodes: [
        { feature: 0, threshold: 52000, leaf: false },
        { feature: 1, threshold: 680, leaf: false },
        { feature: 4, threshold: 0.45, leaf: false },
        { feature: 2, threshold: 30, leaf: false },
        { feature: 3, threshold: 2, leaf: false },
        { feature: 5, threshold: 3, leaf: false },
        { feature: 6, threshold: 0.35, leaf: false },
        { leaf: true, value: -0.20 },
        { leaf: true, value: 0.35 },
        { leaf: true, value: 0.10 },
        { leaf: true, value: -0.50 },
        { leaf: true, value: 0.25 },
        { leaf: true, value: 0.00 },
        { leaf: true, value: 0.60 },
        { leaf: true, value: -0.15 },
      ],
    },
    {
      name: "tree-1",
      nodes: [
        { feature: 0, threshold: 46000, leaf: false },
        { feature: 2, threshold: 28, leaf: false },
        { feature: 2, threshold: 55, leaf: false },
        { feature: 1, threshold: 690, leaf: false },
        { feature: 3, threshold: 1, leaf: false },
        { feature: 1, threshold: 700, leaf: false },
        { feature: 2, threshold: 45, leaf: false },
        { leaf: true, value: -0.80 },
        { leaf: true, value: -0.35 },
        { leaf: true, value: 0.12 },
        { leaf: true, value: -0.20 },
        { leaf: true, value: 0.28 },
        { leaf: true, value: -0.60 },
        { leaf: true, value: 0.18 },
        { leaf: true, value: 0.00 },
      ],
    },
  ],
};

function compileLevelMajor(trees, depth) {
  const levelThresholds = [];
  const levelFeatures = [];

  for (let level = 0; level < depth; level++) {
    const perLevel = 1 << level;
    const base = perLevel - 1;
    const thresholds = [];
    const features = [];
    for (let treeIndex = 0; treeIndex < trees.length; treeIndex++) {
      const treeNodes = trees[treeIndex].nodes;
      for (let pos = 0; pos < perLevel; pos++) {
        const node = treeNodes[base + pos];
        thresholds.push(node.threshold);
        features.push(node.feature);
      }
    }
    levelThresholds.push(thresholds);
    levelFeatures.push(features);
  }

  const leafValues = [];
  const leafCount = 1 << depth;
  const leafBase = leafCount - 1;
  for (let treeIndex = 0; treeIndex < trees.length; treeIndex++) {
    const treeNodes = trees[treeIndex].nodes;
    for (let leaf = 0; leaf < leafCount; leaf++) {
      leafValues.push(treeNodes[leafBase + leaf].value);
    }
  }

  return {
    levelThresholds,
    levelFeatures,
    leafValues,
  };
}

const compiled = {
  ...compiledExampleTrees,
  ...compileLevelMajor(compiledExampleTrees.trees, compiledExampleTrees.depth),
};

function nodeFeatureName(featureIndex) {
  return featureNames[featureIndex] ?? `f${featureIndex}`;
}

function evaluateRawTree(tree, features) {
  const depth = Math.floor(Math.log2(tree.nodes.length + 1) / 1) - 1;
  const path = [];
  let nodeIndex = 0;
  let node = tree.nodes[nodeIndex];

  for (let level = 0; level < depth; level++) {
    const featureIndex = node.feature;
    const threshold = node.threshold;
    const right = features[featureIndex] > threshold;
    path.push({
      level,
      nodeIndex,
      feature: featureIndex,
      threshold,
      featureValue: features[featureIndex],
      right,
    });
    nodeIndex = nodeIndex * 2 + 1 + (right ? 1 : 0);
    node = tree.nodes[nodeIndex];
  }

  return {
    leafValue: tree.nodes[nodeIndex].value,
    path,
  };
}

function evaluateFlattenedTree(treeIndex, features) {
  const { depth, levelThresholds, levelFeatures, leafValues } = compiled;
  let path = 0;
  const traversal = [];

  for (let level = 0; level < depth; level++) {
    const nodesAtLevel = 1 << level;
    const offset = treeIndex * nodesAtLevel;
    const pathIdx = offset + path;
    const featureIdx = levelFeatures[level][pathIdx];
    const threshold = levelThresholds[level][pathIdx];
    const right = features[featureIdx] > threshold;
    traversal.push({
      level,
      nodeIndex: (1 << level) - 1 + path,
      feature: featureIdx,
      threshold,
      featureValue: features[featureIdx],
      path,
      right,
      slot: pathIdx,
    });
    path = (path << 1) | (right ? 1 : 0);
  }

  const leafBase = treeIndex * (1 << depth);
  return {
    leafValue: leafValues[leafBase + path],
    traversal,
    leaf: path,
  };
}

function renderAsciiTree(treeIndex, treeData, depth, progress, currentStep) {
  const card = document.createElement("article");
  card.className = "tfd-tree-card";

  const heading = document.createElement("h4");
  heading.textContent = treeData.name;
  card.append(heading);

  const pre = document.createElement("pre");
  pre.className = "tfd-ascii-tree";

  const nodes = treeData.nodes;
  const maxNodes = (1 << (depth + 1)) - 1;
  const visitedNodes = progress?.visitedNodes ?? new Set();
  const takenEdges = progress?.takenEdges ?? new Set();
  const activeNode = currentStep && currentStep.kind === "decision" && currentStep.treeIndex === treeIndex
    ? currentStep.nodeIndex
    : -1;
  const activeLeafNode = currentStep && currentStep.kind === "leaf" && currentStep.treeIndex === treeIndex
    ? ((1 << depth) - 1 + currentStep.leaf)
    : -1;
  const selectedLeafNode = progress?.selectedLeaf === null ? -1 : ((1 << depth) - 1 + progress.selectedLeaf);
  function nodeLabel(nodeIndex) {
    const node = nodes[nodeIndex];
    if (node.leaf) return `${formatValue(node.value)}`;
    return `${nodeFeatureName(node.feature)} <= ${formatValue(node.threshold)}`;
  }

  function appendLine(text, className) {
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    pre.append(line);
  }

  appendLine(nodeLabel(0), activeNode === 0 ? "tfd-ascii-line tfd-ascii-active" : "tfd-ascii-line");

  function walk(parentIndex, prefix, ancestorUnreachable) {
    if (parentIndex >= maxNodes) return;
    const left = parentIndex * 2 + 1;
    const right = left + 1;
    if (left >= maxNodes || right >= maxNodes) return;

    const branches = [
      { child: left, name: "yes", isLast: false },
      { child: right, name: "no ", isLast: true },
    ];

    for (const branch of branches) {
      const edgeKey = `${parentIndex}->${branch.child}`;
      const connector = branch.isLast ? "└─" : "├─";
      const text = `${prefix}${connector} ${branch.name} → ${nodeLabel(branch.child)}`;
      const isActive = activeNode === branch.child || activeLeafNode === branch.child;
      const isTaken = takenEdges.has(edgeKey);
      const isLeaf = !!nodes[branch.child].leaf;
      const isSelectedLeaf = isLeaf && branch.child === selectedLeafNode;
      const isUnreachable = ancestorUnreachable || (visitedNodes.has(parentIndex) && !isTaken);

      let className = "tfd-ascii-line";
      if (isActive) className += " tfd-ascii-active";
      else if (isSelectedLeaf) className += " tfd-ascii-terminal";
      else if (isUnreachable) className += " tfd-ascii-muted";
      else if (isTaken) className += " tfd-ascii-taken";

      appendLine(text, className);

      if (!nodes[branch.child].leaf) {
        walk(branch.child, `${prefix}${branch.isLast ? "   " : "│  "}`, isUnreachable);
      }
    }
  }

  walk(0, "", false);
  card.append(pre);

  return card;
}

const demoFeatures = [50000, 700, 34, 2, 0.40, 4, 0.22];

const player = document.createElement("div");
player.className = "tfd-player";

const arraysPanel = document.createElement("div");
arraysPanel.className = "tfd-arrays";

const stepPanel = document.createElement("div");
stepPanel.className = "tfd-walkthrough";

const treePreview = document.createElement("div");
treePreview.className = "tfd-tree-preview";

const rightColumn = document.createElement("div");
rightColumn.className = "tfd-right-column";
rightColumn.append(arraysPanel, stepPanel);

const contentLayout = document.createElement("div");
contentLayout.className = "tfd-layout";
contentLayout.append(treePreview, rightColumn);

let currentStepIndex = 0;
let timer = null;

const btnPrev = document.createElement("button");
btnPrev.type = "button";
btnPrev.textContent = "Prev";
const btnPlay = document.createElement("button");
btnPlay.type = "button";
btnPlay.textContent = "Play";
const btnNext = document.createElement("button");
btnNext.type = "button";
btnNext.textContent = "Next";
const btnReset = document.createElement("button");
btnReset.type = "button";
btnReset.textContent = "Reset";
const stepLabel = document.createElement("span");
stepLabel.className = "tfd-step-label";
const depthPathLabel = document.createElement("span");
depthPathLabel.className = "tfd-step-label";
player.append(btnPrev, btnPlay, btnNext, btnReset, stepLabel, depthPathLabel);

const heading = document.createElement("h3");
heading.textContent = "Compiled-tree flattening demo";

const note = document.createElement("div");
note.className = "tfd-note";
note.textContent = "Use Prev/Next/Play to walk the flattened kernel one operation at a time.";

mount.append(heading, player, contentLayout, note);

function formatValue(value) {
  if (Number.isInteger(value)) return String(value);
  return Number(value).toFixed(2);
}

function buildFeatures() {
  return [...demoFeatures];
}

function buildSteps(features) {
  const steps = [];
  for (let treeIndex = 0; treeIndex < compiled.trees.length; treeIndex++) {
    let path = 0;
    for (let level = 0; level < compiled.depth; level++) {
      const slot = treeIndex * (1 << level) + path;
      const feature = compiled.levelFeatures[level][slot];
      const threshold = compiled.levelThresholds[level][slot];
      const featureValue = features[feature];
      const right = featureValue > threshold;
      const nextPath = (path << 1) | (right ? 1 : 0);
      steps.push({
        kind: "decision",
        treeIndex,
        level,
        path,
        slot,
        feature,
        threshold,
        featureValue,
        right,
        nextPath,
        nodeIndex: (1 << level) - 1 + path,
      });
      path = nextPath;
    }
    const leafIdx = treeIndex * (1 << compiled.depth) + path;
    steps.push({
      kind: "leaf",
      treeIndex,
      leaf: path,
      leafIdx,
      value: compiled.leafValues[leafIdx],
    });
  }
  return steps;
}

function buildProgress(steps, upto) {
  const byTree = Array.from(
    { length: compiled.trees.length },
    () => ({ visitedNodes: new Set(), takenEdges: new Set(), selectedLeaf: null }),
  );
  let runningSum = 0;
  for (let i = 0; i <= upto && i < steps.length; i++) {
    const step = steps[i];
    if (step.kind === "decision") {
      byTree[step.treeIndex].visitedNodes.add(step.nodeIndex);
      const childIndex = step.nodeIndex * 2 + 1 + (step.right ? 1 : 0);
      byTree[step.treeIndex].takenEdges.add(`${step.nodeIndex}->${childIndex}`);
    }
    if (step.kind === "leaf") {
      byTree[step.treeIndex].selectedLeaf = step.leaf;
      runningSum += step.value;
    }
  }
  return { byTree, runningSum };
}

function renderArrayRow(label, values, activeIndex) {
  const row = document.createElement("div");
  row.className = "tfd-array-row";

  const name = document.createElement("div");
  name.className = "tfd-array-name";
  name.textContent = label;

  const valuesWrap = document.createElement("div");
  valuesWrap.className = "tfd-array-values";
  valuesWrap.append("[");
  for (let i = 0; i < values.length; i++) {
    const token = document.createElement("span");
    token.className = "tfd-array-token";
    if (activeIndex === i) token.className += " tfd-array-token-active";
    token.textContent = `${formatValue(values[i])}`;
    valuesWrap.append(token);
    if (i < values.length - 1) valuesWrap.append(", ");
  }
  valuesWrap.append("]");

  row.append(name, valuesWrap);
  return row;
}

function renderLevelRow(level, values, activeIndex) {
  const row = document.createElement("div");
  row.className = "tfd-array-row";

  const name = document.createElement("div");
  name.className = "tfd-array-name";
  name.textContent = `level ${level}`;

  const valuesWrap = document.createElement("div");
  valuesWrap.className = "tfd-array-values";
  valuesWrap.append("[");
  for (let i = 0; i < values.length; i++) {
    const token = document.createElement("span");
    token.className = "tfd-array-token";
    if (activeIndex === i) token.className += " tfd-array-token-active";
    token.textContent = `${formatValue(values[i])}`;
    valuesWrap.append(token);
    if (i < values.length - 1) valuesWrap.append(", ");
  }
  valuesWrap.append("]");

  row.append(name, valuesWrap);
  return row;
}

function renderGroup(titleText, levels, activeLevel, activeSlot) {
  const group = document.createElement("div");
  group.className = "tfd-array-group";

  const title = document.createElement("div");
  title.className = "tfd-array-name";
  title.textContent = titleText;
  group.append(title);

  for (let level = 0; level < levels.length; level++) {
    group.append(renderLevelRow(level, levels[level], level === activeLevel ? activeSlot : -1));
  }

  return group;
}

function renderArrays(features, step) {
  const panelTitle = document.createElement("h4");
  panelTitle.textContent = "Raw Arrays";

  let activeFeatureIdx = -1;
  let activeLevel = -1;
  let activeSlot = -1;
  let activeLeafIdx = -1;
  if (step && step.kind === "decision") {
    activeFeatureIdx = step.feature;
    activeLevel = step.level;
    activeSlot = step.slot;
  }
  if (step && step.kind === "leaf") {
    activeLeafIdx = step.leafIdx;
  }

  const rows = [];
  rows.push(renderArrayRow("features", features, activeFeatureIdx));
  rows.push(renderGroup("level_features", compiled.levelFeatures, activeLevel, activeSlot));
  rows.push(renderGroup("level_thresholds", compiled.levelThresholds, activeLevel, activeSlot));
  rows.push(renderArrayRow("leaf_values", compiled.leafValues, activeLeafIdx));
  arraysPanel.replaceChildren(panelTitle, ...rows);
}

function renderStepDetails(step, totalSteps) {
  const title = document.createElement("h4");
  title.textContent = "Current Operation";

  const pre = document.createElement("pre");
  pre.className = "tfd-walkthrough-code";
  if (!step) {
    pre.textContent = "No step selected.";
  } else if (step.kind === "decision") {
    const goesLeft = step.featureValue <= step.threshold;
    const bit = goesLeft ? 0 : 1;
    const fname = nodeFeatureName(step.feature);
    const decisionText = `${fname} (${formatValue(step.featureValue)}) <= ${formatValue(step.threshold)} => ${
      goesLeft ? "yes" : "no"
    } => ${goesLeft ? "left" : "right"}`;
    pre.textContent = [
      `decision: ${decisionText}`,
      `idx = t*(1<<l)+p = ${step.treeIndex}*${1 << step.level}+${step.path} = ${step.slot}`,
      `feature_idx = level_features[${step.level}][${step.slot}] = ${step.feature}`,
      `feature_value = features[${step.feature}] = ${formatValue(step.featureValue)}`,
      `threshold = level_thresholds[${step.level}][${step.slot}] = ${formatValue(step.threshold)}`,
      `bit = (${formatValue(step.featureValue)} <= ${formatValue(step.threshold)}) ? 0 : 1 = ${bit} (${goesLeft ? "left" : "right"})`,
      `next_path = (p<<1)|bit = (${step.path}<<1)|${bit} = ${step.nextPath}`,
    ].join("\n");
  } else {
    pre.textContent = [
      `final_path=${step.leaf}`,
      `leaf_idx = t*(1<<D)+path = ${step.treeIndex}*${1 << compiled.depth}+${step.leaf} = ${step.leafIdx}`,
      `leaf_value = leaf_values[${step.leafIdx}] = ${formatValue(step.value)}`,
    ].join("\n");
  }

  stepPanel.replaceChildren(title, pre);
}

function stopPlaying() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  btnPlay.textContent = "Play";
}

btnPrev.addEventListener("click", () => {
  stopPlaying();
  currentStepIndex = Math.max(0, currentStepIndex - 1);
  render();
});

btnNext.addEventListener("click", () => {
  stopPlaying();
  const steps = buildSteps(buildFeatures());
  currentStepIndex = Math.min(steps.length - 1, currentStepIndex + 1);
  render();
});

btnReset.addEventListener("click", () => {
  stopPlaying();
  currentStepIndex = 0;
  render();
});

btnPlay.addEventListener("click", () => {
  const steps = buildSteps(buildFeatures());
  if (!steps.length) return;
  if (timer) {
    stopPlaying();
    return;
  }
  btnPlay.textContent = "Pause";
  timer = setInterval(() => {
    if (currentStepIndex >= steps.length - 1) {
      stopPlaying();
      return;
    }
    currentStepIndex += 1;
    render();
  }, 950);
});

function render() {
  const features = buildFeatures();
  const steps = buildSteps(features);
  currentStepIndex = Math.max(0, Math.min(currentStepIndex, steps.length - 1));
  const currentStep = steps[currentStepIndex];
  const progress = buildProgress(steps, currentStepIndex);
  const currentTreeIndex = currentStep?.treeIndex ?? 0;

  stepLabel.textContent = `Step ${currentStepIndex + 1}/${steps.length} | Tree ${currentTreeIndex + 1}/${compiled.trees.length}`;
  if (currentStep?.kind === "decision") {
    depthPathLabel.textContent = `depth=${currentStep.level} | p=${currentStep.path}`;
  } else if (currentStep?.kind === "leaf") {
    depthPathLabel.textContent = `depth=${compiled.depth} | p=${currentStep.leaf}`;
  } else {
    depthPathLabel.textContent = "";
  }
  renderArrays(features, currentStep);
  renderStepDetails(currentStep, steps.length);
  treePreview.replaceChildren(
    renderAsciiTree(
      currentTreeIndex,
      compiledExampleTrees.trees[currentTreeIndex],
      compiled.depth,
      progress.byTree[currentTreeIndex],
      currentStep,
    ),
  );
}

render();
