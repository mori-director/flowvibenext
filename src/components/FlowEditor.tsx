import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  MarkerType,
  Connection,
  Edge,
  Node,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./CustomNodes";
import { getLayoutedElements } from "./layout-utils";
import {
  PlusSquare,
  Circle,
  Diamond,
  Database,
  Monitor,
  MousePointerClick,
  Download,
  CheckCircle,
  XCircle,
  Link2,
} from "lucide-react";

let id = 0;
const getId = () => `dndnode_${id++}`;

/** 엣지 라벨(Y/N)에 따른 스타일 반환 */
const getEdgeStyle = (label?: string) => {
  if (label === "Y") {
    return {
      style: { stroke: "#10b981", strokeWidth: 2.5 },
      labelStyle: { fill: "#065f46", fontWeight: 800, fontSize: 11 },
      labelBgStyle: {
        fill: "#d1fae5",
        fillOpacity: 0.95,
        rx: 6,
        ry: 6,
        stroke: "#10b981",
        strokeWidth: 1,
      },
      labelBgPadding: [6, 4] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
    };
  }
  if (label === "N") {
    return {
      style: { stroke: "#f43f5e", strokeWidth: 2.5 },
      labelStyle: { fill: "#9f1239", fontWeight: 800, fontSize: 11 },
      labelBgStyle: {
        fill: "#ffe4e6",
        fillOpacity: 0.95,
        rx: 6,
        ry: 6,
        stroke: "#f43f5e",
        strokeWidth: 1,
      },
      labelBgPadding: [6, 4] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#f43f5e" },
    };
  }
  return {
    style: { stroke: "#94a3b8", strokeWidth: 2 },
    labelStyle: { fill: "#334155", fontWeight: 700, fontSize: 10 },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.8, rx: 4, ry: 4 },
    labelBgPadding: [4, 4] as [number, number],
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
  };
};

