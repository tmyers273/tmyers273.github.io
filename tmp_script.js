
  import React, { useMemo, useState } from "https://esm.sh/react@18.3.1?bundle";
  import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?bundle";

  const h = React.createElement;

  function formatNs(ns) {
    return `${(ns / 1000).toFixed(2)} µs`;
  }

  function row(label, value, rangeProps, setValue) {
    return h("label", { className: "xgb-control" },
      h("span", null, `${label}: ${value}`),
      h("input", {
        type: "range",
        min: rangeProps.min,
        max: rangeProps.max,
        step: rangeProps.step,
        value: value,
        onInput: (e) => setValue(parseInt(e.target.value, 10)),
      }),
    );
  }

  function MetricCard({ title, colorClass, values }) {
    const width = Math.min(100, Math.max(5, (values.p99 / 3000) * 100));
    return h("div", { className: `xgb-card ${colorClass}` },
      h("h4", null, title),
      h("div", null, `p50: ${formatNs(values.p50)} | p99: ${formatNs(values.p99)} | max: ${formatNs(values.max)}`),
      h("div", { className: "xgb-bar" }, h("div", { className: "xgb-fill", style: { width: `${width}%` })),
    );
  }

  function App() {
    const [trees, setTrees] = useState(200);
    const [depth, setDepth] = useState(5);
    const [cores, setCores] = useState(1);

    const { naive, flat, gain } = useMemo(() => {
      const base = trees * (depth * 1.2 + 3.5) * (1 + Math.log2(cores) * 0.08);
      const naive = {
        p50: base,
        p99: base * 1.28,
        max: base * 3,
      };
      const flat = {
        p50: naive.p50 * 0.922,
        p99: naive.p99 * 0.972,
        max: naive.max * 0.89,
      };
      const gain = {
        p50: ((1 - flat.p50 / naive.p50) * 100).toFixed(1),
        p99: ((1 - flat.p99 / naive.p99) * 100).toFixed(1),
      };
      return { naive, flat, gain };
    }, [trees, depth, cores]);

    return h("article", { className: "xgb-latency-demo" },
      h("h3", null, "XGBoost latency estimator"),
      h("p", null, "Adjust model shape to compare a naive pointer-based tree layout vs a flattened, cache-friendly layout."),
      h("div", { className: "xgb-controls" },
        row("Trees", trees, { min: 32, max: 512, step: 8 }, setTrees),
        row("Depth", depth, { min: 2, max: 10, step: 1 }, setDepth),
        row("Concurrent workers", cores, { min: 1, max: 8, step: 1 }, setCores),
      ),
      h("div", { className: "xgb-grid" },
        h(MetricCard, { title: "Naive", colorClass: "xgb-naive", values: naive }),
        h(MetricCard, { title: "Flattened", colorClass: "xgb-flat", values: flat }),
      ),
      h("p", null, `Estimated improvement: ${gain.p50}% p50, ${gain.p99}% p99`),
    );
  }

  const container = document.getElementById("xgb-latency-demo");
  if (container) createRoot(container).render(h(App));
