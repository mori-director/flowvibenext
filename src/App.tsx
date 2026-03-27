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
  Link,
  X
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
          depth: 1 as const,
          order: idx,
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
  
  // Custom Alert/Confirm State
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isConfirm?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const showAlert = (message: string, title = "알림") => {
    setAlertState({ isOpen: true, title, message });
  };

  const showConfirm = (message: string, onConfirm: () => void, title = "확인") => {
    setAlertState({ 
      isOpen: true, 
      title, 
      message, 
      isConfirm: true, 
      onConfirm: () => { onConfirm(); setAlertState(prev => ({ ...prev, isOpen: false })); },
      onCancel: () => setAlertState(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Current Working States (Mapped to active menu's flowData)
  const [info, setInfo] = useState({
    domain: "",
    customDomain: "",
    serviceName: "",
    flowName: "",
    flowDesc: "",
    serviceType: "",
    policy: "",
    referenceFlowIds: [] as string[],
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
    if (!activeMenuId || !selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    const activeMenu = project?.menus.find(m => m.id === activeMenuId);
    if (!activeMenu) return;

    let defaultDomain = project?.domain || "";
    let defaultCustomDomain = project?.customDomain || "";
    let defaultChannel = project?.channel || "";

    if (activeMenu.depth === 2 && activeMenu.parentId) {
      const parent = project?.menus.find(m => m.id === activeMenu.parentId);
      if (parent?.flowData) {
        defaultDomain = parent.flowData.domain || defaultDomain;
        defaultCustomDomain = parent.flowData.customDomain || defaultCustomDomain;
        defaultChannel = parent.flowData.channel || defaultChannel;
      }
    }

    if (activeMenu.flowData) {
      const fd = activeMenu.flowData;
      setInfo({
        domain: fd.domain || defaultDomain,
        customDomain: fd.customDomain || defaultCustomDomain,
        serviceName: project?.name || "",
        flowName: fd.flowName,
        flowDesc: fd.flowDesc,
        serviceType: fd.channel || defaultChannel,
        policy: fd.policy,
        referenceFlowIds: fd.referenceFlowIds || (fd.referenceFlowId ? [fd.referenceFlowId] : []),
        includeExceptions: true,
      });
      setFlowNodes(fd.nodes);
      setFlowEdges(fd.edges);
      setJsonCode(fd.jsonCode);
      setStructuredPlan(fd.structuredPlan);
      setLayoutDirection(fd.layoutDirection);
      setStep(fd.step || 1);
    } else {
      // New Menu Item
      setInfo({
        domain: defaultDomain,
        customDomain: defaultCustomDomain,
        serviceName: project?.name || "",
        flowName: activeMenu.name,
        flowDesc: "",
        serviceType: defaultChannel,
        policy: "",
        referenceFlowIds: [],
        includeExceptions: true,
      });
      setFlowNodes([]);
      setFlowEdges([]);
      setJsonCode("");
      setStructuredPlan([]);
      setLayoutDirection("TB");
      setStep(1);
    }
  }, [activeMenuId, selectedProjectId, projects]);

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
              domain: info.domain,
              customDomain: info.customDomain,
              channel: info.serviceType,
              referenceFlowIds: info.referenceFlowIds,
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

  const handleSelectMenu = (id: string | null) => {
    if (!id) {
      setActiveMenuId(null);
      return;
    }
    
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    
    const menu = project.menus.find(m => m.id === id);
    if (!menu) return;
    
    // 2-depth validation
    if (menu.depth === 2 && menu.parentId) {
      const parent = project.menus.find(pm => pm.id === menu.parentId);
      if (parent && (!parent.flowData || !parent.flowData.policy)) {
        showAlert(`${parent.name} 메뉴 공통 지침을 먼저 등록하세요.`, "계층 구조 확인");
        return;
      }
      
      // Auto-branding flowName for 2rd depth
      if (!menu.flowData) {
        setInfo(prev => ({
          ...prev,
          flowName: `${parent?.name} (${menu.name})`
        }));
      }
    }
    
    setActiveMenuId(id);
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

    const activeMenu = projects.find(p => p.id === selectedProjectId)?.menus.find(m => m.id === activeMenuId);
    let parentContext = "";
    let referenceContext = "";
    
    if (activeMenu?.depth === 2 && activeMenu.parentId) {
      const parent = projects.find(p => p.id === selectedProjectId)?.menus.find(m => m.id === activeMenu.parentId);
      if (parent?.flowData) {
        parentContext = `
[부모 프로세스 핵심 가이드라인]
상위 프로세스명: ${parent.name}
상위 핵심 지침: ${parent.flowData.policy}

**[필수 엄격 지침 - 최우선 순위]**
1. 현재 작성하는 '${activeMenu.name}' 프로세스는 반드시 위 상위 메뉴의 핵심 지침과 서비스 방향을 100% 계승해야 합니다.
2. **[환각 방지]** 만약 '${activeMenu.name}' 메뉴가 상위 지침에서 '불가능'하거나 '제한'된 대상을 다룬다면(예: 14세 미만 가입 제한인데 '14세 미만 가입' 요청 시), 절대 성공 프로세스를 만들지 마십시오. 대신 '불가 안내/차단' 프로세스로 내용을 도출하십시오.
3. 어떤 경우에도 상위 지침과 충돌하거나 이를 벗어나는 독자적인 허용 정책을 수립할 수 없습니다.
4. 상위 지침을 기반으로 '상세화(Detailing)'하거나 '구체화'하는 관점에서만 내용을 도출하십시오.`;
      }
    }

    if (info.referenceFlowId) {
      const referenceMenu = projects.find(p => p.id === selectedProjectId)?.menus.find(m => m.id === info.referenceFlowId);
      if (referenceMenu?.flowData?.structuredPlan) {
        referenceContext = `
[타 프로세스 참조 (Reference Flow) 정보]
참조 프로세스명: ${referenceMenu.name}
참조 구조: ${JSON.stringify(referenceMenu.flowData.structuredPlan.map((a: any) => a.tag + ": " + a.content))}
참조 정책: ${referenceMenu.flowData.policy}

**[시니어 기획자 수준의 심층 연계 규칙]**
1. **유기적 연결**: 현재 기획하는 '${info.flowName}' 로직은 참조 프로세스('${referenceMenu.name}')의 흐름과 완벽하게 이어져야 합니다.
2. **데이터 및 상태 점검**: 참조 프로세스에서 발생한 결과 상태(예: 부모 동의 완료 여부, 가입 완료 상태 등)를 현재 프로세스의 초기 분기나 검증 과정에 필수로 반영해야 합니다. (예: 미성년자 가입 시 부모동의를 받았다면, 로그인 프로세스 진입 시 부모동의 내역이 있는지 필터링하는 파트 추가)
3. 단순 설명 나열이 아닌 '상태 데이터 검증' 관점에서의 분기 또는 예외 처리를 자연스럽게 녹여내십시오.`;
      }
    }

    const systemPrompt = `당신은 현업에서 활동하는 시니어 IT 서비스 기획자입니다. 
사용자가 입력한 '서비스 명', '흐름 명', '산업군(Domain)', '플랫폼(Channel)' 정보를 바탕으로, 해당 프로세스의 '상세 설명'과 '참고 정책 및 규칙'을 가장 전문적인 수준으로 추론하여 작성해주세요.
${parentContext}
${referenceContext}

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

[분기 흐름 규칙 - 핵심]
- [Y/N 분기 분리] Decision 노드에서 Y(성공) 방향은 메인 흐름을 따라 아래(TB) 또는 오른쪽(LR)으로 이어지고, N(실패/예외) 방향은 반드시 다른 경로로 분리하여 Y 흐름과 중복되지 않도록 하세요.
- [N 분기 독립성] N 분기의 후속 프로세스가 Y 분기의 끝(종료 노드)에 합류하면 안 됩니다. N 분기는 자체 종료 노드(에러 화면, 리다이렉트 등)를 가지거나, Y 흐름과 다른 위치에서 독립적으로 종료하세요.
- [다중 분기] 하나의 노드에서 여러 목적별 흐름이 갈라지는 경우(예: 자전거/도보/자동차), Edge에 label을 부여하지 않고(빈 문자열), 동일한 부모에서 여러 자식 노드로 분기하세요. 각 자식은 동일 레벨에 배치됩니다.
- [합류 최소화] 서로 다른 분기에서 나온 Edge가 동일한 타겟 노드에 합류하는 것을 최소화하세요.

[분기 상세화 규칙 - 필수]
- 결제/인증/탐색 등 여러 수단이 존재하는 프로세스는 절대 통합하지 마세요. 각 수단별로 개별 분기 노드를 생성하세요.
- 결제: 카드, 현금, 포인트, 복합결제 등 수단별로 각각 별도 노드와 분기를 생성
- 인증: ID/PW, 생체인증(지문/Face), PIN 등 수단별 별도 분기. 추가 인증(OTP, mOTP, ARS, SMS 등)도 동일
- 탐색/길찾기: 걷기, 자전거, 자동차 등 수단별 별도 분기
- 각 수단 분기는 부모 노드에서 직접 분기하는 Edge로 연결(label 없음)

[디테일 규칙]
- [컴포넌트 타입 명시] 화면 생성 시 텍스트 앞에 [Page], [Bottom Sheet], [Modal], [Toast], [Alert]를 명시하세요.
- [액션과 시스템 분리] 사용자 조작은 "[Action]", 시스템 검증은 "[System]"으로 명시하세요.
- [상태 및 예외 분기] 인증/권한 검증과 에러/타임아웃 예외 분기를 반드시 반영하세요.
- 새로 추론하여 추가한 노드명/설명 끝에는 애스터리스크(*)를 붙이세요.`;
    const activeMenu = projects.find(p => p.id === selectedProjectId)?.menus.find(m => m.id === activeMenuId);
    let parentContext = "";
    let referenceContext = "";
    
    if (activeMenu?.depth === 2 && activeMenu.parentId) {
      const parent = projects.find(p => p.id === selectedProjectId)?.menus.find(m => m.id === activeMenu.parentId);
      if (parent?.flowData) {
        parentContext = `
[부모 프로세스 핵심 지침 (${parent.name})]
상위 핵심 지침: ${parent.flowData.policy}

**[핵심 도출 원칙 - 절대 준수]**
1. 하위 프로세스는 상위 프로세스의 공통 지침을 절대 뒤집거나 충돌할 수 없습니다. 상위에서 정의한 '제약 사항'은 하위에서도 철저히 지켜져야 합니다.
2. **[정책 불일치 대응]** 만약 현재 메뉴명('${activeMenu.name}')이 상위 지침상 금지된 행위를 암시한다면, '성공 흐름'이 아닌 '거절/안내/차단 흐름'을 다이어그램으로 그리십시오. (예: 14세 미만 불가 정책인데 14세 미만 대상 메뉴라면, '차단 화면'으로 종료)
3. 부모 단계에서 명시된 지침의 큰 틀을 유지하면서, '${activeMenu.name}'과 관련된 세부 절차와 예외 케이스를 상세화하십시오.
4. 상위 지침에서 언급된 명칭과 용어를 일관되게 사용하세요.`;
      }
    }

    if (info.referenceFlowId) {
      const referenceMenu = projects.find(p => p.id === selectedProjectId)?.menus.find(m => m.id === info.referenceFlowId);
      if (referenceMenu?.flowData?.structuredPlan) {
        referenceContext = `
[타 프로세스 참조 (Reference Flow) 아키텍처 연계]
참조 프로세스명: ${referenceMenu.name}
참조 구조: ${JSON.stringify(referenceMenu.flowData.structuredPlan.map((a: any) => a.tag + ": " + a.content))}
참조 정책: ${referenceMenu.flowData.policy}

**[시니어 기획자 수준의 다이어그램 설계 원칙]**
1. 본 프로세스('${info.flowName}')는 참조 프로세스('${referenceMenu.name}')에 강력하게 종속된 이어지는 로직입니다.
2. [상태 연동 분기] 다이어그램 설계 시, 참조 플로우에서 진행했던 특정 액션(예: 신원 검증, 권한 확인, 부모 동의 등)의 '통과 여부'를 판단하는 Decision(분기) 노드를 초반부에 반드시 배치하십시오.
3. [불일치 대응] 참조 프로세스의 결과 조건을 만족하지 못하는 N(실패) 분기에 대해서는 적절한 에러 문구 화면 또는 되돌아가기 액션을 부여하여 프로세스의 무결성을 보장하십시오.`;
      }
    }

    const userPrompt = `입력된 서비스 기획 정보를 바탕으로 프로세스를 구조화하고 JSON 다이어그램 데이터를 생성해줘.
${parentContext}
${referenceContext}
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
- "분기", "분기Y", "분기N" 항목의 indent는 해당 "화면"보다 1 이상 크게 설정하세요.

[분기 흐름 규칙 - 핵심]
- [Y/N 분기 분리] Decision 노드에서 Y(성공) 방향은 메인 흐름 축을 따라가고, N(실패/예외) 방향은 별도 축으로 분리하여 Y 흐름과 중복되지 않도록 하세요.
- [N 분기 독립성] N 분기의 후속 프로세스가 Y 분기의 끝(종료 노드)에 합류하면 안 됩니다. N은 자체 종료점을 가지거나 다른 위치에서 독립적으로 종료하세요.
- [다중 분기] 목적별 1:N 분기 시, Edge에 label을 부여하지 않고(빈 문자열) 동일 부모에서 여러 자식 노드로 분기하세요.
- [합류 최소화] 서로 다른 분기의 Edge가 동일한 노드에 합류하는 것을 최소화하세요.

[분기 상세화 규칙 - 필수]
- 결제/인증/탐색 등 여러 수단이 존재하는 프로세스는 절대 통합하지 말고 각 수단별로 개별 분기 노드를 생성하세요.
- 결제: 카드/현금/포인트/복합결제, 인증: ID·PW/생체/PIN/OTP/mOTP/ARS/SMS, 탐색: 걷기/자전거/자동차 등 모두 개별 노드로 분기`;
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
    showAlert("현재 메뉴의 기획 정보가 저장되었습니다.", "저장 완료");
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
    showConfirm("프로젝트를 삭제하시겠습니까? 관련 메뉴 및 프로세스 정보가 모두 삭제됩니다.", () => {
      setProjects(projects.filter(p => p.id !== id));
    }, "프로젝트 삭제");
  };

  const handleAddMenu = (name: string, parentId?: string) => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    // 2-depth creation validation
    if (parentId) {
      const parent = project.menus.find(m => m.id === parentId);
      if (parent && (!parent.flowData || !parent.flowData.policy)) {
        showAlert(`${parent.name} 메뉴 공통 지침을 먼저 등록한 후 하위 메뉴를 추가할 수 있습니다.`, "하위 메뉴 추가 제한");
        return;
      }
    }

    const sameDepthMenus = (project?.menus || []).filter(m => parentId ? m.parentId === parentId : m.depth === 1);
    const newMenu: MenuItem = {
      id: Date.now().toString(),
      name,
      depth: parentId ? 2 : 1,
      order: sameDepthMenus.length,
      parentId
    };
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProjectId) return p;
      return { ...p, menus: [...p.menus, newMenu] };
    }));
    setActiveMenuId(newMenu.id);
  };

  const handleDeleteMenu = (id: string) => {
    showConfirm("이 메뉴와 모든 하위 프로세스 정보를 삭제하시겠습니까?", () => {
      const project = projects.find(p => p.id === selectedProjectId);
      if (!project) return;
      const childIds = project.menus.filter(m => m.parentId === id).map(m => m.id);
      const idsToRemove = new Set([id, ...childIds]);
      
      setProjects(prev => prev.map(p => {
        if (p.id !== selectedProjectId) return p;
        return { ...p, menus: p.menus.filter(m => !idsToRemove.has(m.id)) };
      }));
      if (activeMenuId && idsToRemove.has(activeMenuId)) setActiveMenuId(null);
    }, "메뉴 삭제");
  };

  const handleRenameMenu = (id: string, newName: string) => {
    if (!selectedProjectId || !newName.trim()) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProjectId) return p;
      return { ...p, menus: p.menus.map(m => m.id === id ? { ...m, name: newName.trim() } : m) };
    }));
  };

  const handleMoveMenu = (id: string, direction: "up" | "down") => {
    if (!selectedProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProjectId) return p;
      const menu = p.menus.find(m => m.id === id);
      if (!menu) return p;
      
      // Get siblings (same depth & same parent)
      const siblings = p.menus
        .filter(m => m.depth === menu.depth && m.parentId === menu.parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
      const idx = siblings.findIndex(m => m.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return p;
      
      const swapMenu = siblings[swapIdx];
      const newMenus = p.menus.map(m => {
        if (m.id === id) return { ...m, order: swapMenu.order ?? swapIdx };
        if (m.id === swapMenu.id) return { ...m, order: menu.order ?? idx };
        return m;
      });
      return { ...p, menus: newMenus };
    }));
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
            {/* Navigation buttons removed as they are redundant in project view */}
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
              onSelectMenu={handleSelectMenu}
              onAddMenu={handleAddMenu}
              onDeleteMenu={handleDeleteMenu}
              onRenameMenu={handleRenameMenu}
              onMoveMenu={handleMoveMenu}
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
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedProject?.name} 서비스 프로세스 설계</h2>
                        <p className="text-slate-500 text-sm">메뉴 생성 후 개별 프로세스 정보를 등록하세요.</p>
                      </header>
                      <div className="flex-1 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
                        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6 custom-scrollbar">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">DOMAIN / INDUSTRY</label>
                              <div className="flex flex-wrap gap-1.5">
                                {["금융", "커머스", "공공", "통신", "제조", "헬스케어", "직접입력"].map((type) => (
                                  <button 
                                    key={type} 
                                    disabled={activeMenu?.depth === 2}
                                    onClick={() => setInfo(prev => ({ ...prev, domain: type }))}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                      info.domain === type ? "bg-slate-900 text-white shadow-md" : 
                                      activeMenu?.depth === 2 ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                    }`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                              {info.domain === "직접입력" && (
                                <input 
                                  type="text" 
                                  name="customDomain" 
                                  value={info.customDomain} 
                                  onChange={handleInfoChange} 
                                  disabled={activeMenu?.depth === 2}
                                  placeholder="직접 입력하세요." 
                                  className="w-full mt-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed" 
                                />
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Channel</label>
                              <div className="flex flex-wrap gap-1.5">
                                {["Web", "App", "Admin", "Kiosk", "Event"].map((type) => (
                                  <button 
                                    key={type} 
                                    disabled={activeMenu?.depth === 2}
                                    onClick={() => setInfo(prev => ({ ...prev, serviceType: type }))}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                      info.serviceType === type ? "bg-slate-900 text-white shadow-md" : 
                                      activeMenu?.depth === 2 ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                    }`}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {activeMenu?.depth === 2 && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                              <label className="block text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Link size={12} className="text-blue-500" /> 타 프로세스 참조 (Reference Flow)</label>
                              <select 
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val && !info.referenceFlowIds.includes(val)) {
                                    setInfo(prev => ({ ...prev, referenceFlowIds: [...prev.referenceFlowIds, val] }));
                                  }
                                }} 
                                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm text-slate-700 cursor-pointer shadow-sm"
                              >
                                <option value="">참조할 프로세스 추가하기...</option>
                                {projects.find(p => p.id === selectedProjectId)?.menus.filter(m => m.depth === 2 && m.id !== activeMenuId && m.flowData?.structuredPlan && m.flowData.structuredPlan.length > 0 && !info.referenceFlowIds.includes(m.id)).map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>

                              {info.referenceFlowIds.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {info.referenceFlowIds.map(id => {
                                    const refMenu = projects.find(p => p.id === selectedProjectId)?.menus.find(m => m.id === id);
                                    if (!refMenu) return null;
                                    return (
                                      <div key={id} className="flex items-center gap-1.5 bg-blue-100/80 text-blue-800 font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm border border-blue-200">
                                        <span>{refMenu.name}</span>
                                        <button 
                                          onClick={() => setInfo(prev => ({ ...prev, referenceFlowIds: prev.referenceFlowIds.filter(rid => rid !== id) }))} 
                                          className="text-blue-400 hover:text-blue-700 transition-colors p-0.5 rounded-full hover:bg-blue-200"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-[10px] text-slate-500 mt-2 pl-1 font-medium leading-relaxed">추가된 프로세스들의 핵심 설계 정보를 모두 유기적으로 통합하여 시니어 수준의 설계 흐름을 도출합니다.</p>
                            </div>
                          )}

                          {activeMenu?.depth === 2 && (
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
                          )}
                          
                          {activeMenu?.depth === 2 && (
                            <div className="flex-1 flex flex-col min-h-[120px]">
                              <div className="flex items-center justify-between mb-1.5 flex-none">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">간편정보입력 (Process Description)</label>
                                <button onClick={generateAutoDescription} disabled={isGeneratingDesc || !info.serviceName || !info.flowName} className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-slate-100 disabled:text-slate-400 flex items-center gap-1.5 transition-all rounded-lg text-xs font-black shadow-sm" title="AI가 내용을 자동 완성합니다.">
                                  {isGeneratingDesc ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />} AI 자동 작성
                                </button>
                              </div>
                              <textarea name="flowDesc" value={info.flowDesc} onChange={handleInfoChange} placeholder="프로세스의 주요 단계와 목적을 자유롭게 기술하세요." className="w-full flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-semibold text-sm" />
                            </div>
                          )}
                          
                          <div className="flex-1 flex flex-col min-h-[120px]">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2 flex-none"><Info size={12} /> {activeMenu?.depth === 1 ? "메뉴 기본 지침" : "Reference Policies & Rules"}</label>
                            <textarea name="policy" value={info.policy} onChange={handleInfoChange} placeholder={activeMenu?.depth === 1 ? "이 메뉴 하위의 모든 프로세스에 공통으로 적용될 기본 지침이나 제약사항을 입력하세요." : "참고할 법령, 서비스 정책 등을 입력하세요."} className="w-full flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-semibold text-sm" />
                          </div>
                        </div>
                        {error && (
                          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-start gap-2 border border-red-100 flex-none">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <div>{error}</div>
                          </div>
                        )}
                        {activeMenu?.depth === 1 ? (
                          <button 
                            onClick={() => {
                              syncCurrentDataToMenu();
                              showAlert("메뉴 기본 지침이 등록되었습니다. 이제 하위 메뉴(2depth)를 추가하여 프로세스를 구성할 수 있습니다.", "저장 완료");
                            }} 
                            disabled={!info.domain || (info.domain === "직접입력" && !info.customDomain?.trim()) || !info.serviceType || !info.policy?.trim()} 
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-lg shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 flex-none"
                          >
                            <CheckCircle /> 저장
                          </button>
                        ) : (
                          <button onClick={generateInitialFlow} disabled={loading || !info.serviceName.trim() || !info.flowName.trim() || !info.flowDesc.trim()} className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-lg shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 flex-none">
                            {loading ? <RefreshCw className="animate-spin" /> : <Eye />}
                            {loading ? "AI 분석 및 설계 중..." : "✨ 프로세스 분석 시작"}
                          </button>
                        )}
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
                          <button onClick={() => setStep(1)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 text-xs shadow-sm"><ArrowLeft size={16} /> 이전</button>
                        </div>
                      </header>
                      <div className="flex gap-4 flex-1 min-h-0 h-full overflow-hidden">
                        <div className={`bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col overflow-hidden h-full transition-all duration-500 ${isJsonHidden ? "flex-1" : "w-1/2"}`}>
                          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-none">
                            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2 pl-2"><FileText size={16} className="text-blue-600" /> 업무 구조화 리포트</h3>
                            <div className="flex items-center gap-3 pr-1">
                              <button onClick={() => setIsJsonHidden(!isJsonHidden)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${!isJsonHidden ? "bg-slate-900 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"}`}>
                                <Code size={14} /> JSON {isJsonHidden ? "보기" : "숨기기"}
                              </button>
                              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button onClick={() => setLayoutDirection("TB")} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${layoutDirection === "TB" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>세로</button>
                                <button onClick={() => setLayoutDirection("LR")} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${layoutDirection === "LR" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>가로</button>
                              </div>
                              <button onClick={() => setStep(3)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 text-xs">최종 시각화 <ChevronRight size={16} /></button>
                            </div>
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
                        <button onClick={refineFlow} disabled={isRefining || !refinePrompt.trim()} className="w-full md:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap text-xs shadow-md shadow-slate-200">
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
      {/* Custom Alert Modal */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-8 pb-4">
              <div className="flex items-center gap-3 mb-4">
                 {alertState.isConfirm ? (
                   <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                     <AlertCircle size={24} />
                   </div>
                 ) : (
                   <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                     <CheckCircle size={24} />
                   </div>
                 )}
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">{alertState.title}</h3>
              </div>
              <p className="text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">{alertState.message}</p>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              {alertState.isConfirm ? (
                <>
                  <button 
                    onClick={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 py-3 bg-white text-slate-500 rounded-xl font-black border border-slate-200 hover:bg-slate-100 transition-all text-xs"
                  >
                    취소
                  </button>
                  <button 
                    onClick={() => { if (alertState.onConfirm) alertState.onConfirm(); }}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-all shadow-lg text-xs"
                  >
                    확인
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-all shadow-lg text-xs"
                >
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