export default function FlowEditor({
  initialNodes,
  initialEdges,
  onExportPPT,
  onExportFigma,
}: {
  initialNodes: any[];
  initialEdges: any[];
  onExportPPT: () => void;
  onExportFigma: () => void;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { initialLayoutedNodes, initialLayoutedEdges } = React.useMemo(() => {
    if (!initialNodes || initialNodes.length === 0)
      return { initialLayoutedNodes: [], initialLayoutedEdges: [] };

    const { nodes, edges } = getLayoutedElements(
      initialNodes.map((n) => ({ ...n, position: { x: 0, y: 0 } })),
      initialEdges.map((e) => {
        const edgeLabel = e.label || "";
        return {
          ...e,
          type: "smoothstep",
          ...getEdgeStyle(edgeLabel),
        };
      }),
    );
    return { initialLayoutedNodes: nodes, initialLayoutedEdges: edges };
  }, [initialNodes, initialEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayoutedEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // 분기 Y/N 선택 팝업 상태
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(
    null,
  );

  // Re-sync if initial nodes completely change without unmounting (edge-case fallback)
  useEffect(() => {
    setNodes(initialLayoutedNodes);
    setEdges(initialLayoutedEdges);
    if (reactFlowInstance) {
      setTimeout(
        () => reactFlowInstance.fitView({ duration: 800, padding: 0.2 }),
        50,
      );
    }
  }, [
    initialLayoutedNodes,
    initialLayoutedEdges,
    reactFlowInstance,
    setNodes,
    setEdges,
  ]);

  // --- A. 엣지 재연결 (드래그 앤 드롭) ---
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) =>
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds)),
    [setEdges],
  );

  // --- B. 연결 생성 (분기 노드면 Y/N 선택 팝업) ---
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);

      if (sourceNode?.type === "decision") {
        // decision 노드에서 연결 → Y/N 선택 팝업 표시
        setPendingConnection(params);
      } else {
        // 일반 노드 → 즉시 연결
        const defaultStyle = getEdgeStyle();
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              type: "smoothstep",
              ...defaultStyle,
            } as Edge,
            eds,
          ),
        );
      }
    },
    [setEdges, nodes],
  );

  // Y/N 선택 후 엣지 생성
  const createBranchEdge = useCallback(
    (label: string) => {
      if (!pendingConnection) return;

      const edgeStyles = getEdgeStyle(label);
      setEdges((eds) =>
        addEdge(
          {
            ...pendingConnection,
            type: "smoothstep",
            label: label || undefined,
            ...edgeStyles,
          } as Edge,
          eds,
        ),
      );
      setPendingConnection(null);
    },
    [pendingConnection, setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `새로운 ${type} 노드` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  return (
    <div className="dndflow flex w-full h-full bg-slate-50 relative overflow-hidden flex-col md:flex-row">
      {/* Sidebar Toolbar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-4 flex flex-col shadow-sm z-10">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
          도형 추가 (Drag & Drop)
        </h3>
        <div className="space-y-3">
          <div
            className="flex items-center gap-3 p-3 border-2 border-slate-800 bg-slate-800 text-white rounded-full cursor-grab hover:bg-slate-700 font-bold text-xs shadow-sm transition-all"
            onDragStart={(event: React.DragEvent) => {
              event.dataTransfer.setData("application/reactflow", "startEnd");
              event.dataTransfer.effectAllowed = "move";
            }}
            draggable
          >
            <Circle size={14} /> 시작 / 종료
          </div>
          <div
            className="flex items-center gap-3 p-3 border-2 border-slate-800 bg-white text-slate-800 rounded-xl cursor-grab hover:bg-slate-50 font-bold text-xs shadow-sm transition-all"
            onDragStart={(event: React.DragEvent) => {
              event.dataTransfer.setData("application/reactflow", "screen");
              event.dataTransfer.effectAllowed = "move";
            }}
            draggable
          >
            <Monitor size={14} /> 화면 (Screen)
          </div>
          <div
            className="flex items-center gap-3 p-3 border-2 border-blue-500 bg-blue-100 text-blue-700 rounded-full cursor-grab hover:bg-blue-200 font-black text-xs shadow-sm transition-all"
            onDragStart={(event: React.DragEvent) => {
              event.dataTransfer.setData("application/reactflow", "action");
              event.dataTransfer.effectAllowed = "move";
            }}
            draggable
          >
            <MousePointerClick size={14} /> 액션 (Action)
          </div>
          <div
            className="flex items-center gap-3 p-3 border-2 border-blue-500 bg-white text-slate-800 rounded-lg cursor-grab hover:bg-blue-50 font-bold text-xs shadow-sm transition-all"
            onDragStart={(event: React.DragEvent) => {
              event.dataTransfer.setData("application/reactflow", "process");
              event.dataTransfer.effectAllowed = "move";
            }}
            draggable
          >
            <PlusSquare size={14} className="text-blue-500" /> 일반 프로세스
          </div>
          <div
            className="flex items-center gap-3 p-3 border-2 border-[#FBC02D] bg-[#FFF9C4] text-slate-800 rounded-lg cursor-grab hover:bg-[#FFF59D] font-bold text-xs shadow-sm transition-all"
            onDragStart={(event: React.DragEvent) => {
              event.dataTransfer.setData("application/reactflow", "decision");
              event.dataTransfer.effectAllowed = "move";
            }}
            draggable
          >
            <Diamond size={14} className="text-[#FBC02D]" /> 분기 / 판단
          </div>
          <div
            className="flex items-center gap-3 p-3 border-2 border-[#4CAF50] bg-[#E8F5E9] text-slate-800 rounded-lg cursor-grab hover:bg-[#C8E6C9] font-bold text-xs shadow-sm transition-all"
            onDragStart={(event: React.DragEvent) => {
              event.dataTransfer.setData("application/reactflow", "database");
              event.dataTransfer.effectAllowed = "move";
            }}
            draggable
          >
            <Database size={14} className="text-[#4CAF50]" /> 데이터베이스
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            단축키 안내
          </h3>
          <ul className="text-[11px] text-slate-500 space-y-1">
            <li>
              • <b>노드 선택 후 Backspace</b>: 삭제
            </li>
            <li>
              • <b>노드 핸들(점) 드래그</b>: 선 연결
            </li>
            <li>
              • <b>엣지 끝점 드래그</b>: 연결 대상 변경
            </li>
            <li>
              • <b>선택 후 더블클릭</b>: 텍스트 수정
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable={true}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#FAFAFA]"
          >
            <Controls />
            <MiniMap zoomable pannable />
            <Background gap={20} size={1} />

            <Panel position="top-right" className="flex flex-col gap-2">
              <button
                onClick={() => {
                  (window as any).__flowState = { nodes, edges };
                  onExportPPT();
                }}
                className="px-4 py-2.5 bg-[#D04423] text-white rounded-xl font-black hover:bg-[#A8351A] transition-all flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-red-100 w-full"
              >
                <Download size={16} /> PPT 다운로드
              </button>
              <button
                onClick={() => {
                  (window as any).__flowState = { nodes, edges };
                  onExportFigma();
                }}
                className="px-4 py-2.5 bg-[#0ACF83] text-white rounded-xl font-black hover:bg-[#08a669] transition-all flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-green-100 w-full"
              >
                <Download size={16} /> Figma 다운로드 (SVG)
              </button>
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>

        {/* 분기(Decision) Y/N 선택 팝업 */}
        {pendingConnection && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(15, 23, 42, 0.3)" }}
            onClick={() => setPendingConnection(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-72 animate-in zoom-in-95 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-1">
                <Diamond size={16} className="text-[#FBC02D]" />
                <h4 className="font-black text-sm text-slate-800">
                  분기 방향 선택
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mb-5">
                Decision 노드에서 나가는 엣지의 라벨을 선택하세요.
              </p>
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => createBranchEdge("Y")}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-200"
                >
                  <CheckCircle size={16} /> Y (성공)
                </button>
                <button
                  onClick={() => createBranchEdge("N")}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-rose-200"
                >
                  <XCircle size={16} /> N (실패)
                </button>
              </div>
              <button
                onClick={() => createBranchEdge("")}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Link2 size={14} /> 라벨 없이 연결
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
