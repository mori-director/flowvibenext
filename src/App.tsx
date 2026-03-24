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
} from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";
import FlowEditor from "./components/FlowEditor";
import { exportPPT, exportFigma } from "./utils/exportUtils";
import "@xyflow/react/dist/style.css";

export default function App() {
  const [step, setStep] = useState(1); // 1: 입력, 2: 구조화 및 검증, 3: 최종 시각화
  const [loading, setLoading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기본 정보 상태
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

  // React Flow State
  const [flowNodes, setFlowNodes] = useState<any[]>([]);
  const [flowEdges, setFlowEdges] = useState<any[]>([]);
  const [jsonCode, setJsonCode] = useState("");

  const [structuredPlan, setStructuredPlan] = useState<any[]>([]);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

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
- Domain: ${info.domain === "직접입력" ? info.customDomain : info.domain}
- SERVICE NAME: ${info.serviceName}
- Flow Name: ${info.flowName}
- Channel: ${info.serviceType}
`;

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
              flowDesc: {
                type: Type.STRING,
                description: "프로세스의 주요 단계와 목적에 대한 상세 설명",
              },
              policy: {
                type: Type.STRING,
                description:
                  "참고할 법령, 서비스 정책, 이용약관, 예외처리 규칙 등",
              },
            },
          },
        },
      });

      let text = response.text || "{}";
      text = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const result = JSON.parse(text);

      setInfo((prev) => ({
        ...prev,
        flowDesc: result.flowDesc || prev.flowDesc,
        policy: result.policy || prev.policy,
      }));
    } catch (err: any) {
      console.error("AI Auto Description Error:", err);
      setError(err.message || "AI 자동 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const generateInitialFlow = async () => {
    if (
      !info.serviceName ||
      !info.flowName ||
      !info.serviceType ||
      !info.flowDesc
    ) {
      setError(
        "SERVICE NAME, Flow Name, Channel, 그리고 간편정보입력(Process Description)은 필수 입력 사항입니다.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    const systemPrompt = `당신은 화면설계서를 작성하는 시니어 기획자입니다. 
지침에 따라 사용자의 서비스 요건을 분석하여 업무 구조화 리포트를 작성하고, 다이아그램 노드와 엣지 모델을 JSON 형태로 추출해주시기 바랍니다.

[필수 지침]
1. 프론트엔드/UX 관점의 사용자 화면 영역만 취급합니다. 백엔드 및 DB 로직은 'process' 노드로 통합하세요.
2. 예외(어뷰징 등) 처리와 앱심사 지침 등을 분기로 표현해야 합니다.
3. 노드의 종류(type)는 7가지 조합입니다: 
   - startEnd: 시작 지점과 종료 지점
   - screen: 화면 (Page, Modal 등)
   - action: 사용자의 클릭/입력 행위
   - process: 화면 이동 제외 일반 백엔드 내부 로직
   - decision: 참/거짓 분기점
   - database: DB 조회 및 저장
   - external: 외부 시스템 연동
4. Edge(선) 객체는 반드시 'source'와 'target' Key를 사용해 연결할 Node의 id를 명시하세요.
5. 생성되는 모든 노드(nodes)는 끊기지 않고 최소 하나 이상 선(edges)으로 완벽하게 연결되어 고립된 예외 노드가 없도록 강제하세요.
6. 업무 구조화 리포트(analysis)는 JSON 배열 형태로 작성합니다. 각 항목은 {tag, content, indent} 객체입니다.
   - tag는 반드시 다음 8개 값 중 하나: "프로세스명", "화면", "프로세스", "분기", "분기Y", "분기N", "DB", "일반"
   - content는 해당 항목의 설명 텍스트 (순수 텍스트, 마크다운/대괄호 태그 사용 금지)
   - indent는 들여쓰기 레벨 (0=최상위, 1=하위, 2=하위의하위)
   - "분기", "분기Y", "분기N" 항목의 indent는 해당 "화면"보다 1 이상 크게 설정하세요.
7. Decision(분기) 노드에서 뻗어나가는 참(성공) 방향 선(Edge)의 'label' Key 값으로 "Y", 거짓(실패/예외) 방향 선(Edge)의 'label' Key 값으로 "N"을 반드시 앞뒤 공백 없이 삽입하세요.
8. **[edges 생성 핵심 지침]** analysis(업무 구조화 리포트)에서 서술한 모든 프로세스 단계의 순서 및 분기 흐름을 edges 배열에 반드시 1:1 대응시켜 표현하세요. 예를 들어 리포트에서 "A 화면 → B 프로세스 → C 분기" 순으로 기술되었다면, edges에 {source: "A의 id", target: "B의 id"}, {source: "B의 id", target: "C의 id"}가 반드시 들어가야 합니다. edges 배열이 비어있으면 절대 안 됩니다.

[디테일 및 능동적 추론 규칙 - SI급 화면설계서(SB) 기준]
9. [컴포넌트 타입 명시] 화면(Screen) 노드 도출 시 단순 "~~화면"이 아니라, 해당 UI의 성격에 맞추어 텍스트 앞에 [Page], [Bottom Sheet], [Modal], [Toast], [Alert] 중 하나를 반드시 명시하세요. (예: "[Bottom Sheet] 퍼스널 옵션 선택*")
10. [액션과 시스템 분리] 사용자의 행위인지 백엔드의 처리인지 명확히 구분하세요. 사용자가 조작하는 로직은 "[Action] 버튼 탭", 시스템의 이면 백엔드 검증 로직은 "[System] DB 조회/검증" 형태로 말머리를 달아주세요.
11. [상태 및 예외 분기] 단순 성공/실패만 도출하지 마세요. 화면 진입 전의 "상태값 검증 분기"(로그인, 약관동의 여부 등)와 로직 수행 후의 "예외 상태 분기"(타임아웃, 점검 등)를 반드시 1개 이상 추론하여 촘촘히 설계하세요.
12. [시선 흐름 정보 노출] 일반 텍스트 설명(tag: "일반")에는 해당 단계(화면) 진입 시 사용자에게 우선적으로 노출되는 핵심 데이터(Data)나 상태 메시지(예: 최상단 배너 노출, 잔액 정보 표시 등)를 반드시 포함하여 작성하세요.
13. [마이크로 플로우 및 추론 마크 표시] 정보가 부족할 경우 최신 UI/UX 트렌드를 바탕으로 촘촘히 추론하여 채워야 하며, 사용자의 원본 입력에는 없었으나 당신이 직접 추론하여 추가한 노드명(label)과 설명(content)의 끝에는 반드시 애스터리스크 기호(*)를 붙여 표시하세요. (예: "생체인증 분기*")`;

    const userPrompt = `
[기본 정보]
- Domain: ${info.domain === "직접입력" ? info.customDomain : info.domain}
- SERVICE NAME: ${info.serviceName}
- Flow Name: ${info.flowName}
- 상세설명: ${info.flowDesc}
- Channel: ${info.serviceType}
- 참고정책: ${info.policy}
- 예외처리포함여부: ${info.includeExceptions ? "YES" : "NO"}

위 정보를 바탕으로 완벽한 JSON Data 구조로 작성해줘.`;

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
                description:
                  "업무 구조화 리포트. 각 프로세스 단계를 tag/content/indent 객체로 구분하여 작성",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tag: {
                      type: Type.STRING,
                      description:
                        "항목 유형. 반드시 다음 중 하나: 프로세스명, 화면, 프로세스, 분기, 분기Y, 분기N, DB, 일반",
                    },
                    content: {
                      type: Type.STRING,
                      description:
                        "해당 항목의 설명 텍스트 (순수 텍스트, 마크다운 금지)",
                    },
                    indent: {
                      type: Type.INTEGER,
                      description: "들여쓰기 레벨 (0=최상위, 1=하위, 2=하위의하위)",
                    },
                    screenId: {
                      type: Type.STRING,
                      description: "해당 도메인의 가상 Screen ID (예: PAY-0100) - tag가 '화면'일 때만 필수, 그 외는 빈 문자열('')",
                    },
                  },
                  required: ["tag", "content", "indent"],
                },
              },
              nodes: {
                type: Type.ARRAY,
                description:
                  "다이어그램의 모든 노드. analysis에 서술된 모든 화면/프로세스/분기/DB 단계가 노드로 표현되어야 함",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.STRING,
                      description:
                        "노드 고유 ID (edges에서 source/target으로 참조)",
                    },
                    label: {
                      type: Type.STRING,
                      description: "노드에 표시될 한글 레이블",
                    },
                    type: {
                      type: Type.STRING,
                      description: "startEnd, screen, action, process, decision, database, external 중 하나",
                    },
                  },
                  required: ["id", "label", "type"],
                },
              },
              edges: {
                type: Type.ARRAY,
                description:
                  "노드 간 연결관계. analysis에 서술된 프로세스 순서와 분기 흐름을 반드시 edges로 표현해야 함. 비어있으면 안 됨. 노드 수보다 최소 1개 적은 수이어야 함.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "엣지 고유 ID" },
                    source: {
                      type: Type.STRING,
                      description: "출발 노드의 id",
                    },
                    target: {
                      type: Type.STRING,
                      description: "도착 노드의 id",
                    },
                    label: {
                      type: Type.STRING,
                      description:
                        "분기에서 나오는 선이면 Y 또는 N, 아니면 빈 문자열",
                    },
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

      setStructuredPlan(result.analysis || []);

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

      // JSON DATA에 노드와 엣지(연결관계)를 모두 포함하여 표시
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
          },
          null,
          2,
        ),
      );

      setFlowNodes(generatedNodes);
      setFlowEdges(generatedEdges);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "AI 분석 중 오류가 발생했습니다.");
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
**[핵심]** analysis(업무 구조화 리포트)에서 서술한 모든 프로세스 단계의 순서 및 분기 흐름을 edges 배열에 1:1 대응시켜 표현하세요. edges 배열이 비어있으면 절대 안 됩니다.

[analysis 작성 규칙]
- analysis는 JSON 배열로 작성합니다. 각 항목은 {tag, content, indent} 객체입니다.
- tag는 반드시 다음 8개 값 중 하나: "프로세스명", "화면", "프로세스", "분기", "분기Y", "분기N", "DB", "일반"
- content는 순수 텍스트로 작성합니다. 마크다운, 대괄호 태그 등을 사용하지 마세요.
- indent는 0(최상위), 1(하위), 2(하위의 하위) 중 하나입니다.
- "분기", "분기Y", "분기N" 항목의 indent는 해당 "화면"보다 1 이상 크게 설정하세요.

[디테일 및 능동적 추론 규칙 - SI급 화면설계서(SB) 기준]
- [컴포넌트 타입 명시] 추가 요청에 의해 화면이 생성/수정될 때, 텍스트 앞에 [Page], [Bottom Sheet], [Modal], [Toast], [Alert]를 반드시 명시하세요. (예: "[Bottom Sheet] 쿠폰 선택*")
- [액션과 시스템 분리] 사용자의 조작은 "[Action]", 시스템의 이면 검증은 "[System]" 형태로 노드와 설명 앞에 명시하세요.
- [상태 및 예외 분기] 이전 단계에서의 "상태값(인증/권한) 검증"과 결과 단계에서의 "예외(에러/타임아웃) 분기"를 치밀하게 반영하세요.
- [시선 흐름 정보] 화면 단계 설명 시, 사용자가 가장 먼저 볼 핵심 데이터와 상태 메시지를 명시하세요.
- [마이크로 플로우 및 추론 마크] 기존 입력과 요청사항 사이의 빈 구간을 최신 UX 트렌드로 촘촘하게 추론하세요. 새로 구상하여 추가한 모든 노드명(label)과 설명의 끝에는 반드시 애스터리스크 기호(*)를 붙이세요.`;

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
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.ARRAY,
                description:
                  "수정된 업무 구조화 리포트. 각 프로세스 단계를 tag/content/indent 객체로 구분",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tag: {
                      type: Type.STRING,
                      description:
                        "항목 유형. 반드시 다음 중 하나: 프로세스명, 화면, 프로세스, 분기, 분기Y, 분기N, DB, 일반",
                    },
                    content: {
                      type: Type.STRING,
                      description:
                        "해당 항목의 설명 텍스트 (순수 텍스트, 마크다운 금지)",
                    },
                    indent: {
                      type: Type.INTEGER,
                      description: "들여쓰기 레벨 (0=최상위, 1=하위, 2=하위의하위)",
                    },
                    screenId: {
                      type: Type.STRING,
                      description: "해당 도메인의 가상 Screen ID (예: PAY-0100) - tag가 '화면'일 때만 필수, 그 외는 빈 문자열('')",
                    },
                  },
                  required: ["tag", "content", "indent"],
                },
              },
              nodes: {
                type: Type.ARRAY,
                description:
                  "수정된 다이어그램의 모든 노드. 모든 화면/프로세스/분기/DB 단계가 노드로 표현되어야 함",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.STRING,
                      description:
                        "노드 고유 ID (edges에서 source/target으로 참조)",
                    },
                    label: {
                      type: Type.STRING,
                      description: "노드에 표시될 한글 레이블 (필수)",
                    },
                    type: {
                      type: Type.STRING,
                      description: "startEnd, screen, action, process, decision, database, external 중 하나",
                    },
                  },
                  required: ["id", "label", "type"],
                },
              },
              edges: {
                type: Type.ARRAY,
                description:
                  "노드 간 연결관계. analysis에 서술된 프로세스 순서와 분기 흐름을 edges로 표현. 비어있으면 절대 안 됨.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "엣지 고유 ID" },
                    source: {
                      type: Type.STRING,
                      description: "출발 노드의 id",
                    },
                    target: {
                      type: Type.STRING,
                      description: "도착 노드의 id",
                    },
                    label: {
                      type: Type.STRING,
                      description: "분기 Y/N 또는 빈 문자열",
                    },
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

      setStructuredPlan(result.analysis || []);

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

      // JSON DATA에 노드와 엣지(연결관계)를 모두 포함하여 표시
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
      setError(err.message || "AI 수정 중 오류가 발생했습니다.");
    } finally {
      setIsRefining(false);
    }
  };

  const downloadExport = async (type: "Figma" | "PPT") => {
    try {
      const flowData = (window as any).__flowState || {
        nodes: flowNodes,
        edges: flowEdges,
      };
      if (type === "PPT") {
        await exportPPT(flowData.nodes, flowData.edges, info.flowName);
      } else {
        await exportFigma(flowData.nodes, flowData.edges, info.flowName, ".react-flow");
      }
    } catch (err) {
      console.error(err);
      alert("출력 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden text-slate-900 relative">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 flex-none relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-200">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tighter">
                Flow<span className="text-blue-600">Craft</span>
              </h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                Planner Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={`flex items-center gap-2 text-xs font-bold transition-all ${step === num ? "text-blue-600" : "text-slate-300"}`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${step === num ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}
                >
                  {num}
                </span>
                <span className="hidden sm:inline">
                  {num === 1 ? "INPUT" : num === 2 ? "VERIFY" : "VISUALIZE"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden p-4 md:p-6 w-full max-w-7xl mx-auto flex flex-col h-full">
        {step === 1 && (
          <div className="h-full max-w-5xl mx-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <header className="text-center space-y-1 flex-none">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                서비스 프로세스 설계
              </h2>
              <p className="text-slate-500 text-sm">
                지침에 따른 정형화된 산출물 생성을 위해 기본 정보를 입력하세요.
              </p>
            </header>

            <div className="flex-1 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6 custom-scrollbar">
                {/* Row 1: Domain | Channel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      DOMAIN / INDUSTRY
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "금융",
                        "커머스",
                        "공공",
                        "통신",
                        "제조",
                        "헬스케어",
                        "직접입력",
                      ].map((type) => (
                        <button
                          key={type}
                          onClick={() =>
                            setInfo((prev) => ({ ...prev, domain: type }))
                          }
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${info.domain === type ? "bg-slate-900 text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    {info.domain === "직접입력" && (
                      <input
                        name="customDomain"
                        value={info.customDomain}
                        onChange={handleInfoChange}
                        placeholder="도메인을 직접 입력 (예: 에듀테크)"
                        className="w-full mt-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Channel
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {["Web", "App", "Admin", "Kiosk", "Event"].map(
                        (type) => (
                          <button
                            key={type}
                            onClick={() =>
                              setInfo((prev) => ({
                                ...prev,
                                serviceType: type,
                              }))
                            }
                            // Event 버튼 숨김 처리 (삭제 구문 유지, hidden 클래스로 미노출)
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${type === "Event" ? "hidden " : ""}${info.serviceType === type ? "bg-slate-900 text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                          >
                            {type}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: ServiceName | FlowName */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      SERVICE NAME
                    </label>
                    <input
                      name="serviceName"
                      value={info.serviceName}
                      onChange={handleInfoChange}
                      placeholder="예: 우리은행 비대면 계좌개설"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Flow Name
                    </label>
                    <input
                      name="flowName"
                      value={info.flowName}
                      onChange={handleInfoChange}
                      placeholder="예: 간편 본인인증 및 회원가입 흐름"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm"
                    />
                  </div>
                </div>

                {/* Row 3: 간편정보입력 (풀사이즈) */}
                <div className="flex-1 flex flex-col min-h-[120px]">
                  <div className="flex items-center justify-between mb-1.5 flex-none">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      간편정보입력 (Process Description)
                    </label>
                    <button
                      onClick={generateAutoDescription}
                      disabled={
                        isGeneratingDesc ||
                        !info.serviceName ||
                        !info.flowName ||
                        !info.serviceType
                      }
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:bg-slate-100 disabled:text-slate-400 flex items-center gap-1.5 transition-all rounded-lg text-xs font-black shadow-sm"
                      title="SERVICE NAME, Flow Name, Channel을 기반으로 AI가 내용을 자동 완성합니다."
                    >
                      {isGeneratingDesc ? (
                        <RefreshCw className="animate-spin" size={14} />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      AI 자동 작성
                    </button>
                  </div>
                  <textarea
                    name="flowDesc"
                    value={info.flowDesc}
                    onChange={handleInfoChange}
                    placeholder="프로세스의 주요 단계와 목적을 자유롭게 기술하세요."
                    className="w-full flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-semibold text-sm"
                  />
                </div>
                <div className="hidden">
                  <input
                    type="checkbox"
                    id="exceptions"
                    name="includeExceptions"
                    checked={info.includeExceptions}
                    onChange={handleInfoChange}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <label
                    htmlFor="exceptions"
                    className="text-xs font-bold text-blue-900 cursor-pointer"
                  >
                    예외 처리 로직 강제 포함 (권한, 에러, 타임아웃 등)
                  </label>
                </div>

                {/* Row 4: Reference Policies (풀사이즈) */}
                <div className="flex-1 flex flex-col min-h-[120px]">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2 flex-none">
                    <Info size={12} /> Reference Policies & Rules
                  </label>
                  <textarea
                    name="policy"
                    value={info.policy}
                    onChange={handleInfoChange}
                    placeholder="참고할 법령, 서비스 정책, 이용약관 등을 입력하면 더 정확한 흐름을 제안합니다."
                    className="w-full flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-semibold text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-start gap-2 border border-red-100 flex-none">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              <button
                onClick={generateInitialFlow}
                disabled={
                  loading ||
                  !info.serviceName.trim() ||
                  !info.flowName.trim() ||
                  !info.flowDesc.trim()
                }
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-lg shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 flex-none"
              >
                {loading ? <RefreshCw className="animate-spin" /> : <Eye />}
                {loading ? "AI 분석 및 설계 중..." : "✨ 프로세스 분석"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-right-8 duration-500 overflow-hidden w-full max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex-none">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <CheckCircle className="text-green-500" /> 분석 및 구조화 완료
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  AI가 도출한 업무 플로우와 코드를 검토하고 필요시 수정하세요.
                </p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
              >
                최종 시각화 보기 <ChevronRight size={18} />
              </button>
            </header>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-start gap-2 border border-red-100 flex-none">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />{" "}
                <div>{error}</div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-1 gap-4 flex-1 min-h-0 h-full overflow-hidden">
              <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col overflow-hidden h-full">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-none">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-2">
                    <FileText size={14} className="text-blue-600" /> 업무 구조화
                    리포트
                  </h3>
                  <button
                    onClick={() => setStep(1)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                  >
                    <ArrowLeft size={14} />
                  </button>
                </div>
                <div className="flex-1 h-full w-full p-6 text-sm text-slate-600 leading-relaxed font-medium bg-transparent overflow-y-auto custom-scrollbar">
                  {structuredPlan && structuredPlan.length > 0 ? (
                    structuredPlan.map((item: any, i: number) => {
                      const marginLeft = (item.indent || 0) * 20;
                      const text = item.content || "";

                      switch (item.tag) {
                        case "프로세스명":
                          return (
                            <div
                              key={i}
                              className="text-lg font-black text-slate-800 mt-6 mb-3 flex items-center gap-2 border-b border-slate-200 pb-2"
                            >
                              <Layers size={18} className="text-indigo-600" />
                              <span>{text}</span>
                            </div>
                          );
                        case "화면":
                          return (
                            <div
                              key={i}
                              className="text-[15px] font-bold text-blue-600 mt-4 mb-2 flex items-center gap-2"
                              style={{ marginLeft }}
                            >
                              <Monitor size={15} className="text-blue-500 shrink-0" />
                              <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded mr-1 leading-none">
                                {item.screenId || "SCR-0000"}
                              </span>
                              <span>{text}</span>
                            </div>
                          );
                        case "프로세스":
                          return (
                            <div
                              key={i}
                              className="text-[15px] font-bold text-emerald-600 mt-4 mb-2 flex items-center gap-2"
                              style={{ marginLeft }}
                            >
                              <div className="w-2 h-2 rounded bg-emerald-600 shrink-0" />
                              <span>{text}</span>
                            </div>
                          );
                        case "DB":
                          return (
                            <div
                              key={i}
                              className="text-[15px] font-bold text-amber-600 mt-4 mb-2 flex items-center gap-2"
                              style={{ marginLeft }}
                            >
                              <Database size={15} className="text-amber-500 shrink-0" />
                              <span>{text}</span>
                            </div>
                          );
                        case "분기":
                          return (
                            <div
                              key={i}
                              className="text-sm font-semibold text-purple-600 mb-1.5 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5"
                              style={{ marginLeft: marginLeft + 12 }}
                            >
                              <span className="text-purple-500 mt-0.5 font-bold">↳</span>{" "}
                              <span>{text}</span>
                            </div>
                          );
                        case "분기Y":
                          return (
                            <div
                              key={i}
                              className="text-sm font-medium text-emerald-600 mb-1 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5"
                              style={{ marginLeft: marginLeft + 12 }}
                            >
                              <CheckCircle size={14} className="mt-0.5 shrink-0" />{" "}
                              <span>{text}</span>
                            </div>
                          );
                        case "분기N":
                          return (
                            <div
                              key={i}
                              className="text-sm font-medium text-rose-500 mb-1 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5"
                              style={{ marginLeft: marginLeft + 12 }}
                            >
                              <AlertCircle size={14} className="mt-0.5 shrink-0" />{" "}
                              <span>{text}</span>
                            </div>
                          );
                        default: // "일반" 및 기타
                          return (
                            <div
                              key={i}
                              className="text-sm text-slate-600 mb-1 flex items-start gap-1.5 border-l-2 border-slate-200 pl-4 py-0.5"
                              style={{ marginLeft: marginLeft + 12 }}
                            >
                              <span className="text-slate-400 mt-0.5 mr-1">•</span>
                              <span>{text}</span>
                            </div>
                          );
                      }
                    })
                  ) : (
                    <div className="text-slate-400">
                      분석 결과를 생성 중입니다...
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col h-full">
                <div className="p-3 border-b border-slate-800 flex justify-between items-center flex-none">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Code size={12} className="text-emerald-400" /> JSON Data
                  </h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(jsonCode);
                    }}
                    className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                    title="코드 복사"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <textarea
                  value={jsonCode}
                  onChange={(e) => setJsonCode(e.target.value)}
                  className="flex-1 h-full w-full p-6 font-mono text-xs text-emerald-400 bg-transparent outline-none resize-none leading-relaxed custom-scrollbar overflow-y-auto"
                  spellCheck="false"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-3 flex flex-col md:flex-row gap-3 items-center flex-none w-full">
              <div className="flex-1 w-full relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
                  <Settings size={18} />
                </div>
                <input
                  type="text"
                  value={refinePrompt}
                  onChange={(e) => setRefinePrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refineFlow()}
                  placeholder="예: 상품구입 프로세스를 도출하였으나 슬라이드로 밀어서 결제요청하기 기능 추가해줘"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-medium text-xs"
                />
              </div>
              <button
                onClick={refineFlow}
                disabled={isRefining || !refinePrompt.trim()}
                className="w-full md:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap text-xs"
              >
                {isRefining ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : (
                  <Edit3 size={16} />
                )}
                AI 수정 반영
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 overflow-hidden">
            <div className="flex-1 bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30 flex-none">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
                    <Eye size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tighter leading-tight">
                      {info.flowName}
                    </h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] mt-0.5">
                      {info.serviceName} • 캔버스 드래그 앤 드롭 편집 가능
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setStep(2)}
                      className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center gap-1.5 text-xs shadow-sm"
                    >
                      <ArrowLeft size={16} /> 이전 단계로 (수정)
                    </button>
                  </div>
                </div>
              </div>

              {/* View Area - Contains the new FlowEditor */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                <FlowEditor
                  initialNodes={flowNodes}
                  initialEdges={flowEdges}
                  onExportPPT={() => downloadExport("PPT")}
                  onExportFigma={() => downloadExport("Figma")}
                />
              </div>
            </div>

            <footer className="text-center text-slate-400 text-[11px] font-bold tracking-widest uppercase py-4 flex-none">
              FlowCraft Standard • Developed for Professional Service Planning
            </footer>
          </div>
        )}
      </main>

      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
}
