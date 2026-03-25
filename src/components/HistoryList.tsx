import React from "react";
import { 
  FileText, 
  Search, 
  Calendar, 
  ChevronRight, 
  ExternalLink,
  History,
  MoreVertical,
  Trash2,
  Clock
} from "lucide-react";

export interface HistoryItem {
  id: string;
  no: number;
  domain: string;
  channel: string;
  serviceName: string;
  flowName: string;
  createdAt: string;
  updatedAt: string;
  jsonCode: string;
  analysis: any[];
  info: any;
  layoutDirection: string;
}

interface HistoryListProps {
  items: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onPreviewItem: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
}

export default function HistoryList({ items, onSelectItem, onPreviewItem, onDeleteItem }: HistoryListProps) {
  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <History size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">History Management</span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              Flow <span className="text-blue-600">Archive</span>
            </h2>
            <p className="text-slate-500 mt-1 font-medium italic">이전 작업 이력을 관리하고 시각화 화면으로 즉시 연결합니다.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={16} />
              <input 
                type="text" 
                placeholder="검색어를 입력하세요..." 
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64 shadow-sm"
              />
            </div>
          </div>
        </header>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">No</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Domain / Channel</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Service Name</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Flow Name</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Preview</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Created / Updated</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <FileText size={48} />
                      <p className="font-bold text-lg">저장된 이력이 없습니다.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                    onClick={() => onSelectItem(item)}
                  >
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-slate-400">#{item.no}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">{item.domain}</span>
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-1 uppercase leading-none">{item.channel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-slate-700">{item.serviceName}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-slate-900">{item.flowName}</span>
                    </td>
                    <td className="px-6 py-5">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewItem(item);
                        }}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-all border border-blue-200"
                      >
                        <Search size={12} />
                        정책 & 룰 미리보기
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                          <Calendar size={10} />
                          <span>{item.createdAt}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold">
                          <Clock size={10} />
                          <span>{item.updatedAt}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(item.id);
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
