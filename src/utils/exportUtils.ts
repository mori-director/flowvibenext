import pptxgen from "pptxgenjs";
import JSZip from "jszip";
import * as htmlToImage from "html-to-image";

const EMU = 914400; // 1 inch = 914400 EMU

/** Map handle name → PPT connection point index (0=top,1=right,2=bottom,3=left) */
function handleToIdx(handle: string): number {
  if (handle?.includes("top")) return 0;
  if (handle?.includes("right")) return 1;
  if (handle?.includes("bottom")) return 2;
  if (handle?.includes("left")) return 3;
  return 2;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Get connection point position in EMU */
function connPt(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  idx: number,
): { x: number; y: number } {
  if (idx === 0) return { x: sx + sw / 2, y: sy };
  if (idx === 1) return { x: sx + sw, y: sy + sh / 2 };
  if (idx === 2) return { x: sx + sw / 2, y: sy + sh };
  return { x: sx, y: sy + sh / 2 }; // idx 3
}

export const exportPPT = async (
  nodes: any[],
  edges: any[],
  flowName: string,
) => {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.8,
    fill: { color: "F1F5F9" },
  });
  slide.addText(`🚀 FlowCraft: ${flowName}`, {
    x: 0.5,
    y: 0.2,
    w: "40%",
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: "1E293B",
  });

  // --- Add Legend to Right Side ---
  const legendItems = [
    { label: "화면", shape: pptx.ShapeType.roundRect, fill: "FFFFFF", line: { color: "1E293B", width: 2 }, textColor: "1E293B" },
    { label: "액션", shape: pptx.ShapeType.roundRect, fill: "DBEAFE", line: { color: "3B82F6", width: 2 }, textColor: "1D4ED8" },
    { label: "프로세스", shape: pptx.ShapeType.rect, fill: "FFFFFF", line: { color: "3B82F6", width: 2 }, textColor: "1E293B" },
    { label: "분기/판단", shape: pptx.ShapeType.diamond, fill: "FFF9C4", line: { color: "FBC02D", width: 2 }, textColor: "1E293B" },
    { label: "DB", shape: pptx.ShapeType.flowChartMagneticDisk, fill: "E8F5E9", line: { color: "4CAF50", width: 2 }, textColor: "1E293B" },
  ];
  let legendX = 6.5; // 시작 X 위치
  legendItems.forEach((item) => {
    slide.addText(item.label, {
      shape: item.shape,
      x: legendX,
      y: 0.25,
      w: 1.1,
      h: 0.35,
      fill: { color: item.fill },
      line: item.line,
      fontSize: 10,
      color: item.textColor,
      bold: true,
      align: "center",
      valign: "middle",
    });
    legendX += 1.3;
  });

  const SCALE = 0.012;
  const offX = 0.5;
  const offY = 1.0;

  // Store node positions in EMU for connector calculation
  const nPos: Record<string, { x: number; y: number; w: number; h: number }> =
    {};

  // Add shapes (nodes only — NO edges drawn by pptxgenjs)
  nodes.forEach((node) => {
    let shape = pptx.ShapeType.rect;
    let fill = "FFFFFF";
    let line: any = { color: "3B82F6", width: 2 };

    let textColor = "1E293B";

    if (node.type === "startEnd") {
      shape = pptx.ShapeType.roundRect;
      fill = "1E293B";
      line = { color: "1E293B", width: 1 };
      textColor = "FFFFFF";
    } else if (node.type === "decision") {
      shape = pptx.ShapeType.diamond;
      fill = "FFF9C4";
      line = { color: "FBC02D", width: 2 };
    } else if (node.type === "database") {
      shape = pptx.ShapeType.flowChartMagneticDisk;
      fill = "E8F5E9";
      line = { color: "4CAF50", width: 2 };
    } else if (node.type === "screen") {
      shape = pptx.ShapeType.roundRect;
      fill = "FFFFFF";
      line = { color: "1E293B", width: 2 };
    } else if (node.type === "action") {
      shape = pptx.ShapeType.roundRect;
      fill = "DBEAFE";
      line = { color: "3B82F6", width: 2 };
      textColor = "1D4ED8";
    }

    const x = offX + node.position.x * SCALE;
    const y = offY + node.position.y * SCALE;
    const w =
      (node.measured?.width || (node.type === "decision" ? 160 : 150)) * SCALE;
    const h =
      (node.measured?.height || (node.type === "decision" ? 80 : 50)) * SCALE;

    nPos[node.id] = { x: x * EMU, y: y * EMU, w: w * EMU, h: h * EMU };

    slide.addText(node.data.label, {
      shape,
      x,
      y,
      w,
      h,
      fill: { color: fill },
      line,
      fontSize: 10,
      color: textColor,
      bold: true,
      align: "center",
      valign: "middle",
    });
  });

  // --- STEP 1: Get PPTX as arraybuffer ---
  const buf = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;

  // --- STEP 2: Open ZIP, read slide XML ---
  const zip = await JSZip.loadAsync(buf);
  const slideFile = zip.file("ppt/slides/slide1.xml");
  if (!slideFile) {
    console.error("slide1.xml not found");
    return;
  }
  const xml = await slideFile.async("string");

  // --- STEP 3: Parse XML → map flow nodeId → XML shape id ---
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const nsP = "http://schemas.openxmlformats.org/presentationml/2006/main";
  const nsA = "http://schemas.openxmlformats.org/drawingml/2006/main";

  const spEls = doc.getElementsByTagNameNS(nsP, "sp");
  const idMap: Record<string, number> = {};
  let maxId = 0;

  for (let i = 0; i < spEls.length; i++) {
    const sp = spEls[i];
    const pr = sp.getElementsByTagNameNS(nsP, "cNvPr")[0];
    if (!pr) continue;
    const xid = parseInt(pr.getAttribute("id") || "0");
    if (xid > maxId) maxId = xid;

    const ts = sp.getElementsByTagNameNS(nsA, "t");
    let txt = "";
    for (let j = 0; j < ts.length; j++) txt += ts[j].textContent || "";
    txt = txt.trim();
    if (!txt) continue;

    const mn = nodes.find(
      (n: any) => n.data.label.trim() === txt && !idMap[n.id],
    );
    if (mn) idMap[mn.id] = xid;
  }

  // --- STEP 4: Build connector XML + Y/N label text boxes ---
  let cxml = "";
  let nid = maxId + 1;

  edges.forEach((edge: any, ei: number) => {
    const sXid = idMap[edge.source];
    const tXid = idMap[edge.target];
    if (!sXid || !tXid) return;
    const sp = nPos[edge.source];
    const tp = nPos[edge.target];
    if (!sp || !tp) return;

    const sH = edge.sourceHandle || "bottom-source";
    const tH = edge.targetHandle || "top-target";
    const si = handleToIdx(sH);
    const ti = handleToIdx(tH);

    const s = connPt(sp.x, sp.y, sp.w, sp.h, si);
    const e = connPt(tp.x, tp.y, tp.w, tp.h, ti);

    const bx = Math.min(s.x, e.x);
    const by = Math.min(s.y, e.y);
    const cx = Math.max(Math.abs(e.x - s.x), 1);
    const cy = Math.max(Math.abs(e.y - s.y), 1);
    const fH = s.x > e.x ? ' flipH="1"' : "";
    const fV = s.y > e.y ? ' flipV="1"' : "";

    const id = nid++;

    // Y/N에 따라 커넥터 선 색상 차별화
    let lineColor = "64748B"; // 기본 회색
    if (edge.label === "Y") lineColor = "10B981"; // 초록
    else if (edge.label === "N") lineColor = "F43F5E"; // 빨강

    // 커넥터 생성 (텍스트 없이 - 별도 텍스트 박스 사용)
    cxml += `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Connector ${ei + 1}"/><p:cNvCxnSpPr><a:stCxn id="${sXid}" idx="${si}"/><a:endCxn id="${tXid}" idx="${ti}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${fH}${fV}><a:off x="${Math.round(bx)}" y="${Math.round(by)}"/><a:ext cx="${Math.round(cx)}" cy="${Math.round(cy)}"/></a:xfrm><a:prstGeom prst="bentConnector3"><a:avLst/></a:prstGeom><a:ln w="19050"><a:solidFill><a:srgbClr val="${lineColor}"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`;

    // Y/N 라벨이 있으면 커넥터 중간 지점에 별도 텍스트 박스 도형 추가
    if (edge.label) {
      const labelId = nid++;
      const labelText = escapeXml(String(edge.label));

      // 커넥터 중간 지점 계산
      const midX = (s.x + e.x) / 2;
      const midY = (s.y + e.y) / 2;

      // 라벨 박스 크기 (EMU): 폭 0.4인치, 높이 0.25인치
      const lw = Math.round(0.4 * EMU);
      const lh = Math.round(0.25 * EMU);
      const lx = Math.round(midX - lw / 2);
      const ly = Math.round(midY - lh / 2);

      // Y/N에 따른 라벨 배경색 & 테두리색 & 글자색
      let labelFill = "FFFFFF";
      let labelBorder = "64748B";
      let labelTextColor = "334155";
      if (edge.label === "Y") {
        labelFill = "D1FAE5";
        labelBorder = "10B981";
        labelTextColor = "065F46";
      } else if (edge.label === "N") {
        labelFill = "FFE4E6";
        labelBorder = "F43F5E";
        labelTextColor = "9F1239";
      }

      cxml += `<p:sp><p:nvSpPr><p:cNvPr id="${labelId}" name="Label ${ei + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${lx}" y="${ly}"/><a:ext cx="${lw}" cy="${lh}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="${labelFill}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="${labelBorder}"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr rtlCol="0" anchor="ctr" lIns="0" rIns="0" tIns="0" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1000" b="1" dirty="0"><a:solidFill><a:srgbClr val="${labelTextColor}"/></a:solidFill></a:rPr><a:t>${labelText}</a:t></a:r></a:p></p:txBody></p:sp>`;
    }
  });

  // --- STEP 5: Insert connectors into XML ---
  const modXml = xml.replace("</p:spTree>", cxml + "</p:spTree>");
  zip.file("ppt/slides/slide1.xml", modXml);

  // --- STEP 6: Download ---
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  
  // 파일명에서 OS 예약어, 특수문자, 대괄호 제거 (최고 수준의 호환성 확보)
  const safeName = flowName.replace(/[\[\]/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
  const fileName = `FlowCraft_UX_Plan_${safeName || "Untitled"}.pptx`;
  a.download = fileName;
  
  document.body.appendChild(a);
  a.click();
  
  // 브라우저가 대용량 파일을 디스크에 완전히 쓸 수 있도록 리소스 해제 시간을 60초로 대폭 연장
  // (이전 1초는 일부 환경에서 파일 생성 전 URL이 만료되어 다운로드가 취소되는 원인이 됨)
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    window.URL.revokeObjectURL(url);
  }, 60000);
};

