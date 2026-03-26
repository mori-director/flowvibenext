import { Node, Edge, Position } from "@xyflow/react";

// ===========================
// Layout Constants
// ===========================
const MAIN_GAP = 40;          // Gap along main axis (sequential flow)
const BRANCH_GAP = 70;        // Gap along branch axis (multi-branch)
const DECISION_MAIN_GAP = 80; // Gap for Y-branch (decision → next)
const DECISION_BRANCH_GAP = 140; // Gap for N-branch (decision → side)
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const DECISION_WIDTH = 180;
const DECISION_HEIGHT = 80;
const COLLISION_MARGIN = 30;  // Minimum space between any two nodes

const getNodeSize = (type?: string) => ({
  width: type === "decision" ? DECISION_WIDTH : NODE_WIDTH,
  height: type === "decision" ? DECISION_HEIGHT : NODE_HEIGHT,
});

// ===========================
// Collision Detection Grid
// ===========================
interface OccupiedRect {
  x: number; y: number; w: number; h: number; nodeId: string;
}

const checkCollision = (
  x: number, y: number, w: number, h: number, 
  occupied: OccupiedRect[], excludeId?: string
): boolean => {
  return occupied.some(r => {
    if (r.nodeId === excludeId) return false;
    return (
      x < r.x + r.w + COLLISION_MARGIN &&
      x + w + COLLISION_MARGIN > r.x &&
      y < r.y + r.h + COLLISION_MARGIN &&
      y + h + COLLISION_MARGIN > r.y
    );
  });
};

// ===========================
// Edge Classification Helpers
// ===========================

/** Get the "main flow" edge from a node: Y-labeled or unlabeled */
const getMainEdge = (nodeId: string, outMap: Record<string, Edge[]>): Edge | null => {
  const outEdges = outMap[nodeId] || [];
  return (
    outEdges.find(e => e.label === "Y") ||
    outEdges.find(e => !e.label || e.label === "") ||
    null
  );
};

/** Get the N-branch edge from a node */
const getNEdge = (nodeId: string, outMap: Record<string, Edge[]>): Edge | null => {
  const outEdges = outMap[nodeId] || [];
  return outEdges.find(e => e.label === "N") || null;
};

/** Get all non-Y/N "multi-branch" edges (e.g., 자전거/도보/자동차) */
const getMultiBranchEdges = (nodeId: string, outMap: Record<string, Edge[]>): Edge[] => {
  const outEdges = outMap[nodeId] || [];
  const yEdge = outEdges.find(e => e.label === "Y");
  const nEdge = outEdges.find(e => e.label === "N");
  const unlabeled = outEdges.filter(e => !e.label || e.label === "");
  
  // If there's at least one Y/N label, it's a decision node
  if (yEdge || nEdge) return [];
  
  // If there's only one unlabeled edge, it's a simple sequential flow
  if (unlabeled.length <= 1) return [];
  
  // Multiple unlabeled edges = multi-branch (e.g., transportation modes)
  return unlabeled;
};

