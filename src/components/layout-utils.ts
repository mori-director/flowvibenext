import { Node, Edge, Position } from "@xyflow/react";

// Layout configuration
const HORIZONTAL_SPACING = 220; // Space between nodes on main axis (left→right)
const VERTICAL_SPACING = 140;   // Space between main flow and N-branch
const NODE_WIDTH = 150;
const NODE_HEIGHT = 50;
const DECISION_WIDTH = 160;
const DECISION_HEIGHT = 80;

// Helper: Get node dimensions
const getNodeSize = (type?: string) => ({
  width: type === "decision" ? DECISION_WIDTH : NODE_WIDTH,
  height: type === "decision" ? DECISION_HEIGHT : NODE_HEIGHT,
});

// Build adjacency for outgoing edges from each node
const buildOutgoingMap = (edges: Edge[]) => {
  const map: Record<string, Edge[]> = {};
  edges.forEach((e) => {
    if (!map[e.source]) map[e.source] = [];
    map[e.source].push(e);
  });
  return map;
};

// Find the "main" (non-N) outgoing edge from a node
const findMainEdge = (nodeId: string, outMap: Record<string, Edge[]>): Edge | null => {
  const outEdges = outMap[nodeId] || [];
  // Prefer Y-labeled edge, then unlabeled, then anything that's not N
  return (
    outEdges.find((e) => e.label === "Y") ||
    outEdges.find((e) => !e.label || e.label === "") ||
    outEdges.find((e) => e.label !== "N") ||
    null
  );
};

// Find the N-branch edge from a node
const findNEdge = (nodeId: string, outMap: Record<string, Edge[]>): Edge | null => {
  const outEdges = outMap[nodeId] || [];
  return outEdges.find((e) => e.label === "N") || null;
};

// Trace main path from a start node (following Y/default edges)
const traceMainPath = (
  startId: string,
  outMap: Record<string, Edge[]>,
  visited: Set<string>,
): string[] => {
  const path: string[] = [];
  let currentId: string | null = startId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    path.push(currentId);
    const mainEdge = findMainEdge(currentId, outMap);
    currentId = mainEdge ? mainEdge.target : null;
  }

  return path;
};

// Collision map to track occupied regions
interface OccupiedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const hasCollision = (
  x: number,
  y: number,
  w: number,
  h: number,
  occupied: OccupiedRect[],
): boolean => {
  const margin = 20;
  return occupied.some(
    (r) =>
      x < r.x + r.w + margin &&
      x + w + margin > r.x &&
      y < r.y + r.h + margin &&
      y + h + margin > r.y,
  );
};