export const exportFigma = async (
  flowDataNodes: any[],
  flowDataEdges: any[],
  flowName: string,
  elementId: string
) => {
  const container = document.querySelector(elementId) as HTMLElement;
  if (!container) return;

  const nodeEls = Array.from(
    container.querySelectorAll(".react-flow__node")
  ) as HTMLElement[];
  const edgePaths = Array.from(
    container.querySelectorAll(".react-flow__edges svg path.react-flow__edge-path")
  ) as SVGPathElement[];

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  const nodeSvgs = nodeEls.map((el) => {
    const id = el.getAttribute("data-id");
    const fNode = flowDataNodes.find((n) => String(n.id) === id);
    if (!fNode) return "";

    const transform = el.style.transform;
    const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    let x = 0, y = 0;
    if (match) {
      x = parseFloat(match[1]);
      y = parseFloat(match[2]);
    } else {
      x = fNode.position?.x || 0;
      y = fNode.position?.y || 0;
    }

    const w = el.offsetWidth || fNode.measured?.width || 150;
    const h = el.offsetHeight || fNode.measured?.height || 50;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);

    const type = fNode.type || "process";
    const label = fNode.data?.label || "";
    let shape = "";
    let textColor = "#0f172a";

    if (type === "startEnd") {
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>`;
      textColor = "#ffffff";
    } else if (type === "decision") {
      const mx = x + w / 2, my = y + h / 2;
      shape = `<polygon points="${mx},${y} ${x + w},${my} ${mx},${y + h} ${x},${my}" fill="#FFF9C4" stroke="#FBC02D" stroke-width="3" />`;
    } else if (type === "database") {
      shape = `<rect x="${x}" y="${y + 6}" width="${w}" height="${h - 6}" fill="#E8F5E9" stroke="#4CAF50" stroke-width="2"/><ellipse cx="${x + w / 2}" cy="${y + 6}" rx="${w / 2}" ry="6" fill="#E8F5E9" stroke="#4CAF50" stroke-width="2"/><ellipse cx="${x + w / 2}" cy="${y + h - 1}" rx="${w / 2}" ry="6" fill="#E8F5E9" stroke="#4CAF50" stroke-width="2"/><rect x="${x + 2}" y="${y + 6}" width="${w - 4}" height="${h - 8}" fill="#E8F5E9" stroke="none"/>`;
    } else if (type === "external") {
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#FFEBEE" stroke="#D32F2F" stroke-width="2" stroke-dasharray="4"/>`;
      textColor = "#D32F2F";
    } else if (type === "screen") {
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>`;
      textColor = "#0f172a";
    } else if (type === "action") {
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>`;
      textColor = "#1d4ed8";
    } else {
      shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>`;
    }

    const lines = String(label).split("\n");
    const lineHeight = 14;
    const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;

    const textSvg = lines.map((l, i) =>
      `<text x="${x + w / 2}" y="${startY + i * lineHeight}" font-family="Pretendard, sans-serif" font-size="12" font-weight="bold" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${escapeXml(l)}</text>`
    ).join("");

    return shape + textSvg;
  }).join("\n");

  const edgeSvgs = edgePaths.map((el) => {
    const d = el.getAttribute("d");
    if (!d) return "";
    let color = "#94a3b8"; 

    const parentGroupId = el.closest('g.react-flow__edge')?.getAttribute('data-id');
    if (parentGroupId) {
      const fEdge = flowDataEdges.find((e) => String(e.id) === parentGroupId);
      if (fEdge) {
        if (fEdge.label === "Y") color = "#10B981";
        else if (fEdge.label === "N") color = "#F43F5E";
      }
    }
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" />`;
  }).join("\n");

  const edgeLabelEls = Array.from(
    container.querySelectorAll(".react-flow__edge-textwrapper")
  ) as HTMLElement[];

  const labelSvgs = edgeLabelEls.map((el) => {
    const transform = el.style.transform;
    const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (!match) return "";
    const cx = parseFloat(match[1]);
    const cy = parseFloat(match[2]);

    const textDiv = el.querySelector("div");
    if (!textDiv) return "";
    const text = textDiv.innerText.trim();
    if (!text) return "";

    let bg = "#ffffff", border = "#cbd5e1", tColor = "#334155";
    if (text === "Y") {
      bg = "#D1FAE5"; border = "#10B981"; tColor = "#065F46";
    } else if (text === "N") {
      bg = "#FFE4E6"; border = "#F43F5E"; tColor = "#9F1239";
    }

    const lw = 32, lh = 20;
    const lx = cx - lw / 2, ly = cy - lh / 2;

    return `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="4" fill="${bg}" stroke="${border}" stroke-width="1.5"/><text x="${cx}" y="${cy}" font-family="Pretendard, sans-serif" font-size="10" font-weight="bold" fill="${tColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(text)}</text>`;
  }).join("\n");

  if (minX === Infinity) { minX = 0; minY = 0; maxX = 500; maxY = 500; }
  const padding = 50;
  const vWidth = maxX - minX + padding * 2;
  const vHeight = maxY - minY + padding * 2;
  const viewBox = `${minX - padding} ${minY - padding} ${vWidth} ${vHeight}`;

  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${vWidth}" height="${vHeight}">
  <rect x="${minX - padding}" y="${minY - padding}" width="${vWidth}" height="${vHeight}" fill="#F8FAFC" />
  <g class="edges">${edgeSvgs}</g>
  <g class="labels">${labelSvgs}</g>
  <g class="nodes">${nodeSvgs}</g>
</svg>`;

  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  
  // 파일명에서 OS 예약어, 특수문자, 대괄호 제거 (최고 수준의 호환성 확보)
  const safeName = flowName.replace(/[\[\]/\\?%*:|"<>]/g, "").replace(/\s+/g, "_");
  const fileName = `FlowCraft_UX_Plan_${safeName || "Untitled"}.svg`;
  a.download = fileName;
  
  document.body.appendChild(a);
  a.click();
  
  // 리소스 해제 시간을 60초로 연장하여 안정적 파일 생성 보장
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    window.URL.revokeObjectURL(url);
  }, 60000);
};
