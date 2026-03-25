import React, { useState } from "react";
import {
  Settings,
  ArrowLeft,
  Eye,
  Code,
  Info,
  Sparkles,
  RefreshCw,
  Edit3,
  Layers,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  FileText,
  Copy,
  Download,
  Database,
  Monitor,
  Save,
  History as HistoryIcon,
  Plus,
  PlusSquare,
  ListTree,
  ArrowRight,
} from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";
import FlowEditor from "./components/FlowEditor";
import HistoryList, { HistoryItem } from "./components/HistoryList";
import HistoryPreviewModal from "./components/HistoryPreviewModal";
import ProjectDashboard from "./components/ProjectDashboard";
import Sidebar from "./components/Sidebar";
import { Project, MenuItem, LegacyHistoryItem } from "./types";
import { exportPPT, exportFigma } from "./utils/exportUtils";
import "@xyflow/react/dist/style.css";

export default function App() {
  const [step, setStep] = useState(0); // 0: 프로젝트 리스트, 1: 입력, 2: 구조화, 3: 시각화
  const [viewMode, setViewMode] = useState<"editor" | "history">("editor");
  const [loading, setLoading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Projects & Menus State
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem("flowcraft_projects");
    if (saved) return JSON.parse(saved);

    // Migration from legacy history
    const legacySaved = localStorage.getItem("flowcraft_history");
    if (legacySaved) {
      const legacyHistory: LegacyHistoryItem[] = JSON.parse(legacySaved);
      const legacyProject: Project = {
        id: "legacy-archive",
        name: "Legacy Archive",
        domain: "미분류",
        customDomain: "",
        channel: "Web",
        createdAt: Date.now(),
        menus: legacyHistory.map((item, idx) => ({
          id: item.id || `legacy-${idx}`,
          name: item.flowName || `Flow ${idx + 1}`,
          depth: 1,
          flowData: {
            flowName: item.flowName,
            flowDesc: item.flowDesc || "",
            policy: item.policy || "",
            nodes: item.nodes || [],
            edges: item.edges || [],
            structuredPlan: item.analysis || [],
            jsonCode: item.jsonCode || "",
            layoutDirection: (item as any).layoutDirection || "TB",
            step: 3
          }
        }))
      };
      return [legacyProject];
    }
    return [];
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const activeMenu = selectedProject?.menus.find(m => m.id === activeMenuId);

  // UI States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);
  const [isJsonHidden, setIsJsonHidden] = useState(true);

  // Current Working States (Mapped to active menu's flowData)
  const [info, setInfo] = useState({
    domain: "",
    customDomain: "",
    serviceName: "",
    flowName: "",
    flowDesc: "",
    serviceType: "",
    policy: "",
    includeExceptions: true,
  });

  const [flowNodes, setFlowNodes] = useState<any[]>([]);
  const [flowEdges, setFlowEdges] = useState<any[]>([]);
  const [jsonCode, setJsonCode] = useState("");
  const [structuredPlan, setStructuredPlan] = useState<any[]>([]);
  const [layoutDirection, setLayoutDirection] = useState("TB");

  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // Sync state when activeMenu changes
  React.useEffect(() => {
    if (activeMenu?.flowData) {
      const fd = activeMenu.flowData;
      setInfo({
        domain: selectedProject?.domain || "",
        customDomain: selectedProject?.customDomain || "",
        serviceName: selectedProject?.name || "",
        flowName: fd.flowName,
        flowDesc: fd.flowDesc,
        serviceType: selectedProject?.channel || "",
        policy: fd.policy,
        includeExceptions: true,
      });
      setFlowNodes(fd.nodes);
      setFlowEdges(fd.edges);
      setJsonCode(fd.jsonCode);
      setStructuredPlan(fd.structuredPlan);
      setLayoutDirection(fd.layoutDirection);
      setStep(fd.step || 1);
    } else if (activeMenu) {
      // New Menu Item
      setInfo({
        domain: selectedProject?.domain || "",
        customDomain: selectedProject?.customDomain || "",
        serviceName: selectedProject?.name || "",
        flowName: activeMenu.name,
        flowDesc: "",
        serviceType: selectedProject?.channel || "",
        policy: "",
        includeExceptions: true,
      });
      setFlowNodes([]);
      setFlowEdges([]);
      setJsonCode("");
      setStructuredPlan([]);
      setLayoutDirection("TB");
      setStep(1);
    }
  }, [activeMenuId, selectedProjectId]);

  // Sync back to projects state
  const syncCurrentDataToMenu = () => {
    if (!selectedProjectId || !activeMenuId) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProjectId) return p;
      return {
        ...p,
        menus: p.menus.map(m => {
          if (m.id !== activeMenuId) return m;
          return {
            ...m,
            flowData: {
              flowName: info.flowName,
              flowDesc: info.flowDesc,
              policy: info.policy,
              nodes: flowNodes,
              edges: flowEdges,
              structuredPlan,
              jsonCode,
              layoutDirection,
              step
            }
          };
        })
      };
    }));
  };

  React.useEffect(() => {
    localStorage.setItem("flowcraft_projects", JSON.stringify(projects));
  }, [projects]);

  // --- 비즈니스 로직 함수 ---

  const handleInfoChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setInfo((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const generateAutoDescription = async () => {
    if (!info.serviceName || !info.flowName || !info.serviceType) {
      setError(
        "자동 생성을 위해 SERVICE NAME, Flow Name, Channel을 모두 입력해주세요.",
      );
      return;
    }

    setIsGeneratingDesc(true);
    setError(null);

    const systemPrompt = `당신은 현업에서 활동하는 시니어 IT 서비스 기획자입니다. 
사용자가 입력한 '서비스 명', '흐름 명', '산업군(Domain)', '플랫폼(Channel)' 정보를 바탕으로, 해당 프로세스의 '상세 설명'과 '참고 정책 및 규칙'을 가장 전문적인 수준으로 추론하여 작성해주세요.

[필수 지침: 작성 기준]
1. 행 구분(줄바꿈): "Reference Policies & Rules" (policy 필드) 뿐만 아니라 "간편정보입력" (flowDesc 필드)에서도 각 주제나 순서가 넘어갈 때 반드시 줄바꿈(엔터) 처리하여 가독성을 높여주십시오. 단, flowDesc 필드의 내용은 기존처럼 '전체 서머리'와 '프로세스 순서'를 표기하는 방식을 동일하게 유지해야 합니다 (엔터 처리만 추가).
2. 링크 첨부: 기획자(사용자)가 직접 원문 내용을 확인할 수 있도록 각 항목의 끝에 관련된 공식 가이드라인/법령의 명확한 **URL 주소**를 텍스트 형태로 반드시 기술하십시오. (형식: "(참고자료: URL)")
3. 앱(App) 환경의 추가 규칙: 만약 사용자의 Channel(플랫폼) 정보가 'App'이거나 '모바일'일 경우, 애플(Apple)과 구글(Android)의 최신 앱 심사 지침을 최우선으로 검토하고 현행화된 정책을 제시하십시오.
   - 예시 판단 로직: 소셜 로그인을 제공하는 흐름이라면, Apple App Store 심사 지침 4.8 위반 여부 확인 코멘트 및 'Sign in with Apple' 필수 제공 안내 등.
4. 이벤트(Event) 환경의 추가 규칙: 만약 Channel 정보가 'Event'일 경우, 단순 화면 흐름을 넘어 출석체크, 결제 연동 이벤트, 외부 채널(SNS 등) 참여 유도 등 마케팅/프로모션 목적의 프로세스 및 관련 컴플라이언스(경품, 개인정보 제공 동의, 어뷰징 방지 등)를 반드시 고려하여 작성하십시오.`;

    const userPrompt = `
SERVICE NAME: ${info.serviceName}
Flow Name: ${info.flowName}
Channel: ${info.serviceType}
Domain: ${info.domain === "직접입력" ? info.customDomain : info.domain}

위 정보를 바탕으로 flowDesc(프로세스 상세 설명)와 policy(참고 정책 및 규칙)을 JSON으로 반환해주세요.
flowDesc에는 프로세스의 전체 서머리와 단계별 순서를, policy에는 관련 법령/지침과 출처 URL을 포함해주세요.`;

    try {
      const ai = new GoogleGenAI({
        apiKey: (import.meta.env.VITE_GEMINI_API_KEY || "").trim(),
      });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flowDesc: { type: Type.STRING },
              policy: { type: Type.STRING },
            },
            required: ["flowDesc", "policy"],
          },
        },
      });

      const result = JSON.parse(response.text || "{}");
      setInfo((prev) => ({
        ...prev,
        flowDesc: result.flowDesc || "",
        policy: result.policy || "",
      }));
    } catch (err: any) {
      setError("AI 자동 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const generateInitialFlow = async () => {
    setLoading(true);
    setError(null);

    const systemPrompt = `당신은 최고 수준의 IT 서비스 기획자이며 다이어그램 설계 전문가입니다.
사용자가 입력한 서비스 정보를 바탕으로 업무 구조화 리포트(analysis)와 다이어그램 데이터(nodes, edges)를 생성하세요.

[analysis 작성 규칙]
- analysis는 JSON 배열로 작성합니다. 각 항목은 {tag, content, indent, screenId} 객체입니다.
- tag는 반드시 다음 8개 한글 값 중 하나: "프로세스명", "화면", "프로세스", "분기", "분기Y", "분기N", "DB", "일반"
- content는 순수 텍스트로 작성합니다. 마크다운, 대괄호 태그 등을 사용하지 마세요.
- indent는 0(최상위), 1(하위), 2(하위의 하위) 중 하나입니다.
- screenId는 tag가 '화면'일 때만 화면 ID를 부여 (예: "SCR-0100"), 그 외는 빈 문자열.
- "분기", "분기Y", "분기N" 항목의 indent는 해당 "화면"보다 1 이상 크게 설정하세요.

[nodes 작성 규칙]
- type은 반드시: startEnd, screen, action, process, decision, database 중 하나
- label은 한글로 작성
- Decision(분기) 노드에서 나가는 Edge의 label은 성공="Y", 실패="N"을 반드시 명시

[디테일 규칙]
- [컴포넌트 타입 명시] 화면 생성 시 텍스트 앞에 [Page], [Bottom Sheet], [Modal], [Toast], [Alert]를 명시하세요.
- [액션과 시스템 분리] 사용자 조작은 "[Action]", 시스템 검증은 "[System]"으로 명시하세요.
- [상태 및 예외 분기] 인증/권한 검증과 에러/타임아웃 예외 분기를 반드시 반영하세요.
- 새로 추론하여 추가한 노드명/설명 끝에는 애스터리스크(*)를 붙이세요.`;
    const userPrompt = `입력된 서비스 기획 정보를 바탕으로 프로세스를 구조화하고 JSON 다이어그램 데이터를 생성해줘.
서비스명: ${info.serviceName}
흐름명: ${info.flowName}
채널: ${info.serviceType}
도메인: ${info.domain === "직접입력" ? info.customDomain : info.domain}
설명: ${info.flowDesc}
정책: ${info.policy}`;

    try {
      const ai = new GoogleGenAI({
        apiKey: (import.meta.env.VITE_GEMINI_API_KEY || "").trim(),
      });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tag: {
                      type: Type.STRING,
                      description: "항목 유형. 반드시 다음 한글 값 중 하나: 프로세스명, 화면, 프로세스, 분기, 분기Y, 분기N, DB, 일반",
                    },
                    content: {
                      type: Type.STRING,
                      description: "해당 항목의 설명 텍스트 (순수 텍스트, 마크다운 금지)",
                    },
                    indent: {
                      type: Type.INTEGER,
                      description: "들여쓰기 레벨 (0=최상위, 1=하위, 2=하위의하위)",
                    },
                    screenId: {
                      type: Type.STRING,
                      description: "화면 ID (tag가 '화면'일 때만 필수, 예: SCR-0100. 그 외는 빈 문자열)",
                    },
                  },
                  required: ["tag", "content", "indent"],
                },
              },
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "노드 고유 ID (edges에서 source/target으로 참조)" },
                    label: { type: Type.STRING, description: "노드에 표시될 한글 레이블 (필수)" },
                    type: { type: Type.STRING, description: "startEnd, screen, action, process, decision, database 중 하나" },
                  },
                  required: ["id", "label", "type"],
                },
              },
              edges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "엣지 고유 ID" },
                    source: { type: Type.STRING, description: "출발 노드의 id" },
                    target: { type: Type.STRING, description: "도착 노드의 id" },
                    label: { type: Type.STRING, description: "분기 Y/N 또는 빈 문자열" },
                  },
                  required: ["id", "source", "target"],
                },
              },
            },
            required: ["analysis", "nodes", "edges"],
          },
        },
      });

      const text = response.text || "{}";
      const result = JSON.parse(text);

      setStructuredPlan((result.analysis || []).filter((a: any) => a && a.content));
      if (result.layoutDirection) setLayoutDirection(result.layoutDirection);

      const generatedNodes = (result.nodes || []).map((n: any) => ({
        id: String(n.id),
        type: n.type,
        data: { label: n.label },
      }));
      const generatedEdges = (result.edges || []).map((e: any, idx: number) => {
        let sourceId = String(e.source || e.from || e.start || "");
        let targetId = String(e.target || e.to || e.end || "");

        const sNode =
          generatedNodes.find((n: any) => n.id === sourceId) ||
          generatedNodes.find((n: any) => n.data.label === sourceId);
        if (sNode) sourceId = sNode.id;

        const tNode =
          generatedNodes.find((n: any) => n.id === targetId) ||
          generatedNodes.find((n: any) => n.data.label === targetId);
        if (tNode) targetId = tNode.id;

        return {
          id: e.id ? String(e.id) : `e-${idx}`,
          source: sourceId,
          target: targetId,
          label: e.label || "",
        };
      });

      setJsonCode(
        JSON.stringify(
          {
            analysis: result.analysis || [],
            nodes: generatedNodes.map((n: any) => ({
              id: n.id,
              type: n.type,
              label: n.data.label,
            })),
            edges: generatedEdges,
            layoutDirection: "TB",
          },
          null,
          2,
        ),
      );

      setFlowNodes(generatedNodes);
      setFlowEdges(generatedEdges);
      setStep(2);
    } catch (err: any) {
      setError("AI 분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const refineFlow = async () => {
    if (!refinePrompt.trim()) return;
    setIsRefining(true);
    setError(null);

    const systemPrompt = `당신은 화면설계서를 작성하는 시니어 기획자입니다.
사용자의 추가 요청사항을 반영하여 기존 JSON 다이어그램 데이터를 수정하십시오.
기존과 동일한 JSON 모델 포맷을 반환하되, '추가 요청사항'에 따라 노드와 엣지를 변경 또는 추가한 "전체" JSON 코드를 보내주세요.
Edge 객체 생성 시 반드시 'source'와 'target'을 키로 사용하여 노드의 'id'를 참조하여 연결하세요.
추가된 노드를 포함하여 모든 노드는 고립되지 않도록 반드시 edge로 연결해야 합니다.
Decision(분기) 노드에서 뻗어나가는 참(성공) 방향 선(Edge)의 'label' Key 값으로 "Y", 거짓(실패/예외) 방향 선(Edge)의 'label' Key 값으로 "N"을 반드시 명시하세요.
**[핵심]** analysis(업무 구조화 리포트)에서 서술한 모든 프로세스 단계의 순서 및 분기 흐름을 edges 배열에 1:1 대응시켜 표현하세요.

[analysis 작성 규칙]
- analysis는 JSON 배열로 작성합니다. 각 항목은 {tag, content, indent} 객체입니다.
- tag는 반드시 다음 8개 한글 값 중 하나: "프로세스명", "화면", "프로세스", "분기", "분기Y", "분기N", "DB", "일반"
- content는 순수 텍스트로 작성합니다. 마크다운, 대괄호 태그 등을 사용하지 마세요.
- indent는 0(최상위), 1(하위), 2(하위의 하위) 중 하나입니다.
- "분기", "분기Y", "분기N" 항목의 indent는 해당 "화면"보다 1 이상 크게 설정하세요.`;
    const userPrompt = `
[기존 다이아그램 코드]
${jsonCode}

[추가 요청사항]
${refinePrompt}

위 추가 요청사항을 반영하여 완전히 수정된 새 JSON 구조체를 반환해줘.`;

    try {
      const ai = new GoogleGenAI({
        apiKey: (import.meta.env.VITE_GEMINI_API_KEY || "").trim(),
      });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const result = JSON.parse(text);

      setStructuredPlan((result.analysis || []).filter((a: any) => a && a.content));

      const generatedNodes = (result.nodes || []).map((n: any) => ({
        id: String(n.id),
        type: n.type,
        data: { label: n.label },
      }));
      const generatedEdges = (result.edges || []).map((e: any, idx: number) => {
        let sourceId = String(e.source || e.from || e.start || "");
        let targetId = String(e.target || e.to || e.end || "");

        const sNode =
          generatedNodes.find((n: any) => n.id === sourceId) ||
          generatedNodes.find((n: any) => n.data.label === sourceId);
        if (sNode) sourceId = sNode.id;

        const tNode =
          generatedNodes.find((n: any) => n.id === targetId) ||
          generatedNodes.find((n: any) => n.data.label === targetId);
        if (tNode) targetId = tNode.id;

        return {
          id: e.id ? String(e.id) : `e-${idx}`,
          source: sourceId,
          target: targetId,
          label: e.label || "",
        };
      });

      setJsonCode(
        JSON.stringify(
          {
            analysis: result.analysis || [],
            nodes: generatedNodes.map((n: any) => ({
              id: n.id,
              type: n.type,
              label: n.data.label,
            })),
            edges: generatedEdges,
            layoutDirection: layoutDirection,
          },
          null,
          2,
        ),
      );

      setFlowNodes(generatedNodes);
      setFlowEdges(generatedEdges);
      setRefinePrompt("");
      if (step === 2) setStep(3);
    } catch (err: any) {
      setError("AI 수정 중 오류가 발생했습니다.");
    } finally {
      setIsRefining(false);
    }
  };

  const saveToHistory = () => {
    syncCurrentDataToMenu();
    alert("현재 메뉴의 기획 정보가 저장되었습니다.");
  };

  const handleCreateProject = (name: string, domain: string, customDomain: string, channel: string) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      domain,
      customDomain,
      channel,
      createdAt: Date.now(),
      menus: []
    };
    setProjects([newProject, ...projects]);
  };

  const handleDeleteProject = (id: string) => {
    if (!window.confirm("프로젝트를 삭제하시겠습니까? 관련 메뉴 정보가 모두 삭제됩니다.")) return;
    setProjects(projects.filter(p => p.id !== id));
  };

  const handleAddMenu = (name: string, parentId?: string) => {
    if (!selectedProjectId) return;
    const newMenu: MenuItem = {
      id: Date.now().toString(),
      name,
      depth: parentId ? 2 : 1,
      parentId
    };
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProjectId) return p;
      return { ...p, menus: [...p.menus, newMenu] };
    }));
    setActiveMenuId(newMenu.id);
  };

  const handleDeleteMenu = (id: string) => {
    if (!window.confirm("메뉴를 삭제하시겠습니까?")) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProjectId) return p;
      return { ...p, menus: p.menus.filter(m => m.id !== id && m.parentId !== id) };
    }));
    if (activeMenuId === id) setActiveMenuId(null);
  };

  const deleteFromHistory = (id: string) => {
    // Legacy support or project deletion
    handleDeleteProject(id);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setInfo(item.info);
    setJsonCode(item.jsonCode);
    setStructuredPlan(item.analysis);
    setLayoutDirection(item.layoutDirection || "TB");
    
    try {
      const parsed = JSON.parse(item.jsonCode);
      setFlowNodes(parsed.nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        data: { label: n.label || n.data?.label }
      })));
      setFlowEdges(parsed.edges);
    } catch (e) {
      console.error(e);
    }

    setStep(3);
    setViewMode("editor");
    setIsPreviewOpen(false);
  };

  const downloadExport = async (type: "Figma" | "PPT") => {
    const flowData = (window as any).__flowState || { nodes: flowNodes, edges: flowEdges };
    if (type === "PPT") {
      await exportPPT(flowData.nodes, flowData.edges, info.flowName);
    } else {
      await exportFigma(flowData.nodes, flowData.edges, info.flowName, ".react-flow");
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col font-sans overflow-hidden text-slate-900 relative">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 flex-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setStep(0); setSelectedProjectId(null); setActiveMenuId(null); }}>
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-200"><Layers size={20} /></div>
            <div>
              <h1 className="font-black text-lg tracking-tighter">Flow<span className="text-blue-600">Craft</span></h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Planner Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedProject && (
              <div className="hidden md:flex flex-col items-end mr-4 border-r pr-4 border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedProject.domain} • {selectedProject.channel}</span>
                <span className="text-sm font-black text-slate-700">{selectedProject.name}</span>
              </div>
            )}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button onClick={() => setViewMode("editor")} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "editor" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Plus size={14} />Editor</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden w-full flex h-full relative">
        {step === 0 ? (
          <ProjectDashboard 
            projects={projects} 
            onSelectProject={(id) => { setSelectedProjectId(id); setStep(1); }}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
          />
        ) : (
          <div className="flex flex-1 overflow-hidden h-full w-full">
            <Sidebar 
              projectName={selectedProject?.name || ""}
              menus={selectedProject?.menus || []}
              activeMenuId={activeMenuId}
              onSelectMenu={setActiveMenuId}
              onAddMenu={handleAddMenu}
              onDeleteMenu={handleDeleteMenu}
            />
            
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden h-full relative">
              {!activeMenuId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <ListTree size={48} className="mb-4 opacity-20" />
                  <p className="font-bold text-lg">왼쪽 메뉴에서 설계할 업무를 선택하거나 추가하세요.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden h-full">
                  {step === 1 && (
                    <div className="h-full max-w-5xl mx-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full overflow-hidden">
                      <header className="text-center space-y-1 flex-none">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">서비스 프로세스 설계</h2>
                        <p className="text-slate-500 text-sm">기존 프로젝트 정보가 상속되었습니다. 프로세스 정보를 입력하세요.</p>
                      </header>
                      <div className="flex-1 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
                        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6 custom-scrollbar">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">DOMAIN / INDUSTRY</label>
                              <div className="flex flex-wrap gap-1.5">
                                {["금융", "커머스", "공공", "통신", "제조", "헬스케어", "직접입력"].map((type) => (
                                  <button key={type} disabled className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${info.domain === type ? "bg-slate-900 text-white shadow-md" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}>{type}</button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Channel</label>
                              <div className="flex flex-wrap gap-1.5">
                                {["Web", "App", "Admin", "Kiosk", "Event"].map((type) => (
                                  <button key={type} disabled className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${info.serviceType === type ? "bg-slate-900 text-white shadow-md" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}>{type}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SERVICE NAME</label>
                              <input disabled value={info.serviceName} className="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 outline-none font-semibold text-sm cursor-not-allowed" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Flow Name</label>
                              <input name="flowName" value={info.flowName} onChange={handleInfoChange} placeholder="예: 간편 본인인증 및 회원가입 흐름" className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm" />
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col min-h-[120px]">
                            <div className="flex items-center justify-between mb-1.5 flex-none">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">간편정보입력 (Process Description)</label>
                              <button onClick={generateAutoDescription} disabled={isGeneratingDesc || !info.serviceName || !info.flowName} className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-slate-100 disabled:text-slate-400 flex items-center gap-1.5 transition-all rounded-lg text-xs font-black shadow-sm" title="AI가 내용을 자동 완성합니다.">
                                {isGeneratingDesc ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />} AI 자동 작성
                              </button>
                            </div>
                            <textarea name="flowDesc" value={info.flowDesc} onChange={handleInfoChange} placeholder="프로세스의 주요 단계와 목적을 자유롭게 기술하세요." className="w-full flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-semibold text-sm" />
                          </div>
                          <div className="flex-1 flex flex-col min-h-[120px]">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2 flex-none"><Info size={12} /> Reference Policies & Rules</label>
                            <textarea name="policy" value={info.policy} onChange={handleInfoChange} placeholder="참고할 법령, 서비스 정책 등을 입력하세요." className="w-full flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-semibold text-sm" />
                          </div>
                        </div>
                        {error && (
                          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-start gap-2 border border-red-100 flex-none">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <div>{error}</div>
                          </div>
                        )}
                        <button onClick={generateInitialFlow} disabled={loading || !info.serviceName.trim() || !info.flowName.trim() || !info.flowDesc.trim()} className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-lg shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 flex-none">
                          {loading ? <RefreshCw className="animate-spin" /> : <Eye />}
                          {loading ? "AI 분석 및 설계 중..." : "✨ 프로세스 분석 시작"}
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-8 duration-500 overflow-hidden w-full h-full">
                      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-none">
                        <div>
                          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><CheckCircle className="text-green-500" /> 분석 및 구조화 완료</h2>
                          <p className="text-slate-500 text-sm mt-1">AI가 도출한 업무 플로우와 코드를 검토하세요.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setIsJsonHidden(!isJsonHidden)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${!isJsonHidden ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                            <Code size={14} /> JSON {isJsonHidden ? "보기" : "숨기기"}
                          </button>
                          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button onClick={() => setLayoutDirection("TB")} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${layoutDirection === "TB" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>세로</button>
                            <button onClick={() => setLayoutDirection("LR")} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${layoutDirection === "LR" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>가로</button>
                          </div>
                          <button onClick={() => setStep(3)} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 text-sm">최종 시각화 <ChevronRight size={18} /></button>
                        </div>
                      </header>
                      <div className="flex gap-4 flex-1 min-h-0 h-full overflow-hidden">
                        <div className={`bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col overflow-hidden h-full transition-all duration-500 ${isJsonHidden ? "flex-1" : "w-1/2"}`}>
                          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-none">
                            <h3 className="font-black text-slate-900 text-xs flex items-center gap-2"><FileText size={14} className="text-blue-600" /> 업무 구조화 리포트</h3>
                            <button onClick={() => setStep(1)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"><ArrowLeft size={14} /></button>
                          </div>
                          <div className="flex-1 h-full w-full p-6 text-sm text-slate-600 leading-relaxed font-medium bg-transparent overflow-y-auto custom-scrollbar">
                            {structuredPlan && structuredPlan.length > 0 ? (
                              structuredPlan.map((item: any, i: number) => {
                                const marginLeft = (item.indent || 0) * 20;
                                const text = item.content || "";
                                switch (item.tag) {
                                  case "프로세스명": return (<div key={i} className="text-lg font-black text-slate-800 mt-6 mb-3 flex items-center gap-2 border-b border-slate-200 pb-2"><Layers size={18} className="text-indigo-600" /><span>{text}</span></div>);
                                  case "화면": return (<div key={i} className="text-[15px] font-bold text-blue-600 mt-4 mb-2 flex items-center gap-2" style={{ marginLeft }}><Monitor size={15} className="text-blue-500 shrink-0" /><span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded mr-1 leading-none">{item.screenId || "SCR-0000"}</span><span>{text}</span></div>);
                                  case "프로세스": return (<div key={i} className="text-[15px] font-bold text-emerald-600 mt-4 mb-2 flex items-center gap-2" style={{ marginLeft }}><div className="w-2 h-2 rounded bg-emerald-600 shrink-0" /><span>{text}</span></div>);
                                  case "DB": return (<div key={i} className="text-[15px] font-bold text-amber-600 mt-4 mb-2 flex items-center gap-2" style={{ marginLeft }}><Database size={15} className="text-amber-500 shrink-0" /><span>{text}</span></div>);
                                  case "분기": return (<div key={i} className="text-sm font-semibold text-purple-600 mb-1.5 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5" style={{ marginLeft: marginLeft + 12 }}><span className="text-purple-500 mt-0.5 font-bold">↳</span> <span>{text}</span></div>);
                                  case "분기Y": return (<div key={i} className="text-sm font-medium text-emerald-600 mb-1 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5" style={{ marginLeft: marginLeft + 12 }}><CheckCircle size={14} className="mt-0.5 shrink-0" /> <span>{text}</span></div>);
                                  case "분기N": return (<div key={i} className="text-sm font-medium text-rose-500 mb-1 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5" style={{ marginLeft: marginLeft + 12 }}><AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{text}</span></div>);
                                  default: return (<div key={i} className="text-sm text-slate-600 mb-1 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5" style={{ marginLeft: marginLeft + 12 }}><span className="text-slate-400 mt-0.5 mr-1">•</span><span>{text}</span></div>);
                                }
                              })
                            ) : (<div className="text-slate-400">분석 결과를 생성 중입니다...</div>)}
                          </div>
                        </div>
                        
                        {!isJsonHidden && (
                          <div className="w-1/2 bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4 duration-500">
                            <div className="p-3 border-b border-slate-800 flex justify-between items-center flex-none">
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Code size={12} className="text-emerald-400" /> JSON Data</h3>
                              <div className="flex gap-2">
                                <button onClick={() => navigator.clipboard.writeText(jsonCode)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400" title="코드 복사"><Copy size={14} /></button>
                                <button onClick={() => setIsJsonHidden(true)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-200"><ArrowRight size={14} /></button>
                              </div>
                            </div>
                            <textarea value={jsonCode} onChange={(e) => setJsonCode(e.target.value)} className="flex-1 h-full w-full p-6 font-mono text-[11px] text-emerald-400 bg-transparent outline-none resize-none leading-relaxed custom-scrollbar overflow-y-auto" spellCheck="false" />
                          </div>
                        )}
                      </div>
                      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-3 flex flex-col md:flex-row gap-3 items-center flex-none w-full">
                        <div className="flex-1 w-full relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500"><Settings size={18} /></div>
                          <input type="text" value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && refineFlow()} placeholder="추가 요청사항을 입력하세요 (예: 결제 프로세스 추가)" className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-medium text-xs" />
                        </div>
                        <button onClick={refineFlow} disabled={isRefining || !refinePrompt.trim()} className="w-full md:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap text-xs">
                          {isRefining ? (<RefreshCw className="animate-spin" size={16} />) : (<Edit3 size={16} />)} AI 수정 반영
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 overflow-hidden w-full h-full">
                      <div className="flex-1 bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30 flex-none">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200"><Eye size={24} /></div>
                            <div>
                              <h2 className="text-xl font-black text-slate-900 tracking-tighter leading-tight">{info.flowName}</h2>
                              <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] mt-0.5">{info.serviceName} • 캔버스 드래그 앤 드롭 편집 가능</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => setStep(2)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 text-xs shadow-sm"><ArrowLeft size={16} /> 이전</button>
                            <button onClick={saveToHistory} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"><Save size={16} /> 저장</button>
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden relative">
                          <FlowEditor initialNodes={flowNodes} initialEdges={flowEdges} layoutDirection={layoutDirection} onExportPPT={() => downloadExport("PPT")} onExportFigma={() => downloadExport("Figma")} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {previewItem && (
        <HistoryPreviewModal item={previewItem} isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} onVisualize={loadFromHistory} />
      )}

      {/* Background Decorator */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px]" />
      </div>
    </div>
  );
}
