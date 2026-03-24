import React, { useState, useEffect } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";

const UniversalHandles = ({ topClass, className }: { topClass?: string, className: string }) => (
  <>
    <Handle type="target" position={Position.Top} id="top-target" className={topClass || className} />
    <Handle type="source" position={Position.Top} id="top-source" className={topClass || className} />
    <Handle type="target" position={Position.Bottom} id="bottom-target" className={className} />
    <Handle type="source" position={Position.Bottom} id="bottom-source" className={className} />
    <Handle type="target" position={Position.Left} id="left-target" className={className} />
    <Handle type="source" position={Position.Left} id="left-source" className={className} />
    <Handle type="target" position={Position.Right} id="right-target" className={className} />
    <Handle type="source" position={Position.Right} id="right-source" className={className} />
  </>
);

const EditableLabel = ({
  id,
  initialLabel,
  isColorWhite,
}: {
  id: string;
  initialLabel: string;
  isColorWhite?: boolean;
}) => {
  const { updateNodeData } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(initialLabel);

  // initialLabel prop이 변경되면 내부 state 동기화 (AI 수정 반영 시)
  useEffect(() => {
    setLabel(initialLabel);
  }, [initialLabel]);

  const onBlur = () => {
    setIsEditing(false);
    updateNodeData(id, { label });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onBlur();
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        className="nodrag text-center w-full px-1 py-0.5 rounded outline-blue-500 font-bold text-xs text-slate-900 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        style={{ zIndex: 100 }}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div
      className={`whitespace-pre-wrap select-none w-full h-full flex items-center justify-center absolute inset-0 z-10 px-2 py-1 ${isColorWhite ? "text-white" : "text-slate-800"}`}
      onDoubleClick={() => setIsEditing(true)}
      style={{ cursor: "text" }}
      title="더블클릭하여 수정"
    >
      {label}
    </div>
  );
};

const BaseNode = ({
  id,
  data,
  classes,
  isWhiteText,
}: {
  id: string;
  data: any;
  classes: string;
  isWhiteText?: boolean;
}) => (
  <div
    className={`relative px-4 py-2 flex items-center justify-center text-xs font-bold text-center shadow-sm min-w-[150px] min-h-[50px] ${classes}`}
  >
    <UniversalHandles className="!bg-slate-300 w-2 h-2" />
    <EditableLabel
      id={id}
      initialLabel={data.label}
      isColorWhite={isWhiteText}
    />
  </div>
);

export const StartEndNode = ({ id, data }: any) => (
  <BaseNode
    id={id}
    data={data}
    classes="bg-slate-800 !text-white border-2 border-slate-900 rounded-full"
    isWhiteText={true}
  />
);

export const ProcessNode = ({ id, data }: any) => (
  <div
    className={`relative px-4 py-2 flex items-center justify-center text-xs font-bold text-center shadow-sm min-w-[150px] min-h-[50px] bg-white border-2 border-blue-500 rounded-lg`}
  >
    <UniversalHandles className="!bg-blue-400 w-2 h-2" />
    <EditableLabel id={id} initialLabel={data.label} />
  </div>
);

export const DecisionNode = ({ id, data }: any) => (
  <div className="relative flex items-center justify-center text-xs font-bold text-center w-[160px] h-[80px]">
    <svg
      viewBox="0 0 160 80"
      className="absolute inset-0 w-full h-full drop-shadow-sm overflow-visible"
    >
      <polygon
        points="80,0 160,40 80,80 0,40"
        fill="#FFF9C4"
        stroke="#FBC02D"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      ></polygon>
    </svg>
    <div className="relative z-10 w-full h-full flex items-center justify-center px-6">
      <EditableLabel id={id} initialLabel={data.label} />
    </div>
    <UniversalHandles className="!bg-yellow-500 w-2 h-2" />
  </div>
);

export const DatabaseNode = ({ id, data }: any) => (
  <div className="relative px-4 py-3 pb-2 flex items-center justify-center text-xs font-bold text-center bg-[#E8F5E9] border-2 border-[#4CAF50] shadow-sm rounded-t-xl rounded-b-xl min-w-[150px] min-h-[50px]">
    <div className="absolute top-0 left-[-2px] right-[-2px] h-3 border-b-2 border-inherit rounded-[50%] bg-[#E8F5E9] -mt-[6px]"></div>
    <UniversalHandles topClass="!bg-green-500 w-2 h-2 -mt-2" className="!bg-green-500 w-2 h-2" />
    <EditableLabel id={id} initialLabel={data.label} />
  </div>
);

export const ExternalNode = ({ id, data }: any) => (
  <BaseNode
    id={id}
    data={data}
    classes="bg-[#FFEBEE] text-[#D32F2F] border-2 border-[#D32F2F] rounded-lg border-dashed"
  />
);

export const ScreenNode = ({ id, data }: any) => (
  <div
    className={`relative px-4 py-2 flex items-center justify-center text-xs font-bold text-center shadow-sm min-w-[150px] min-h-[60px] bg-white border-2 border-slate-800 rounded-xl`}
  >
    <UniversalHandles className="!bg-slate-600 w-2 h-2" />
    <EditableLabel id={id} initialLabel={data.label} />
  </div>
);

export const ActionNode = ({ id, data }: any) => (
  <div
    className={`relative px-6 py-2 flex items-center justify-center text-xs font-black text-center shadow-md min-w-[120px] min-h-[40px] bg-blue-100 text-blue-700 border-2 border-blue-500 rounded-full`}
  >
    <UniversalHandles className="!bg-blue-600 w-2 h-2" />
    <EditableLabel id={id} initialLabel={data.label} />
  </div>
);

export const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
  database: DatabaseNode,
  external: ExternalNode,
  screen: ScreenNode,
  action: ActionNode,
};
