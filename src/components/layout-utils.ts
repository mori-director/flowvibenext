import dagre from "dagre";
import { Node, Edge, Position } from "@xyflow/react";

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB",
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,  // horizontal gap between nodes in same rank
    ranksep: 80,  // vertical gap between ranks
    edgesep: 20,  // min separation between edges
  });

  nodes.forEach((node) => {
    const width = node.type === "decision" ? 160 : 150;
    const height = node.type === "decision" ? 80 : 50;
    dagreGraph.setNode(node.id, { width, height });
  });

  const newEdges = edges.map((edge) => {
    return { ...edge };
  });

  newEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const typeWidth = node.type === "decision" ? 160 : 150;
    const typeHeight = node.type === "decision" ? 80 : 50;
    const newNode = {
      ...node,
      width: typeWidth,
      height: typeHeight,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - typeWidth / 2,
        y: nodeWithPosition.y - typeHeight / 2,
      },
      style: { ...node.style, opacity: 1 },
    };
    return newNode;
  });

  // Build a map: sourceId -> list of outgoing edges from that node
  const outgoingMap: Record<string, typeof newEdges> = {};
  newEdges.forEach((edge) => {
    if (!outgoingMap[edge.source]) outgoingMap[edge.source] = [];
    outgoingMap[edge.source].push(edge);
  });

  // Calculate dynamic handles AFTER positions are evaluated
  const finalEdges = newEdges.map((edge) => {
    const srcNode = newNodes.find((n) => n.id === edge.source);
    const tgtNode = newNodes.find((n) => n.id === edge.target);

    let sourceHandle = isHorizontal ? "right-source" : "bottom-source";
    let targetHandle = isHorizontal ? "left-target" : "top-target";

    if (srcNode && tgtNode) {
      const dx = tgtNode.position.x - srcNode.position.x;
      const dy = tgtNode.position.y - srcNode.position.y;

      if (isHorizontal) {
        sourceHandle = "right-source";
        targetHandle = "left-target";
      } else {
        // Default: top to bottom
        sourceHandle = "bottom-source";
        targetHandle = "top-target";

        // Check if this source has multiple outgoing edges (branching)
        const siblings = outgoingMap[edge.source] || [];
        if (siblings.length >= 2) {
          // 타겟 노드의 위치를 기준으로 좌/우/아래 방향 결정
          if (dx < -10) {
            // 타겟이 왼쪽에 있으면 → 왼쪽으로 분기
            sourceHandle = "left-source";
            targetHandle = "top-target";
          } else if (dx > 10) {
            // 타겟이 오른쪽에 있으면 → 오른쪽으로 분기
            sourceHandle = "right-source";
            targetHandle = "top-target";
          } else {
            // 타겟이 바로 아래에 있으면 → 아래쪽으로 이동 (메인 흐름)
            sourceHandle = "bottom-source";
            targetHandle = "top-target";
          }
        }

        // If target is ABOVE source (reverse flow), route via side handles
        if (dy < -20) {
          sourceHandle = "left-source";
          targetHandle = "left-target";
        }
      }
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });

  return { nodes: newNodes, edges: finalEdges };
};