// ===========================
// MAIN LAYOUT ENGINE
// ===========================
export const getLayoutedElements = async (
  nodes: Node[],
  edges: Edge[],
  direction = "TB",
) => {
  const isHorizontal = direction === "LR";
  
  // Build adjacency
  const outMap: Record<string, Edge[]> = {};
  edges.forEach(e => {
    if (!outMap[e.source]) outMap[e.source] = [];
    outMap[e.source].push(e);
  });

  // Dimension lookup
  const dims: Record<string, { width: number; height: number }> = {};
  nodes.forEach(n => { dims[n.id] = getNodeSize(n.type); });

  // Position storage & collision grid
  const positions: Record<string, { x: number; y: number }> = {};
  const occupied: OccupiedRect[] = [];
  const visited = new Set<string>();

  /**
   * Place a node at (x, y) and register it in the collision grid.
   * Returns the resolved position after any collision adjustments.
   */
  const placeNode = (nodeId: string, x: number, y: number, pushAxis: "x" | "y" = "x"): { x: number; y: number } => {
    const { width: w, height: h } = dims[nodeId];
    
    // Resolve collisions by pushing along the specified axis
    let attempts = 0;
    while (checkCollision(x, y, w, h, occupied) && attempts < 50) {
      if (pushAxis === "x") x += BRANCH_GAP;
      else y += MAIN_GAP;
      attempts++;
    }
    
    positions[nodeId] = { x, y };
    occupied.push({ x, y, w, h, nodeId });
    return { x, y };
  };

  /**
   * Recursively layout a node and its children.
   * 
   * Key rules:
   * 1. Y-branch (main flow): continues along main axis (↓ in TB, → in LR)
   * 2. N-branch (exception): offset along secondary axis (→ in TB, ↓ in LR)
   * 3. Multi-branch (자전거/도보/자동차): fan out symmetrically on secondary axis
   * 4. Collision detection prevents overlap when branches merge
   */
  const layoutNode = (nodeId: string, x: number, y: number) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const { width: nw, height: nh } = dims[nodeId];
    const pos = placeNode(nodeId, x, y, isHorizontal ? "y" : "x");
    
    const outEdges = outMap[nodeId] || [];
    const unvisitedEdges = outEdges.filter(e => !visited.has(e.target));
    if (unvisitedEdges.length === 0) return;

    // Classify edges
    const mainEdge = getMainEdge(nodeId, outMap);
    const nEdge = getNEdge(nodeId, outMap);
    const multiBranch = getMultiBranchEdges(nodeId, outMap);

    if (multiBranch.length > 0) {
      // ===== MULTI-BRANCH (e.g., 3-way split) =====
      // Center the branches relative to the parent
      const validBranches = multiBranch.filter(e => !visited.has(e.target));
      const count = validBranches.length;
      
      if (isHorizontal) {
        const nextX = pos.x + nw + BRANCH_GAP;
        const totalHeight = count * nh + (count - 1) * (MAIN_GAP * 0.6);
        const startY = pos.y + nh / 2 - totalHeight / 2;
        
        validBranches.forEach((e, i) => {
          const childY = startY + i * (nh + MAIN_GAP * 0.6);
          layoutNode(e.target, nextX, childY);
        });
      } else {
        const nextY = pos.y + nh + MAIN_GAP;
        const totalWidth = count * nw + (count - 1) * (BRANCH_GAP * 0.75);
        const startX = pos.x + nw / 2 - totalWidth / 2;
        
        validBranches.forEach((e, i) => {
          const childX = startX + i * (nw + BRANCH_GAP * 0.75);
          layoutNode(e.target, childX, nextY);
        });
      }
    } else {
      // ===== DECISION BRANCH (Y/N) or SEQUENTIAL =====
      const hasDecision = !!(nEdge || (mainEdge && mainEdge.label === "Y"));
      const flowGap = hasDecision ? DECISION_MAIN_GAP : MAIN_GAP;
      const sideGap = hasDecision ? DECISION_BRANCH_GAP : BRANCH_GAP;
      
      // 1. Y-branch or single unlabeled: follows main axis
      const mainTarget = mainEdge && !visited.has(mainEdge.target) ? mainEdge.target : null;
      if (mainTarget) {
        if (isHorizontal) {
          layoutNode(mainTarget, pos.x + nw + flowGap, pos.y);
        } else {
          layoutNode(mainTarget, pos.x, pos.y + nh + flowGap);
        }
      }

      // 2. N-branch: offset to secondary axis, AWAY from main flow
      const nTarget = nEdge && !visited.has(nEdge.target) ? nEdge.target : null;
      if (nTarget) {
        if (isHorizontal) {
          // N goes DOWN in LR mode
          layoutNode(nTarget, pos.x, pos.y + nh + sideGap);
        } else {
          // N goes RIGHT in TB mode
          layoutNode(nTarget, pos.x + nw + sideGap, pos.y);
        }
      }

      // 3. Any remaining edges (labeled but not Y/N)
      const handledIds = new Set([mainEdge?.target, nEdge?.target].filter(Boolean));
      const remaining = unvisitedEdges.filter(e => !handledIds.has(e.target) && !visited.has(e.target));
      
      remaining.forEach((e, i) => {
        if (isHorizontal) {
          layoutNode(e.target, pos.x + nw + MAIN_GAP, pos.y + (i + 1) * (nh + MAIN_GAP * 0.8));
        } else {
          layoutNode(e.target, pos.x + (i + 1) * (nw + BRANCH_GAP * 0.8), pos.y + nh + MAIN_GAP);
        }
      });
    }
  };

  // ===========================
  // Execute Layout
  // ===========================
  const startNodeIds = nodes
    .filter(n => !edges.some(e => e.target === n.id))
    .map(n => n.id);

  let globalOffset = 0;
  for (const startId of startNodeIds) {
    if (!visited.has(startId)) {
      layoutNode(startId, isHorizontal ? 0 : globalOffset, isHorizontal ? globalOffset : 0);
      
      // Calculate next tree offset
      const allX = Object.values(positions).map(p => p.x);
      const allY = Object.values(positions).map(p => p.y);
      if (isHorizontal) {
        globalOffset = Math.max(...allY) + BRANCH_GAP;
      } else {
        globalOffset = Math.max(...allX) + BRANCH_GAP;
      }
    }
  }

  // Handle orphans
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      layoutNode(n.id, isHorizontal ? 0 : globalOffset, isHorizontal ? globalOffset : 0);
      if (isHorizontal) globalOffset += BRANCH_GAP;
      else globalOffset += BRANCH_GAP;
    }
  });

  // ===========================
  // Build Final Nodes
  // ===========================
  const layoutedNodes = nodes.map(node => {
    const pos = positions[node.id] || { x: 0, y: 0 };
    const { width, height } = dims[node.id];
    return {
      ...node,
      position: pos,
      width,
      height,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    };
  });

  // ===========================
  // Smart Edge Handle Assignment
  // ===========================
  const finalEdges = edges.map(edge => {
    const src = layoutedNodes.find(n => n.id === edge.source);
    const tgt = layoutedNodes.find(n => n.id === edge.target);
    if (!src || !tgt) return edge;

    const sx = src.position.x, sy = src.position.y;
    const tx = tgt.position.x, ty = tgt.position.y;
    const sw = dims[edge.source]?.width || NODE_WIDTH;
    const sh = dims[edge.source]?.height || NODE_HEIGHT;

    let sourceHandle: string;
    let targetHandle: string;

    if (isHorizontal) {
      // LR: Main flow → right-source / left-target
      // N branch → bottom-source / top-target (goes down)
      if (ty > sy + sh) {
        // Target is significantly BELOW source → N-branch going down
        sourceHandle = "bottom-source";
        targetHandle = "top-target";
      } else if (ty < sy - 40) {
        // Target is ABOVE → return branch
        sourceHandle = "top-source";
        targetHandle = "bottom-target";
      } else {
        // Same level → main flow right
        sourceHandle = "right-source";
        targetHandle = "left-target";
      }
    } else {
      // TB: Main flow → bottom-source / top-target
      // N branch → right-source / left-target (goes right)
      if (tx > sx + sw) {
        // Target is significantly to the RIGHT → N-branch
        sourceHandle = "right-source";
        targetHandle = "left-target";
      } else if (tx < sx - 40) {
        // Target is to the LEFT → return/merge branch
        sourceHandle = "left-source";
        targetHandle = "right-target";
      } else {
        // Same column → main flow down
        sourceHandle = "bottom-source";
        targetHandle = "top-target";
      }
    }

    return { ...edge, sourceHandle, targetHandle };
  });

  return { nodes: layoutedNodes, edges: finalEdges };
};









