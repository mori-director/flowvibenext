import JSZip from 'jszip';
import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  FileText,
  CheckCircle,
  Play,
  Download,
  Copy,
  RefreshCw,
  Edit3,
  Layers,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  Code,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles
} from 'lucide-react';
import mermaid from 'mermaid';
import { GoogleGenAI, Type } from '@google/genai';
import * as d3 from 'd3';
import pptxgen from 'pptxgenjs';

// Mermaid 초기화 - SI 표준 테마 및 스타일 설정
mermaid.initialize({
  startOnLoad: true,
  theme: 'base',
  securityLevel: 'loose',
  themeVariables: {
    primaryColor: '#ffffff',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#3b82f6',
    lineColor: '#64748b',
    secondaryColor: '#f8fafc',
    tertiaryColor: '#ffffff',
    fontSize: '18px',
    fontFamily: 'Pretendard, sans-serif'
  },
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis',
    padding: 30,
    rankSpacing: 50,
    nodeSpacing: 50
  }
});

export default function App() {
  const [step, setStep] = useState(1); // 1: 입력, 2: 구조화 및 검증, 3: 최종 시각화
  const [loading, setLoading] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기본 정보 상태
  const [info, setInfo] = useState({
    domain: '',
    customDomain: '',
    serviceName: '',
    flowName: '',
    flowDesc: '',
    serviceType: '',
    policy: '',
    includeExceptions: true
  });

  // Mermaid 코드 및 분석 결과 상태
  const [mermaidCode, setMermaidCode] = useState('');
  const [structuredPlan, setStructuredPlan] = useState('');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [step3ViewMode, setStep3ViewMode] = useState<'visual' | 'code'>('visual');
  const mermaidRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // --- 비즈니스 로직 함수 ---

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setInfo(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateAutoDescription = async () => {
    if (!info.serviceName || !info.flowName || !info.serviceType) {
      setError("자동 생성을 위해 SERVICE NAME, Flow Name, Channel을 모두 입력해주세요.");
      return;
    }

    setIsGeneratingDesc(true);
    setError(null);

    const systemPrompt = `당신은 현업에서 활동하는 시니어 IT 서비스 기획자입니다. 
사용자가 입력한 '서비스 명', '흐름 명', '산업군(Domain)', '플랫폼(Channel)' 정보를 바탕으로, 해당 프로세스의 '상세 설명'과 '참고 정책 및 규칙'을 가장 전문적인 수준으로 추론하여 작성해주세요.

[필수 지침: "Reference Policies & Rules" (policy 필드) 작성 기준]
1. 행 구분: 각 정책 및 규칙은 불릿 포인트(-)로 시작하며 주제별로 반드시 줄바꿈(엔터) 처리하여 가독성을 높여주십시오.
2. 링크 첨부: 기획자(사용자)가 직접 원문 내용을 확인할 수 있도록 각 항목의 끝에 관련된 공식 가이드라인/법령의 명확한 **URL 주소**를 텍스트 형태로 반드시 기술하십시오. (형식: "(참고자료: URL)")
3. 앱(App) 환경의 추가 규칙: 만약 사용자의 Channel(플랫폼) 정보가 'App'이거나 '모바일'일 경우, 애플(Apple)과 구글(Android)의 최신 앱 심사 지침을 최우선으로 검토하고 현행화된 정책을 제시하십시오.
   - 예시 판단 로직: 소셜 로그인을 제공하는 흐름이라면, Apple App Store 심사 지침 4.8 위반 여부 확인 코멘트 및 'Sign in 신 with Apple' 필수 제공 안내 등.
4. 이벤트(Event) 환경의 추가 규칙: 만약 Channel 정보가 'Event'일 경우, 단순 화면 흐름을 넘어 출석체크, 결제 연동 이벤트, 외부 채널(SNS 등) 참여 유도 등 마케팅/프로모션 목적의 프로세스 및 관련 컴플라이언스(경품, 개인정보 제공 동의, 어뷰징 방지 등)를 반드시 고려하여 작성하십시오.`;

    const userPrompt = `
- Domain: ${info.domain === '직접입력' ? info.customDomain : info.domain}
- SERVICE NAME: ${info.serviceName}
- Flow Name: ${info.flowName}
- Channel: ${info.serviceType}
`;

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta.env.VITE_GEMINI_API_KEY || '').trim() });
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
                description: "프로세스의 주요 단계와 목적에 대한 상세 설명"
              },
              policy: {
                type: Type.STRING,
                description: "참고할 법령, 서비스 정책, 이용약관, 예외처리 규칙 등"
              }
            }
          }
        }
      });

      let text = response.text || '{}';
      // Remove markdown code block syntax if present
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(text);

      setInfo(prev => ({
        ...prev,
        flowDesc: result.flowDesc || prev.flowDesc,
        policy: result.policy || prev.policy
      }));
    } catch (err: any) {
      console.error("AI Auto Description Error:", err);
      setError(err.message || 'AI 자동 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const generateInitialFlow = async () => {
    if (!info.serviceName || !info.flowName || !info.serviceType) {
      setError("SERVICE NAME, Flow Name, Channel은 필수 입력 사항입니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const systemPrompt = `당신은 화면설계서를 작성하는 전문적인 시니어 기획자입니다. 
지침에 따라 '바이브코딩' 프로세스를 수행하여 정형화된 서비스 흐름도를 작성하십시오.

[Mermaid 11.x 문법 오류 방지용 강제 규칙 - 절대 준수]
1. **노드 ID 규칙:** 반드시 순수 영문자와 숫자만 사용합니다(예: step1, loginNode). 언더바(_), 특수문자, 한글, 띄어쓰기를 절대 사용하지 마십시오.
   - 절대 금지: 예약어(class, style, end, subgraph, click)를 노드 ID로 단독 사용 불가.
2. **라벨 텍스트 쌍따옴표 규칙:** 노드, 서브그래프, 화살표의 라벨 등 모든 텍스트는 반드시 쌍따옴표("")로 감싸야 합니다. 
   - 중요: 텍스트 내용 안에는 절대 쌍따옴표를 중복해서 넣거나 특수문자(꺾쇠 <, > 등)를 넣지 마십시오.
3. **노드 형태 정의 및 중복 선언 금지:** 괄호 기호의 짝을 정확히 맞추시오. 처음 한 번만 형태를 정의하고 이후엔 ID만 사용하세요.
   - 시작/종료: 노드ID(["텍스트"])
   - 프로세스: 노드ID["텍스트"]
   - 사용자 액션: 노드ID[/"텍스트"/]
   - 판단/분기: 노드ID{"텍스트"}
   - 데이터베이스: 노드ID[("텍스트")]
   - 외부연동 시스템: 노드ID[["텍스트"]]
4. **연결선(화살표) 속성:** 화살표에 텍스트를 적을 때는 파이프 기호(|)와 쌍따옴표를 씁니다. (예시: 노드ID1 -->|"Yes"| 노드ID2)

[레이어 구조 (Subgraph)]
사용자 경험(UX) 중심의 시각화를 위해 사용자 화면(Frontend) 영역만 서브그래프로 분리하여 구성하십시오. (예: subgraph UI_Layer ["Frontend / UX 영역"])
- **경고**: Database나 Backend API용 레이어(서브그래프)를 별도로 생성하지 마십시오.
- **필수 지침**: 백엔드 및 데이터베이스에서 이뤄지는 핵심 로직(예: '카드한도 월 100만원 체크', '어뷰징 방지', '이벤트 참여 이력 조회' 등)은 다른 곳으로 빼지 말고, 화면(Frontend) 흐름 내에서 일반 프로세스([ ]) 노드나 조건/판단({ }) 노드 형식으로 전개하여 UX 흐름이 하나로 이어지도록 작성하십시오.
- **이벤트(Event) 최적화**: 채널이 'Event'일 경우, 출석체크 연속성, 경품 당첨 로직, 외부 SNS 공유 확인 등과 같은 프로모션 특화 흐름과 예외(어뷰징/중복참여) 처리의 분기를 상세히 포함하십시오.

[스타일 정의 (코드 최하단에 반드시 포함)]
classDef startEnd fill:#333,stroke:#000,color:#fff,font-weight:bold
classDef process fill:#fff,stroke:#2196F3,stroke-width:2px
classDef decision fill:#FFF9C4,stroke:#FBC02D,stroke-width:2px
classDef database fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px
classDef external fill:#FFEBEE,stroke:#F44336,stroke-width:2px

[출력 형식]
1. '## 1. 업무 구조화 분석' 섹션에서 로직을 단계별로 설명하십시오.
2. '## 2. Mermaid 시각화 코드' 섹션에서 \`\`\`mermaid 블록을 사용하여 코드를 작성하십시오.`;

    const userPrompt = `
[기본 정보]
- Domain: ${info.domain === '직접입력' ? info.customDomain : info.domain}
- SERVICE NAME: ${info.serviceName}
- Flow Name: ${info.flowName}
- 상세설명: ${info.flowDesc}
- Channel: ${info.serviceType}
- 참고정책: ${info.policy}
- 예외처리포함여부: ${info.includeExceptions ? 'YES' : 'NO'}

위 정보를 바탕으로 시니어 기획자 수준의 업무 플로우차트를 구조화하고 Mermaid 코드를 생성해줘.`;

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta.env.VITE_GEMINI_API_KEY || '').trim() });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt
        }
      });

      const text = response.text || '';

      // 분석 리포트와 코드 분리
      const analysisParts = text.split(/## 2. Mermaid 시각화 코드|```mermaid|```/);
      setStructuredPlan(analysisParts[0].replace('## 1. 업무 구조화 분석', '').trim());

      const codeMatch = text.match(/```mermaid\n([\s\S]*?)```/) || text.match(/```([\s\S]*?)```/) || [null, ''];
      setMermaidCode(codeMatch[1]?.trim() || '');

      setStep(2);
    } catch (err: any) {
      setError(err.message || 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const refineFlow = async () => {
    if (!refinePrompt.trim()) return;

    setIsRefining(true);
    setError(null);

    const systemPrompt = `당신은 화면설계서를 작성하는 전문적인 시니어 기획자입니다. 
사용자의 추가 요청사항을 반영하여 기존의 '업무 구조화 리포트'와 'Mermaid 시각화 코드'를 수정하십시오.

[수정 원칙 - 필수 준수]
1. **최소 수정 원칙**: 기존의 '업무 구조화 리포트'와 'Mermaid 시각화 코드'의 구조를 최대한 유지하십시오.
2. **요청 사항만 반영**: 사용자가 명시적으로 요청한 변경 사항만 정확하게 반영하고, 그 외의 부분은 임의로 수정하거나 삭제하지 마십시오.
3. **일관성 유지**: 추가된 내용이 기존 흐름과 자연스럽게 연결되도록 하되, 기존에 잘 정의된 프로세스 노드나 설명을 멋대로 바꾸지 마십시오.
4. **예외**: 사용자가 "전체 프로세스 재생성" 또는 "처음부터 다시 작성"과 같이 전면적인 수정을 요청한 경우에만 전체를 새로 작성할 수 있습니다.

[Mermaid 11.x 문법 오류 방지용 강제 규칙 - 절대 준수]
1. **노드 ID 규칙:** 반드시 순수 영문자와 숫자만 사용합니다(예: step1, loginNode). 언더바(_), 특수문자, 한글, 띄어쓰기를 절대 사용하지 마십시오.
   - 절대 금지: 예약어(class, style, end, subgraph, click)를 노드 ID로 단독 사용 불가.
2. **라벨 텍스트 쌍따옴표 규칙:** 노드, 서브그래프, 화살표의 라벨 등 모든 텍스트는 반드시 쌍따옴표("")로 감싸야 합니다. 
   - 중요: 텍스트 내용 안에는 절대 쌍따옴표를 중복해서 넣거나 특수문자(꺾쇠 <, > 등)를 넣지 마십시오.
3. **노드 형태 정의 및 중복 선언 금지:** 괄호 기호의 짝을 정확히 맞추시오. 처음 한 번만 형태를 정의하고 이후엔 ID만 사용하세요.
   - 시작/종료: 노드ID(["텍스트"])
   - 프로세스: 노드ID["텍스트"]
   - 사용자 액션: 노드ID[/"텍스트"/]
   - 판단/분기: 노드ID{"텍스트"}
   - 데이터베이스: 노드ID[("텍스트")]
   - 외부연동 시스템: 노드ID[["텍스트"]]
4. **연결선(화살표) 속성:** 화살표에 텍스트를 적을 때는 파이프 기호(|)와 쌍따옴표를 씁니다. (예시: 노드ID1 -->|"Yes"| 노드ID2)

[레이어 구조 (Subgraph)]
사용자 경험(UX) 중심의 시각화를 위해 사용자 화면(Frontend) 영역만 서브그래프로 분리하여 구성하십시오. (예: subgraph UI_Layer ["Frontend / UX 영역"])
- **경고**: Database나 Backend API용 레이어(서브그래프)를 별도로 생성하지 마십시오.
- **필수 지침**: 백엔드 및 데이터베이스에서 이뤄지는 핵심 로직(예: '카드한도 월 100만원 체크', '어뷰징 방지', '이벤트 참여 이력 조회' 등)은 다른 곳으로 빼지 말고, 화면(Frontend) 흐름 내에서 일반 프로세스([ ]) 노드나 조건/판단({ }) 노드 형식으로 전개하여 UX 흐름이 하나로 이어지도록 작성하십시오.
- **이벤트(Event) 최적화**: 채널이 'Event'일 경우, 출석체크 연속성, 경품 당첨 로직, 외부 SNS 공유 확인 등과 같은 프로모션 특화 흐름과 예외(어뷰징/중복참여) 처리의 분기를 상세히 포함하십시오.

[스타일 정의 (코드 최하단에 반드시 포함)]
classDef startEnd fill:#333,stroke:#000,color:#fff,font-weight:bold
classDef process fill:#fff,stroke:#2196F3,stroke-width:2px
classDef decision fill:#FFF9C4,stroke:#FBC02D,stroke-width:2px
classDef database fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px
classDef external fill:#FFEBEE,stroke:#F44336,stroke-width:2px

[출력 형식]
1. '## 1. 업무 구조화 분석' 섹션에서 수정된 로직을 단계별로 설명하십시오.
2. '## 2. Mermaid 시각화 코드' 섹션에서 \`\`\`mermaid 블록을 사용하여 수정된 코드를 작성하십시오.`;

    const userPrompt = `
[기존 업무 구조화 리포트]
${structuredPlan}

[기존 Mermaid 시각화 코드]
\`\`\`mermaid
\${mermaidCode}
\`\`\`

[추가 요청사항]
${refinePrompt}

위 추가 요청사항을 반영하여 기존 내용을 수정 및 보완해줘.`;

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta.env.VITE_GEMINI_API_KEY || '').trim() });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt
        }
      });

      const text = response.text || '';

      const analysisParts = text.split(/## 2. Mermaid 시각화 코드|```mermaid|```/);
      setStructuredPlan(analysisParts[0].replace('## 1. 업무 구조화 분석', '').trim());

      const codeMatch = text.match(/```mermaid\n([\s\S]*?)```/) || text.match(/```([\s\S]*?)```/) || [null, ''];
      setMermaidCode(codeMatch[1]?.trim() || '');
      setRefinePrompt('');
    } catch (err: any) {
      setError(err.message || 'AI 수정 중 오류가 발생했습니다.');
    } finally {
      setIsRefining(false);
    }
  };

  const renderMermaid = async () => {
    if (mermaidRef.current && mermaidCode && step === 3) {
      try {
        const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
        const { svg } = await mermaid.render(id, mermaidCode);
        mermaidRef.current.innerHTML = svg;

        // D3를 이용한 노드 드래그 앤 드롭 및 텍스트 수정 구현
        const svgElement = d3.select(mermaidRef.current).select('svg');
        if (!svgElement.empty()) {
          svgElement.style('max-width', 'none');

          const nodes = svgElement.selectAll('.node');
          const edges = svgElement.selectAll('.edgePaths path, .edgePath path, path.edge-thickness-normal, path[class*="flowchart-link"], .edgePath > path');

          // 1. 텍스트 수정 (더블 클릭)
          nodes.on('dblclick', function (event) {
            event.stopPropagation();
            const nodeEl = this as Element;

            // 현재 텍스트 추출
            let currentText = '';
            const fo = nodeEl.querySelector('foreignObject');
            if (fo) {
              const div = fo.querySelector('span, p, div');
              if (div) currentText = (div as HTMLElement).innerText || div.textContent || '';
            }
            if (!currentText) currentText = nodeEl.querySelector('text')?.textContent?.trim() || '';

            const newText = prompt('텍스트를 수정하세요:', currentText);
            if (newText !== null && newText !== currentText) {
              // Mermaid 코드 업데이트 (단순 텍스트 치환)
              // 주의: 동일한 텍스트가 여러 개일 경우 모두 바뀔 수 있음.
              // 이를 방지하려면 Node ID를 찾아야 하지만, 현재 구조상 텍스트 치환이 가장 직관적임.
              const escapedCurrent = currentText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(["'])${escapedCurrent}(["'])`, 'g');

              let newCode = mermaidCode;
              if (regex.test(newCode)) {
                newCode = newCode.replace(regex, `$1${newText}$2`);
                setMermaidCode(newCode);
              } else {
                alert('코드에서 해당 텍스트를 찾을 수 없습니다.');
              }
            }
          });

          // 2. 드래그 앤 드롭 (엣지 연결 포함)
          const drag = d3.drag<any, any>()
            .on('start', function (event) {
              d3.select(this).raise().classed('active', true);
              d3.select(this).style('cursor', 'grabbing');

              // 연결된 엣지 식별
              const node = d3.select(this);
              const nodeBox = (this as SVGGraphicsElement).getBBox();
              const transform = node.attr('transform');
              let tx = 0, ty = 0;
              if (transform) {
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (match) { tx = parseFloat(match[1]); ty = parseFloat(match[2]); }
              }

              // 노드의 절대 좌표(근사값)
              const absX = tx + nodeBox.x;
              const absY = ty + nodeBox.y;
              const absW = nodeBox.width;
              const absH = nodeBox.height;
              const margin = 10; // 여유 공간

              const connectedEdges: any[] = [];

              edges.each(function () {
                const path = d3.select(this);
                const d = path.attr('d');
                if (!d) return;

                const { start, end } = analyzeEdgePath(d);

                // 시작점이 노드 영역 안에 있는지
                const isStartConnected =
                  start.x >= absX - margin && start.x <= absX + absW + margin &&
                  start.y >= absY - margin && start.y <= absY + absH + margin;

                // 끝점이 노드 영역 안에 있는지
                const isEndConnected =
                  end.x >= absX - margin && end.x <= absX + absW + margin &&
                  end.y >= absY - margin && end.y <= absY + absH + margin;

                if (isStartConnected || isEndConnected) {
                  connectedEdges.push({
                    path: path,
                    isStart: isStartConnected,
                    isEnd: isEndConnected
                  });
                }
              });

              (this as any).__connectedEdges = connectedEdges;
            })
            .on('drag', function (event) {
              const node = d3.select(this);

              // 노드 이동
              const transform = node.attr('transform');
              let x = 0, y = 0;
              if (transform) {
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (match) {
                  x = parseFloat(match[1]);
                  y = parseFloat(match[2]);
                }
              }
              x += event.dx;
              y += event.dy;
              node.attr('transform', `translate(${x},${y})`);

              // 엣지 이동
              const connectedEdges = (this as any).__connectedEdges || [];
              connectedEdges.forEach((edge: any) => {
                const { path, isStart, isEnd } = edge;
                let d = path.attr('d');

                // Path 데이터 파싱 및 수정
                const tokens = d.trim().split(/(?=[MLCQTSZAHVmlcqtsahv])/);

                if (isStart) {
                  // 첫 번째 명령(M) 수정
                  const first = tokens[0];
                  if (first.startsWith('M')) {
                    const nums = first.slice(1).trim().split(/[\s,]+/).map(Number);
                    nums[0] += event.dx;
                    nums[1] += event.dy;
                    tokens[0] = `M${nums[0]},${nums[1]}`;
                  }
                }

                if (isEnd) {
                  // 마지막 명령 수정 (좌표가 있는 경우)
                  const lastIndex = tokens.length - 1;
                  const last = tokens[lastIndex];
                  const cmd = last[0];
                  // 숫자 추출
                  const nums = last.slice(1).match(/-?[\d.]+(?:e[-+]?\d+)?/g)?.map(Number);

                  if (nums && nums.length >= 2) {
                    // 마지막 두 숫자가 x, y 좌표임
                    nums[nums.length - 2] += event.dx;
                    nums[nums.length - 1] += event.dy;
                    tokens[lastIndex] = `${cmd}${nums.join(' ')}`;
                  }
                }

                path.attr('d', tokens.join(''));
              });
            })
            .on('end', function () {
              d3.select(this).classed('active', false);
              d3.select(this).style('cursor', 'grab');
            });

          nodes.style('cursor', 'grab').call(drag);
        }

      } catch (e) {
        console.error("Mermaid Render Error", e);
        mermaidRef.current.innerHTML = `<div class="p-8 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex flex-col items-center gap-4 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-circle"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <div>
            <p class="font-bold text-lg">시각화 코드 오류</p>
            <p class="text-sm opacity-80 mt-1">Mermaid 문법에 맞지 않는 부분이 있습니다. 이전 단계에서 코드를 수정해 주세요.</p>
          </div>
        </div>`;
      }
    }
  };

  useEffect(() => {
    if (step === 3 && step3ViewMode === 'visual') {
      renderMermaid();
      // Reset pan/zoom on new render
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [mermaidCode, step, step3ViewMode]);

  const copyToClipboard = () => {
    const el = document.createElement('textarea');
    el.value = mermaidCode;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  // ── 유틸: SVG path → { start, end, midPoints } 분석 ──
  function analyzeEdgePath(d: string): {
    start: { x: number; y: number };
    end: { x: number; y: number };
    mids: Array<{ x: number; y: number }>;
    isElbow: boolean;
  } {
    // 모든 좌표 추출
    const tokens = d.trim().split(/(?=[MLCQTSZAHVmlcqtsahv])/);
    const points: Array<{ x: number; y: number }> = [];
    let cx = 0, cy = 0;

    for (const token of tokens) {
      const cmd = token[0];
      const nums = (token.slice(1).match(/-?[\d.]+(?:e[-+]?\d+)?/g) || []).map(Number);

      if (cmd === 'M') { cx = nums[0]; cy = nums[1]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'L') { cx = nums[0]; cy = nums[1]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'C') {
        // cubic bezier: 제어점2개 + 끝점
        cx = nums[4]; cy = nums[5]; points.push({ x: cx, y: cy });
      }
      else if (cmd === 'Q') { cx = nums[2]; cy = nums[3]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'H') { cx = nums[nums.length - 1]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'V') { cy = nums[nums.length - 1]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'm') { cx += nums[0]; cy += nums[1]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'l') { cx += nums[0]; cy += nums[1]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'c') { cx += nums[4]; cy += nums[5]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'h') { cx += nums[nums.length - 1]; points.push({ x: cx, y: cy }); }
      else if (cmd === 'v') { cy += nums[nums.length - 1]; points.push({ x: cx, y: cy }); }
    }

    if (points.length < 2) {
      return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, mids: [], isElbow: false };
    }

    const start = points[0];
    const end = points[points.length - 1];
    const mids = points.slice(1, -1);

    // 직선 판별: 시작→끝 방향과 중간점들이 거의 일직선인지
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const THRESHOLD = 8; // px 허용 오차

    // 중간점들이 있거나, 시작→끝이 수평/수직이 아니면 꺾임선(Elbow)으로 간주
    const isElbow = points.length > 2 || !(dy < THRESHOLD || dx < THRESHOLD);

    return { start, end, mids, isElbow };
  }

  // ── 유틸: EMU 변환 (PPT 단위, 1인치 = 914400 EMU) ──
  function inToEmu(inches: number): number {
    return Math.round(inches * 914400);
  }

  // ── 유틸: OOXML connector XML 생성 ──
  function makeCxnSpXml(params: {
    id: number;
    name: string;
    x1_in: number; y1_in: number;
    x2_in: number; y2_in: number;
    isElbow: boolean;
    strokeHex: string;
    strokePt: number;
    hasArrow: boolean;
  }): string {
    const { id, name, x1_in, y1_in, x2_in, y2_in, isElbow, strokeHex, strokePt, hasArrow } = params;

    // bounding box 계산
    const lx = Math.min(x1_in, x2_in);
    const ly = Math.min(y1_in, y2_in);
    const rw = Math.abs(x2_in - x1_in);
    const rh = Math.abs(y2_in - y1_in);

    // EMU 변환
    const offX = inToEmu(lx);
    const offY = inToEmu(ly);
    const extCx = inToEmu(Math.max(rw, 0.001)); // 최소 크기 보장
    const extCy = inToEmu(Math.max(rh, 0.001));

    // 방향 flip: 끝점이 시작점보다 위/왼쪽이면 flip
    const flipH = x2_in < x1_in ? ' flipH="1"' : '';
    const flipV = y2_in < y1_in ? ' flipV="1"' : '';

    // connector 유형: 직선 vs L자 꺾임
    // bentConnector3 = 2번 꺾임 (표준 L자, PPT 기본 꺾임 연결선)
    const geomPreset = isElbow ? 'bentConnector3' : 'straightConnector1';

    // 선 두께 (EMU)
    const lineW = Math.round(strokePt * 12700); // 1pt = 12700 EMU

    // 화살표 XML
    const arrowXml = hasArrow
      ? `<a:tailEnd type="arrow" w="med" len="med"/>`
      : '';

    return `<p:cxnSp>
  <p:nvCxnSpPr>
    <p:cNvPr id="${id}" name="${name}"/>
    <p:cNvCxnSpPr/>
    <p:nvPr/>
  </p:nvCxnSpPr>
  <p:spPr>
    <a:xfrm${flipH}${flipV}>
      <a:off x="${offX}" y="${offY}"/>
      <a:ext cx="${extCx}" cy="${extCy}"/>
    </a:xfrm>
    <a:prstGeom prst="${geomPreset}">
      <a:avLst/>
    </a:prstGeom>
    <a:ln w="${lineW}">
      <a:solidFill>
        <a:srgbClr val="${strokeHex}"/>
      </a:solidFill>
      <a:headEnd type="none"/>
      ${arrowXml}
    </a:ln>
  </p:spPr>
</p:cxnSp>`;
  }

  const downloadExport = async (platform: 'Figma' | 'PPT') => {
    if (!mermaidRef.current) return;
    const svgElement = mermaidRef.current.querySelector('svg');
    if (!svgElement) return;

    // ── Figma: SVG 표준화 후 다운로드 (Figma는 foreignObject를 지원하지 않음) ──
    if (platform === 'Figma') {
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

      // 1. foreignObject를 <text>로 변환 (Figma 호환성 핵심)
      const fos = clonedSvg.querySelectorAll('foreignObject');
      fos.forEach(fo => {
        const div = fo.querySelector('div');
        if (div) {
          // innerText를 사용하여 텍스트와 아이콘(텍스트 형태) 추출
          const text = (div as HTMLElement).innerText || div.textContent || '';
          const x = parseFloat(fo.getAttribute('x') || '0');
          const y = parseFloat(fo.getAttribute('y') || '0');
          const width = parseFloat(fo.getAttribute('width') || '0');
          const height = parseFloat(fo.getAttribute('height') || '0');

          const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          // 중앙 정렬 계산
          textEl.setAttribute('x', (x + width / 2).toString());
          textEl.setAttribute('y', (y + height / 2).toString());
          textEl.setAttribute('text-anchor', 'middle');
          textEl.setAttribute('dominant-baseline', 'central');
          textEl.setAttribute('font-family', 'Pretendard, -apple-system, sans-serif');
          textEl.setAttribute('font-size', '14px');
          textEl.setAttribute('fill', '#1e293b');
          textEl.textContent = text;

          fo.parentNode?.replaceChild(textEl, fo);
        }
      });

      // 2. 스타일 인라인화 (Figma는 내부 <style> 태그를 무시하는 경우가 많음)
      const styleTag = clonedSvg.querySelector('style');
      if (styleTag) {
        // 스타일 태그는 유지하되, 중요한 노드들에 대해 기본 폰트 적용
        clonedSvg.querySelectorAll('text').forEach(t => {
          t.style.fontFamily = 'Pretendard, -apple-system, sans-serif';
        });
      }

      // 3. 크기 및 viewBox 설정
      const viewBox = clonedSvg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/\s+|,/);
        clonedSvg.setAttribute('width', parts[2]);
        clonedSvg.setAttribute('height', parts[3]);
      }

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${info.flowName || 'Flow'}_Figma.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // ══════════════════════════════════════════════════════════
    // PPT 내보내기
    // ══════════════════════════════════════════════════════════
    try {
      const pptx = new pptxgen();

      // ── SVG 크기 파악 ──
      const viewBox = svgElement.getAttribute('viewBox');
      let svgW = svgElement.getBoundingClientRect().width || 1200;
      let svgH = svgElement.getBoundingClientRect().height || 800;
      if (viewBox) {
        const parts = viewBox.trim().split(/\s+|,/);
        if (parts.length >= 4) {
          svgW = parseFloat(parts[2]) || svgW;
          svgH = parseFloat(parts[3]) || svgH;
        }
      }

      // ── 슬라이드 크기 (SVG 비율 유지, 와이드 기준) ──
      const SLIDE_W = 13.33;
      const MARGIN = 0.25;
      const aspectRatio = svgH / svgW;
      const SLIDE_H = Math.max(5, Math.min(10, SLIDE_W * aspectRatio + MARGIN * 2));

      pptx.defineLayout({ name: 'FLOW', width: SLIDE_W, height: SLIDE_H });
      pptx.layout = 'FLOW';
      const slide = pptx.addSlide();

      // ── 좌표 변환 스케일 ──
      const scale = Math.min(
        (SLIDE_W - MARGIN * 2) / svgW,
        (SLIDE_H - MARGIN * 2) / svgH
      );
      const offsetX = MARGIN + (SLIDE_W - MARGIN * 2 - svgW * scale) / 2;
      const offsetY = MARGIN + (SLIDE_H - MARGIN * 2 - svgH * scale) / 2;
      const px2in = (px: number) => px * scale;

      // ── 헬퍼들 ──
      const parseTranslate = (el: Element) => {
        const t = el.getAttribute('transform') || '';
        const m = t.match(/translate\(\s*([^,\s)]+)[,\s]+([^)]+)\)/);
        return m ? { x: parseFloat(m[1]) || 0, y: parseFloat(m[2]) || 0 } : { x: 0, y: 0 };
      };

      const toHex = (color: string | null | undefined): string => {
        if (!color || color === 'none' || color === 'transparent') return 'FFFFFF';
        const c = color.trim();
        if (c.startsWith('#')) {
          const h = c.slice(1);
          return (h.length === 3 ? h.split('').map(x => x + x).join('') : h).toUpperCase().padStart(6, '0');
        }
        const rgb = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgb) return [rgb[1], rgb[2], rgb[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase();
        return '64748B';
      };

      const getColor = (el: Element, attr: 'fill' | 'stroke'): string => {
        const attrVal = el.getAttribute(attr);
        if (attrVal && attrVal !== 'none') return toHex(attrVal);
        try {
          const cs = window.getComputedStyle(el as HTMLElement);
          return toHex(attr === 'fill' ? cs.fill : cs.stroke);
        } catch { return attr === 'fill' ? 'FFFFFF' : '64748B'; }
      };

      const getBBox = (el: Element): DOMRect | null => {
        try { return (el as SVGGraphicsElement).getBBox(); } catch { return null; }
      };

      // ── STEP 1: 클러스터(Subgraph) 배경 ──
      svgElement.querySelectorAll('g.cluster, g.subgraph').forEach((cluster) => {
        const rect = cluster.querySelector('rect');
        if (!rect) return;
        const bbox = getBBox(rect);
        if (!bbox) return;
        const ct = parseTranslate(cluster);

        slide.addShape(pptx.ShapeType.rect, {
          x: offsetX + px2in(bbox.x + ct.x),
          y: offsetY + px2in(bbox.y + ct.y),
          w: px2in(bbox.width),
          h: px2in(bbox.height),
          fill: { color: toHex(rect.getAttribute('fill')) || 'F8FAFC', transparency: 85 },
          line: { color: toHex(rect.getAttribute('stroke')) || 'CBD5E1', width: 0.75, dashType: 'dash' },
        });

        const labelEl = cluster.querySelector('.cluster-label text, .nodeLabel, text');
        if (labelEl) {
          const lt = labelEl.textContent?.trim();
          const lbbox = getBBox(labelEl);
          if (lt && lbbox) {
            slide.addText(lt, {
              x: offsetX + px2in(lbbox.x + ct.x),
              y: offsetY + px2in(lbbox.y + ct.y),
              w: px2in(lbbox.width + 20),
              h: px2in(lbbox.height + 4),
              fontSize: 8, bold: true, color: '475569', align: 'left',
            });
          }
        }
      });

      // ── STEP 2: 노드 (도형 + 텍스트 일체화) ──
      svgElement.querySelectorAll('g.node, g.node-label').forEach((nodeEl) => {
        const t = parseTranslate(nodeEl);
        const shapeEl = nodeEl.querySelector('rect, polygon, circle, ellipse');
        if (!shapeEl) return;

        const tag = shapeEl.tagName.toLowerCase();
        const fillColor = getColor(shapeEl, 'fill');
        const strokeColor = getColor(shapeEl, 'stroke');
        const strokeW = parseFloat(shapeEl.getAttribute('stroke-width') || '2');
        const lineW = Math.max(0.75, strokeW * scale * 72);

        let sx = 0, sy = 0, sw = 0, sh = 0;
        let shapeType: string = pptx.ShapeType.rect;

        if (tag === 'rect') {
          sx = t.x + parseFloat(shapeEl.getAttribute('x') || '0');
          sy = t.y + parseFloat(shapeEl.getAttribute('y') || '0');
          sw = parseFloat(shapeEl.getAttribute('width') || '120');
          sh = parseFloat(shapeEl.getAttribute('height') || '40');
          shapeType = pptx.ShapeType.rect;
        } else if (tag === 'circle' || tag === 'ellipse') {
          const cx = parseFloat(shapeEl.getAttribute('cx') || '0');
          const cy = parseFloat(shapeEl.getAttribute('cy') || '0');
          const rx = parseFloat(shapeEl.getAttribute('rx') || shapeEl.getAttribute('r') || '30');
          const ry = parseFloat(shapeEl.getAttribute('ry') || shapeEl.getAttribute('r') || '30');
          sx = t.x + cx - rx; sy = t.y + cy - ry; sw = rx * 2; sh = ry * 2;
          shapeType = pptx.ShapeType.ellipse;
        } else if (tag === 'polygon') {
          const bbox = getBBox(shapeEl);
          if (bbox) { sx = t.x + bbox.x; sy = t.y + bbox.y; sw = bbox.width; sh = bbox.height; }
          shapeType = pptx.ShapeType.diamond;
        }

        if (sw <= 0 || sh <= 0) return;

        // 텍스트 추출 (innerText를 사용하여 아이콘 등 포함)
        let nodeText = '';
        const fo = nodeEl.querySelector('foreignObject');
        if (fo) {
          const div = fo.querySelector('span, p, div');
          if (div) nodeText = (div as HTMLElement).innerText || div.textContent || '';
        }
        if (!nodeText) nodeText = nodeEl.querySelector('text, tspan')?.textContent?.trim() || '';
        if (!nodeText) nodeText = nodeEl.querySelector('.label')?.textContent?.trim() || '';

        // 폰트 크기
        const textEl = nodeEl.querySelector('text, span, div, p');
        let rawFs = 13;
        if (textEl) {
          try { rawFs = parseFloat(window.getComputedStyle(textEl as HTMLElement).fontSize) || 13; } catch { }
        }
        const fontPt = Math.max(7, Math.round(rawFs * scale * 0.75));

        // 도형+텍스트 일체화
        slide.addText(nodeText || '', {
          x: offsetX + px2in(sx),
          y: offsetY + px2in(sy),
          w: px2in(sw),
          h: px2in(sh),
          shape: shapeType as any,
          fill: { color: fillColor },
          line: { color: strokeColor, width: lineW },
          fontSize: fontPt,
          color: '1e293b',
          bold: false,
          align: 'center',
          valign: 'middle',
          wrap: true,
          margin: 3,
        });
      });

      // ── STEP 3: 엣지 레이블 ──
      svgElement.querySelectorAll('g.edgeLabels g.edgeLabel, g.edgeLabel').forEach((labelG) => {
        const textContent =
          labelG.querySelector('span, div, p')?.textContent?.trim() ||
          labelG.querySelector('text')?.textContent?.trim();
        if (!textContent) return;
        const bbox = getBBox(labelG);
        if (!bbox) return;

        slide.addText(textContent, {
          x: offsetX + px2in(bbox.x),
          y: offsetY + px2in(bbox.y),
          w: Math.max(px2in(bbox.width), 0.3),
          h: Math.max(px2in(bbox.height), 0.15),
          fontSize: 8, color: '475569', align: 'center', italic: true,
          fill: { color: 'FFFFFF', transparency: 10 },
        });
      });

      // ── STEP 4: 제목 ──
      slide.addText(info.flowName || 'Flow Diagram', {
        x: MARGIN, y: 0.05, w: SLIDE_W - MARGIN * 2, h: 0.25,
        fontSize: 12, bold: true, color: '1e40af', align: 'left',
      });

      // ══════════════════════════════════════════════════════
      // STEP 5: Edge 연결선 → OOXML cxnSp XML 직접 주입
      // pptxgenjs가 생성한 PPTX를 JSZip으로 열어서
      // slide1.xml에 <p:cxnSp> connector 요소 삽입
      // ══════════════════════════════════════════════════════

      // Edge 정보 수집 (pptx.writeFile 전에 미리)
      interface EdgeInfo {
        x1: number; y1: number; x2: number; y2: number;
        isElbow: boolean;
        strokeHex: string;
        strokePt: number;
      }
      const edgeInfos: EdgeInfo[] = [];

      const edgePaths = svgElement.querySelectorAll(
        'g.edgePaths path, g.edgePath path, path.edge-thickness-normal, path[class*="flowchart-link"], .edgePath > path'
      );

      edgePaths.forEach((path) => {
        const d = path.getAttribute('d');
        if (!d) return;

        const { start, end, isElbow } = analyzeEdgePath(d);
        if (start.x === 0 && start.y === 0 && end.x === 0 && end.y === 0) return;

        const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        if (dist < 5) return; // 너무 짧으면 스킵

        const strokeAttr = path.getAttribute('stroke');
        const strokeW = parseFloat(
          path.getAttribute('stroke-width') ||
          (() => { try { return window.getComputedStyle(path as HTMLElement).strokeWidth; } catch { return '2'; } })()
        ) || 2;

        edgeInfos.push({
          x1: offsetX + px2in(start.x),
          y1: offsetY + px2in(start.y),
          x2: offsetX + px2in(end.x),
          y2: offsetY + px2in(end.y),
          isElbow,
          strokeHex: strokeAttr ? toHex(strokeAttr) : '64748B',
          strokePt: Math.max(0.75, strokeW * scale * 72),
        });
      });

      // pptxgenjs로 기본 파일 생성 (Blob으로)
      const pptxBlob: Blob = await pptx.write({ outputType: 'blob' }) as Blob;

      // JSZip으로 열기
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(pptxBlob);

      // slide1.xml 찾기 (슬라이드 파일명이 다를 수 있음)
      const slideFileName = Object.keys(zip.files).find(
        name => name.match(/ppt\/slides\/slide\d+\.xml/)
      );

      if (slideFileName && edgeInfos.length > 0) {
        let slideXml = await zip.files[slideFileName].async('string');

        // 현재 최대 shape id 파악 (충돌 방지)
        const idMatches: string[] = slideXml.match(/id="(\d+)"/g) || [];
        let maxId = idMatches.reduce((max: number, m: string) => {
          const n = parseInt(m.replace(/[^\d]/g, ''));
          return n > max ? n : max;
        }, 100);

        // 각 edge를 cxnSp XML로 생성
        const cxnSpXmls = edgeInfos.map((edge, idx) => {
          maxId++;
          return makeCxnSpXml({
            id: maxId,
            name: `${edge.isElbow ? 'Elbow' : 'Straight'} Arrow ${idx + 1}`,
            x1_in: edge.x1,
            y1_in: edge.y1,
            x2_in: edge.x2,
            y2_in: edge.y2,
            isElbow: edge.isElbow,
            strokeHex: edge.strokeHex,
            strokePt: Math.max(1, edge.strokePt),
            hasArrow: true,
          });
        });

        // </p:spTree> 바로 앞에 cxnSp 요소들 삽입
        const insertPoint = '</p:spTree>';
        if (slideXml.includes(insertPoint)) {
          slideXml = slideXml.replace(
            insertPoint,
            cxnSpXmls.join('\n') + '\n' + insertPoint
          );
          zip.file(slideFileName, slideXml);
        }
      }

      // 수정된 ZIP을 Blob으로 변환 후 다운로드
      const finalBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });

      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${info.flowName || 'FlowDiagram'}_편집가능.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (err: any) {
      console.error('PPT Export Error:', err);
      alert('PPT 내보내기 오류: ' + (err?.message || err));
    }
  };

  // Canvas Pan & Zoom Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      setZoom(z => Math.min(Math.max(0.1, z - e.deltaY * zoomSensitivity), 3));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag canvas if not clicking on a node
    if ((e.target as HTMLElement).closest('.node')) return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // --- UI 컴포넌트 ---

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans leading-relaxed overflow-hidden">
      {/* Navigation Header */}
      <nav className="flex-none bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tighter">VIBE <span className="text-blue-600">FLOW</span></h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Senior Planner Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {[1, 2, 3].map((num) => (
              <div key={num} className={`flex items-center gap-2 text-xs font-bold transition-all ${step === num ? 'text-blue-600' : 'text-slate-300'}`}>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${step === num ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>{num}</span>
                <span className="hidden sm:inline">{num === 1 ? 'INPUT' : num === 2 ? 'VERIFY' : 'VISUALIZE'}</span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden p-4 md:p-6">

        {/* Step 1: 정보 입력 */}
        {step === 1 && (
          <div className="h-full max-w-5xl mx-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="text-center space-y-1 flex-none">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">바이브코딩 업무 프로세스 설계</h2>
              <p className="text-slate-500 text-sm">지침에 따른 정형화된 산출물 생성을 위해 기본 정보를 입력하세요.</p>
            </header>

            <div className="flex-1 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">DOMAIN / INDUSTRY</label>
                      <div className="flex flex-wrap gap-2">
                        {['금융', '유통/커머스', '공공', '통신', '제조', '엔터/미디어', '헬스케어', '직접입력'].map(type => (
                          <button
                            key={type}
                            onClick={() => setInfo(prev => ({ ...prev, domain: type }))}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${info.domain === type ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                      {info.domain === '직접입력' && (
                        <input
                          name="customDomain"
                          value={info.customDomain}
                          onChange={handleInfoChange}
                          placeholder="도메인이나 산업군을 직접 입력하세요 (예: 에듀테크)"
                          className="w-full mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm animate-in fade-in zoom-in-95 duration-200"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SERVICE NAME</label>
                      <input
                        name="serviceName"
                        value={info.serviceName}
                        onChange={handleInfoChange}
                        placeholder="예: 현대백화점 통합 로그인"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Flow Name</label>
                      <input
                        name="flowName"
                        value={info.flowName}
                        onChange={handleInfoChange}
                        placeholder="예: 간편 본인인증 및 회원가입 흐름"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Channel</label>
                      <div className="flex flex-wrap gap-2">
                        {['Web', 'App', 'Admin', 'Kiosk', 'Event'].map(type => (
                          <button
                            key={type}
                            onClick={() => setInfo(prev => ({ ...prev, serviceType: type }))}
                            className={`flex-1 py-2.5 rounded-lg font-bold text-xs transition-all ${info.serviceType === type ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Process Description</label>
                        <button
                          onClick={generateAutoDescription}
                          disabled={isGeneratingDesc || !info.serviceName || !info.flowName || !info.serviceType}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 disabled:text-slate-400 flex items-center gap-1 transition-colors"
                          title="SERVICE NAME, Flow Name, Channel을 기반으로 AI가 내용을 자동 완성합니다."
                        >
                          {isGeneratingDesc ? <RefreshCw className="animate-spin" size={12} /> : <Sparkles size={12} />}
                          AI 자동 작성
                        </button>
                      </div>
                      <textarea
                        name="flowDesc"
                        value={info.flowDesc}
                        onChange={handleInfoChange}
                        rows={4}
                        placeholder="프로세스의 주요 단계와 목적을 자유롭게 기술하세요."
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-medium text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <input
                        type="checkbox"
                        id="exceptions"
                        name="includeExceptions"
                        checked={info.includeExceptions}
                        onChange={handleInfoChange}
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <label htmlFor="exceptions" className="text-xs font-bold text-blue-900 cursor-pointer">예외 처리 로직 강제 포함 (권한, 에러, 타임아웃 등)</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <Info size={12} /> Reference Policies & Rules
                  </label>
                  <textarea
                    name="policy"
                    value={info.policy}
                    onChange={handleInfoChange}
                    rows={8}
                    placeholder="참고할 법령, 서비스 정책, 이용약관 등을 입력하면 더 정확한 흐름을 제안합니다."
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none font-mono text-xs leading-relaxed"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-xs font-bold border border-red-100 flex-none">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div className="flex justify-center flex-none">
                <button
                  onClick={generateInitialFlow}
                  disabled={loading || !info.serviceName || !info.flowName || !info.serviceType}
                  className="group flex items-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-black text-base transition-all shadow-xl shadow-blue-200 transform hover:-translate-y-0.5 active:scale-95"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                  <span>바이브코딩 분석 시작</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 구조화 및 검증 (리포트 & 코드) */}
        {step === 2 && (
          <div className="h-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-none">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">업무 구조화 및 코드 검증</h2>
                <p className="text-slate-500 text-xs mt-0.5">리포트와 코드를 확인하고 필요한 부분을 직접 수정하세요.</p>
              </div>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 text-sm"
              >
                시각화 생성 및 검증 <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
              {/* Left: 구조화 리포트 */}
              <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-black text-slate-900 text-xs flex items-center gap-2">
                    <FileText size={14} className="text-blue-600" /> 업무 구조화 리포트
                  </h3>
                  <button onClick={() => setStep(1)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400">
                    <ArrowLeft size={14} />
                  </button>
                </div>
                <textarea
                  value={structuredPlan}
                  onChange={(e) => setStructuredPlan(e.target.value)}
                  className="flex-1 p-6 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium bg-transparent outline-none resize-none custom-scrollbar"
                  placeholder="분석 결과를 생성 중입니다..."
                  spellCheck="false"
                />
              </div>

              {/* Right: Mermaid Source */}
              <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Code size={12} className="text-emerald-400" /> Mermaid Source
                  </h3>
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                    title="코드 복사"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <textarea
                  value={mermaidCode}
                  onChange={(e) => setMermaidCode(e.target.value)}
                  className="flex-1 p-6 font-mono text-xs text-emerald-400 bg-transparent outline-none resize-none leading-relaxed custom-scrollbar"
                  spellCheck="false"
                />
              </div>
            </div>

            {/* AI 수정 프롬프트 */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-3 flex flex-col md:flex-row gap-3 items-center flex-none">
              <div className="flex-1 w-full relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
                  <Settings size={18} />
                </div>
                <input
                  type="text"
                  value={refinePrompt}
                  onChange={(e) => setRefinePrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refineFlow()}
                  placeholder="예: 상품구입 프로세스를 도출하였으나 슬라이드로 밀어서 결제요청하기 기능 추가해줘"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-medium text-xs"
                />
              </div>
              <button
                onClick={refineFlow}
                disabled={isRefining || !refinePrompt.trim()}
                className="w-full md:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap text-xs"
              >
                {isRefining ? <RefreshCw className="animate-spin" size={16} /> : <Edit3 size={16} />}
                AI 수정 반영
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 최종 시각화 및 내보내기 */}
        {step === 3 && (
          <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 overflow-hidden">
            <div className="flex-1 bg-white rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30 flex-none">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
                    <Eye size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tighter leading-tight">{info.flowName}</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] mt-0.5">
                      {info.serviceName} • 캔버스 드래그 및 노드 이동 가능
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
                    <button
                      onClick={() => downloadExport('Figma')}
                      className="px-4 py-2.5 bg-[#F24E1E] text-white rounded-xl font-black hover:bg-[#D13D14] transition-all flex items-center gap-1.5 text-xs shadow-lg shadow-orange-100"
                    >
                      <Download size={16} /> Figma 다운로드
                    </button>
                    <button
                      onClick={() => downloadExport('PPT')}
                      className="px-4 py-2.5 bg-[#D04423] text-white rounded-xl font-black hover:bg-[#A8351A] transition-all flex items-center gap-1.5 text-xs shadow-lg shadow-red-100"
                    >
                      <Download size={16} /> PPT 다운로드
                    </button>
                  </div>
                </div>
              </div>

              {/* View Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Interactive Canvas Area */}
                  <div
                    ref={svgContainerRef}
                    className={`flex-1 bg-[#FAFAFA] overflow-hidden relative ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center origin-center"
                      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                    >
                      <div ref={mermaidRef} className="w-full h-full flex items-center justify-center"></div>
                    </div>

                    {/* Zoom Controls */}
                    <div className="absolute bottom-4 right-4 flex bg-white shadow-lg rounded-lg border border-slate-200 overflow-hidden z-10">
                      <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-slate-50 text-slate-600 border-r border-slate-200">
                        <ZoomOut size={16} />
                      </button>
                      <div className="p-2 text-xs font-bold text-slate-600 flex items-center justify-center w-12">
                        {Math.round(zoom * 100)}%
                      </div>
                      <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-2 hover:bg-slate-50 text-slate-600 border-l border-slate-200">
                        <ZoomIn size={16} />
                      </button>
                      <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 hover:bg-slate-50 text-blue-600 border-l border-slate-200" title="Reset View">
                        <Maximize size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <footer className="text-center text-slate-400 text-[11px] font-bold tracking-widest uppercase py-4 flex-none">
              Vibe Coding Standard • Developed for Professional Service Planning
            </footer>
          </div>
        )}
      </main>

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
}
