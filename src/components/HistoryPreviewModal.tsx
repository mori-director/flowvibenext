import React from "react";
import { X, FileText, Layout, Info, Layers, CheckCircle, ArrowRight } from "lucide-react";
import { HistoryItem } from "./HistoryList";

interface HistoryPreviewModalProps {
  item: HistoryItem;
  isOpen: boolean;
  onClose: () => void;
  onVisualize: (item: HistoryItem) => void;
}

export default function HistoryPreviewModal({ item, isOpen, onClose, onVisualize }: HistoryPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300 overflow-hidden">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-6 border-b border-slate-100 flex items-center justify-between flex-none bg-slate-50/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-tight">Flow <span className="text-blue-600">Preview</span></h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.serviceName} | {item.channel}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-10 selection:bg-blue-100 selection:text-blue-900 scrollbar-hide">
          {/* Section: Simple Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Info size={16} />
              <h4 className="text-sm font-black uppercase tracking-widest">간편 정보 (Process Summary)</h4>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
              {item.info.flowDesc || "설명 정보가 없습니다."}
            </div>
          </section>

          {/* Section: Policy & Rules */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <Layers size={16} />
              <h4 className="text-sm font-black uppercase tracking-widest">정책 & 룰 미리보기 (Policies & Rules)</h4>
            </div>
            <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-6 text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap italic">
              {item.info.policy || "등록된 정책 정보가 없습니다."}
            </div>
          </section>

          {/* Section: Path Summary */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <CheckCircle size={16} />
              <h4 className="text-sm font-black uppercase tracking-widest">분석된 주요 단계</h4>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {item.analysis.filter(a => a.tag === "화면" || a.tag === "프로세스명").map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-xs font-bold text-slate-600">
                  <span className="w-5 h-5 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg text-[10px]">{i+1}</span>
                  <span>{a.content}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="p-6 border-t border-slate-100 flex-none bg-white rounded-b-3xl">
          <button 
            onClick={() => onVisualize(item)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 group"
          >
            시각화 화면으로 이동하기
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
        </footer>
      </div>
    </div>
  );
}
