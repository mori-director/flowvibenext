const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Update Imports
code = code.replace("import mermaid from 'mermaid';", "import FlowEditor from './components/FlowEditor';\nimport { exportPPT, exportImage } from './utils/exportUtils';");
code = code.replace("import * as d3 from 'd3';", "");
code = code.replace("import pptxgen from 'pptxgenjs';", "");
code = code.replace(/mermaid\.initialize\([\s\S]*?\}\);/, "");

// 2. Update States
code = code.replace("const [mermaidCode, setMermaidCode] = useState('');", "const [flowNodes, setFlowNodes] = useState<any[]>([]);\n  const [flowEdges, setFlowEdges] = useState<any[]>([]);\n  const [jsonCode, setJsonCode] = useState('');");
code = code.replace(/const mermaidRef = useRef<HTMLDivElement>\(null\);[\s\S]*?const \[dragStart, setDragStart\] = useState\(\{ x: 0, y: 0 \}\);/, "");

// 3. Update generateInitialFlow
const oldGenerateInitialFlow = code.match(/const generateInitialFlow = async \(\) => \{[\s\S]*?setLoading\(false\);\n    \}\n  \};/)[0];

const newGenerateInitialFlow = `const generateInitialFlow = async () => {
    if (!info.serviceName || !info.flowName || !info.serviceType) {
      setError("SERVICE NAME, Flow Name, Channel은 필수 입력 사항입니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const systemPrompt = \`당신은 화면설계서를 작성하는 기획자입니다.
지침에 따라 사용자의 서비스 요건을 분석하여 업무 구조화 리포트를 작성하고, 시각적 플로우차트를 생성하기 위한 노드(Node)와 엣지(Edge) 구조체를 JSON 형태로 도출하십시오.

[필수 지침]
1. 프론트엔드/UX 관점의 흐름만 작성하며, 백엔드/DB 로직은 일반 프로세스나 판단(decision) 노드로 표현하세요.
2. 예외(어뷰징 등) 처리와 앱심사 지침 등을 분기로 표현해야 합니다.
3. 데이터 타입:
   - type: "startEnd" | "process" | "decision" | "database" | "external"
4. JSON 안의 속성을 완벽히 맞추시오.\`;

    const userPrompt = \`[기본 정보]
- Domain: \${info.domain === '직접입력' ? info.customDomain : info.domain}
- SERVICE NAME: \${info.serviceName}
- Flow Name: \${info.flowName}
- 상세설명: \${info.flowDesc}
- Channel: \${info.serviceType}
- 참고정책: \${info.policy}
- 예외처리포함여부: \${info.includeExceptions ? 'YES' : 'NO'}

위 정보를 바탕으로 JSON 구조를 도출해줘.\`;

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
              analysis: { type: Type.STRING },
              nodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, label: {type: Type.STRING}, type: {type: Type.STRING} } } },
              edges: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, source: {type: Type.STRING}, target: {type: Type.STRING}, label: {type: Type.STRING} } } }
            }
          }
        }
      });

      const text = response.text || "{}";
      const result = JSON.parse(text);
      setStructuredPlan(result.analysis || '');
      setJsonCode(JSON.stringify(result, null, 2));
      
      // Assign specific data structure for React Flow
      const rNodes = (result.nodes || []).map((n: any) => ({
         id: n.id,
         type: n.type,
         data: { label: n.label }
      }));
      const rEdges = (result.edges || []).map((e: any, idx: number) => ({
         id: e.id || \`e-\${idx}\`,
         source: e.source,
         target: e.target,
         label: e.label || ''
      }));

      setFlowNodes(rNodes);
      setFlowEdges(rEdges);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };`;

code = code.replace(oldGenerateInitialFlow, newGenerateInitialFlow);