// =====================
// CUSTOM LAYOUT ENGINE
// =====================
export const getLayoutedElements = async (
  nodes: Node[],
  edges: Edge[],
  direction = "TB",
) => {
  const isHorizontal = direction === "LR";
  const outMap = buildOutgoingMap(edges);

  // Find start nodes (no incoming edges)
  const startNodeIds = nodes
    .filter((n) => !edges.some((e) => e.target === n.id))
    .map((n) => n.id);

  // Position storage
  const positions: Record<string, { x: number; y: number }> = {};
  const occupied: OccupiedRect[] = [];
  const globalVisited = new Set<string>();

  // Recursive layout function
  const layoutPath = (startId: string, baseX: number, baseY: number) => {
    const path = traceMainPath(startId, outMap, globalVisited);

    let x = baseX;
    let y = baseY;

    for (const nodeId of path) {
      const nodeData = nodes.find((n) => n.id === nodeId);
      const { width: nw, height: nh } = getNodeSize(nodeData?.type);

      if (isHorizontal) {
        // LR mode: Main flow goes LEFT → RIGHT
        // Resolve collision by pushing Y down
        while (hasCollision(x, y, nw, nh, occupied)) {
          y += VERTICAL_SPACING;
        }
        positions[nodeId] = { x, y };
        occupied.push({ x, y, w: nw, h: nh });

        // Check for N branch → goes DOWN
        const nEdge = findNEdge(nodeId, outMap);
        if (nEdge && !globalVisited.has(nEdge.target)) {
          layoutPath(nEdge.target, x, y + VERTICAL_SPACING);
        }

        x += HORIZONTAL_SPACING;
      } else {
        // TB mode: Main flow goes TOP → BOTTOM
        // Resolve collision by pushing X right
        while (hasCollision(x, y, nw, nh, occupied)) {
          x += HORIZONTAL_SPACING;
        }
        positions[nodeId] = { x, y };
        occupied.push({ x, y, w: nw, h: nh });

        // Check for N branch → goes RIGHT
        const nEdge = findNEdge(nodeId, outMap);
        if (nEdge && !globalVisited.has(nEdge.target)) {
          layoutPath(nEdge.target, x + HORIZONTAL_SPACING, y);
        }

        y += VERTICAL_SPACING;
      }
    }
  };

  // Layout each start node's tree
  let startOffset = 0;
  for (const startId of startNodeIds) {
    if (!globalVisited.has(startId)) {
      if (isHorizontal) {
        layoutPath(startId, 0, startOffset);
      } else {
        layoutPath(startId, startOffset, 0);
      }
      // Calculate offset for next disconnected component
      if (isHorizontal) {
        const maxY = Math.max(...Object.values(positions).map((p) => p.y), 0);
        startOffset = maxY + VERTICAL_SPACING * 2;
      } else {
        const maxX = Math.max(...Object.values(positions).map((p) => p.x), 0);
        startOffset = maxX + HORIZONTAL_SPACING * 2;
      }
    }
  }

  // Handle any unvisited nodes (orphans or cycles)
  nodes.forEach((node) => {
    if (!positions[node.id]) {
      const { width: nw, height: nh } = getNodeSize(node.type);
      let ox = 0;
      let oy = startOffset;
      while (hasCollision(ox, oy, nw, nh, occupied)) {
        if (isHorizontal) ox += HORIZONTAL_SPACING;
        else oy += VERTICAL_SPACING;
      }
      positions[node.id] = { x: ox, y: oy };
      occupied.push({ x: ox, y: oy, w: nw, h: nh });
    }
  });

  // Build final nodes
  const layoutedNodes = nodes.map((node) => {
    const pos = positions[node.id] || { x: 0, y: 0 };
    const { width, height } = getNodeSize(node.type);
    return {
      ...node,
      position: pos,
      width,
      height,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      style: { ...node.style, opacity: 1 },
    };
  });

  // Build final edges with SMART 1:1 handle distribution
  // Step 1: Group edges by source and target
  const outgoingByNode: Record<string, Edge[]> = {};
  const incomingByNode: Record<string, Edge[]> = {};
  edges.forEach((e) => {
    if (!outgoingByNode[e.source]) outgoingByNode[e.source] = [];
    outgoingByNode[e.source].push(e);
    if (!incomingByNode[e.target]) incomingByNode[e.target] = [];
    incomingByNode[e.target].push(e);
  });

  // Step 2: Pre-assign source handles per node (distribute outgoing edges)
  const edgeSourceHandles: Record<string, string> = {};
  const edgeTargetHandles: Record<string, string> = {};

  Object.keys(outgoingByNode).forEach((srcId) => {
    const srcEdges = outgoingByNode[srcId];
    const srcPos = positions[srcId];
    if (!srcPos) return;

    if (isHorizontal) {
      // LR mode: Main/Y → right, N → bottom, extras → top
      const mainEdges = srcEdges.filter((e) => e.label !== "N");
      const nEdges = srcEdges.filter((e) => e.label === "N");

      // Assign main edges to right handle
      mainEdges.forEach((e) => {
        edgeSourceHandles[e.id] = "right-source";
      });

      // Assign N edges: first N → bottom, second N → top
      nEdges.forEach((e, i) => {
        edgeSourceHandles[e.id] = i === 0 ? "bottom-source" : "top-source";
      });
    } else {
      // TB mode: Main/Y → bottom, N → right, extras → left
      const mainEdges = srcEdges.filter((e) => e.label !== "N");
      const nEdges = srcEdges.filter((e) => e.label === "N");

      mainEdges.forEach((e) => {
        edgeSourceHandles[e.id] = "bottom-source";
      });

      nEdges.forEach((e, i) => {
        edgeSourceHandles[e.id] = i === 0 ? "right-source" : "left-source";
      });
    }
  });

  // Step 3: Pre-assign target handles per node (distribute incoming edges)
  Object.keys(incomingByNode).forEach((tgtId) => {
    const tgtEdges = incomingByNode[tgtId];
    const tgtPos = positions[tgtId];
    if (!tgtPos) return;

    if (isHorizontal) {
      // LR mode: Determine target handle based on source position
      tgtEdges.forEach((e) => {
        const srcPos = positions[e.source];
        if (!srcPos) { edgeTargetHandles[e.id] = "left-target"; return; }

        if (srcPos.y < tgtPos.y - 20) {
          // Source is ABOVE → enter from top
          edgeTargetHandles[e.id] = "top-target";
        } else if (srcPos.y > tgtPos.y + 20) {
          // Source is BELOW → enter from bottom
          edgeTargetHandles[e.id] = "bottom-target";
        } else {
          // Source is roughly same Y → enter from left (main flow)
          edgeTargetHandles[e.id] = "left-target";
        }
      });
    } else {
      // TB mode: Determine target handle based on source position
      // KEY FIX: If source is to the RIGHT, use right-target (not left!)
      //          so the line stays on the right side and doesn't cross the main flow
      tgtEdges.forEach((e) => {
        const srcPos = positions[e.source];
        if (!srcPos) { edgeTargetHandles[e.id] = "top-target"; return; }

        if (srcPos.x > tgtPos.x + 20) {
          // Source is to the RIGHT → enter from right (N-branch return)
          edgeTargetHandles[e.id] = "right-target";
        } else if (srcPos.x < tgtPos.x - 20) {
          // Source is to the LEFT → enter from left
          edgeTargetHandles[e.id] = "left-target";
        } else {
          // Source is roughly same X → enter from top (main flow)
          edgeTargetHandles[e.id] = "top-target";
        }
      });
    }
  });


  // Step 4: Build final edges with assigned handles
  const finalEdges = edges.map((edge) => {
    const sourceHandle = edgeSourceHandles[edge.id] || (isHorizontal ? "right-source" : "bottom-source");
    const targetHandle = edgeTargetHandles[edge.id] || (isHorizontal ? "left-target" : "top-target");

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });

  return { nodes: layoutedNodes, edges: finalEdges };
};