// 4. Update refineFlow
const oldRefineFlow = code.match(/const refineFlow = async \(\) => \{[\s\S]*?setIsRefining\(false\);\n    \}\n  \};/)[0];
const newRefineFlow = `const refineFlow = async () => {
    if (!refinePrompt.trim()) return;

    setIsRefining(true);
    setError(null);

    const systemPrompt = \`당신은 화면설계서를 작성하는 기획자입니다.
사용자의 추가 요청사항을 반영하여 기존 JSON 다이아그램 데이터를 수정하십시오.
기존과 동일한 JSON 포맷을 반환하되, '추가 요청사항'에 따라 노드와 엣지를 추가, 수정, 삭제한 "전체" JSON 코드를 보내세요.\`;

    const userPrompt = \`
[기존 다이아그램]
\${jsonCode}

[추가 요청사항]
\${refinePrompt}

위 추가 요청사항을 반영하여 완전히 수정된 새 JSON 구조체를 반환해줘.\`;

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
              analysis: { type: Type.STRING },
              nodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, label: {type: Type.STRING}, type: {type: Type.STRING} } } },
              edges: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: {type: Type.STRING}, source: {type: Type.STRING}, target: {type: Type.STRING}, label: {type: Type.STRING} } } }
            }
          }
        }
      });

      const text = response.text || "{}";
      const result = JSON.parse(text);
      setStructuredPlan(result.analysis || '');
      setJsonCode(JSON.stringify(result, null, 2));
      
      const rNodes = (result.nodes || []).map((n: any) => ({
         id: n.id,
         type: n.type,
         data: { label: n.label }
      }));
      const rEdges = (result.edges || []).map((e: any, idx: number) => ({
         id: e.id || \`e-\${idx}\`,
         source: e.source,
         target: e.target,
         label: e.label || ''
      }));

      setFlowNodes(rNodes);
      setFlowEdges(rEdges);
      setRefinePrompt('');
      if(step === 2) setStep(3); // Go to visualize if editing from step 2
    } catch (err: any) {
      setError(err.message || 'AI 수정 중 오류가 발생했습니다.');
    } finally {
      setIsRefining(false);
    }
  };`;

code = code.replace(oldRefineFlow, newRefineFlow);

// 5. Remove old SVG math and PPT logic
const downloadExportStart = code.search('const px2in');
const downloadExportEnd = code.indexOf('};\n\n  return (', downloadExportStart);
const downloadExportCode = code.substring(downloadExportStart, downloadExportEnd + 1);

const newDownloadExport = `const downloadExport = async (type: 'Figma' | 'PPT') => {
    try {
      if (type === 'PPT') {
        const flowData = (window as any).__flowState || { nodes: flowNodes, edges: flowEdges };
        await exportPPT(flowData.nodes, flowData.edges, info.flowName);
      } else {
        await exportImage('.react-flow', info.flowName);
      }
    } catch (err) {
      console.error(err);
      alert('출력 중 오류가 발생했습니다.');
    }
  }`;

code = code.replace(downloadExportCode, `// Removed SVG ppt export math\n  ${newDownloadExport}`);

// 6. Update Render Code at Step 2 to remove "Mermaid Source" text
code = code.replace(/<Code size=\{12\} className="text-emerald-400" \/> Mermaid Source/g, '<Code size={12} className="text-emerald-400" /> JSON Data');
code = code.replace(/value=\{mermaidCode\}/g, 'value={jsonCode}');
code = code.replace(/setMermaidCode/g, 'setJsonCode');

// 7. Update Step 3 rendering
const viewAreaStart = code.indexOf('{/* View Area */}');
const step3End = code.indexOf('{/* Step 3: 최종 시각화 및 내보내기 */}'); // To get context
const viewAreaEnd = code.indexOf('{/* Background Decor */}'); 
const replaceRegex = /\{\/\* View Area \*\/\}([\s\S]*?)<\/div>\n\n            <footer/g;

const newReactFlowJSX = `{/* View Area */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                <FlowEditor
                  initialNodes={flowNodes}
                  initialEdges={flowEdges}
                  onExportPPT={() => downloadExport('PPT')}
                  onExportFigma={() => downloadExport('Figma')}
                />
              </div>
            </div>

            <footer`;

code = code.replace(replaceRegex, newReactFlowJSX);

// Extra old code cleanup
code = code.replace(/const downloadExport = async[\s\S]*?\{[\s\S]*?alert\('완료!'\);\n  \};/g, newDownloadExport);
// since the previous regex might fail depending on what's before return (

fs.writeFileSync('src/App.tsx', code);
console.log('Successfully refactored App.tsx');
