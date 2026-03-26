import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Layout, 
  Calendar, 
  Trash2, 
  ArrowRight, 
  Layers, 
  Sparkles, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  SortAsc,
  Clock,
  BarChart3,
  CalendarDays,
  X,
  Smartphone,
  Globe,
  Monitor,
  Activity
} from "lucide-react";
import { Project } from "../types";

interface ProjectDashboardProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string, domain: string, customDomain: string, channel: string) => void;
  onDeleteProject: (id: string) => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  projects,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    domain: "금융",
    customDomain: "",
    channel: "Web",
  });

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDomain, setFilterDomain] = useState("전체");
  const [filterChannel, setFilterChannel] = useState("전체");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const domains = ["전체", "금융", "커머스", "공공", "엔터테인먼트", "헬스케어", "기타"];
  const creationDomains = ["금융", "커머스", "공공", "엔터테인먼트", "헬스케어", "직접입력"];
  const channels = ["전체", "Web", "App", "Admin", "Kiosk", "Event"];
  const creationChannels = ["Web", "App", "Admin", "Kiosk", "Event"];

  // Filter & Sort Logic
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.domain.toLowerCase().includes(term) ||
        p.customDomain.toLowerCase().includes(term)
      );
    }

    // Domain Filter
    if (filterDomain !== "전체") {
      result = result.filter(p => {
        if (filterDomain === "기타") return p.domain === "직접입력";
        return p.domain === filterDomain;
      });
    }

    // Channel Filter
    if (filterChannel !== "전체") {
      result = result.filter(p => p.channel === filterChannel);
    }

    // Date Range Filter
    if (startDate) {
      const start = new Date(startDate).getTime();
      result = result.filter(p => p.createdAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000; // Add one day to include the end date
      result = result.filter(p => p.createdAt <= end);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "newest") return b.createdAt - a.createdAt;
      if (sortBy === "oldest") return a.createdAt - b.createdAt;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [projects, searchTerm, filterDomain, filterChannel, sortBy, startDate, endDate]);

  // Combined Stats Aggregation
  const stats = useMemo(() => {
    const domainCounts: Record<string, number> = {};
    const channelCounts: Record<string, number> = {};
    filteredProjects.forEach(p => {
      const d = p.domain === "직접입력" ? "기타" : p.domain;
      domainCounts[d] = (domainCounts[d] || 0) + 1;
      channelCounts[p.channel] = (channelCounts[p.channel] || 0) + 1;
    });
    return { domainCounts, channelCounts };
  }, [filteredProjects]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredProjects.length / pageSize);
  const currentProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterDomain("전체");
    setFilterChannel("전체");
    setStartDate("");
    setEndDate("");
    setSortBy("newest");
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-8">
      {/* 1. Header Area - Title and button removed from here */}
      <div className="max-w-7xl mx-auto w-full h-2"></div>

      {/* 2. Filter & Search Toolbar (Swapped to top) */}
      <section className="max-w-7xl mx-auto w-full">
        <div className="bg-white/60 backdrop-blur-md rounded-[1.5rem] border border-slate-200 p-3 flex flex-wrap xl:flex-nowrap items-center gap-3 shadow-sm overflow-x-auto custom-scrollbar no-scrollbar">
          {/* Keyword Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 h-12 rounded-xl bg-white border border-slate-100 text-xs font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* Domain Selection */}
          <div className="flex items-center h-12 bg-white rounded-xl border border-slate-100 p-1 shadow-sm shrink-0">
            <select 
              className="bg-transparent text-[11px] font-black outline-none px-3 h-full cursor-pointer min-w-[100px]"
              value={filterDomain}
              onChange={(e) => { setFilterDomain(e.target.value); setCurrentPage(1); }}
            >
              {domains.map(d => <option key={d} value={d}>Domain: {d}</option>)}
            </select>
          </div>

          {/* Channel Selection (Visual Highlight) */}
          <div className="flex items-center h-12 bg-blue-50 rounded-xl border border-blue-100 p-1 shadow-sm shrink-0">
            <div className="flex items-center gap-1.5 px-2 h-full">
              <Globe size={12} className="text-blue-500" />
              <select 
                className="bg-transparent text-[11px] font-black text-blue-900 outline-none h-full cursor-pointer min-w-[120px]"
                value={filterChannel}
                onChange={(e) => { setFilterChannel(e.target.value); setCurrentPage(1); }}
              >
                {channels.map(c => <option key={c} value={c}>Channel: {c}</option>)}
              </select>
            </div>
          </div>

          {/* Period Range Picker */}
          <div className="flex items-center h-12 gap-2 bg-white rounded-xl border border-slate-100 p-1 px-3 shadow-sm shrink-0">
            <CalendarDays size={14} className="text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent text-[10px] font-black outline-none cursor-pointer h-full"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            />
            <span className="text-slate-200">~</span>
            <input 
              type="date" 
              className="bg-transparent text-[10px] font-black outline-none cursor-pointer h-full"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* Sort Selection */}
          <div className="flex items-center h-12 gap-2 bg-white rounded-xl border border-slate-100 p-1 px-3 shadow-sm shrink-0">
            <SortAsc size={14} className="text-slate-400" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[10px] font-black outline-none h-full cursor-pointer"
            >
              <option value="newest">최신순</option>
              <option value="name">이름순</option>
              <option value="oldest">오래된순</option>
            </select>
          </div>

          {/* Clear Filters */}
          <button 
            onClick={clearFilters}
            className="h-12 w-12 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-md flex-none"
            title="Reset Filters"
          >
            <X size={14} />
          </button>
        </div>
      </section>

      {/* 3. Stats Dashboard (Swapped to bottom) */}
      <section className="max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm flex flex-col xl:flex-row items-stretch gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Total Count */}
          <div className="flex flex-col items-center justify-center xl:border-r border-slate-100 xl:pr-10 min-w-[180px]">
            <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] mb-1">TOTAL IMPACT</p>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-slate-900">{filteredProjects.length}</span>
              <span className="text-sm font-bold text-blue-600">Active</span>
            </div>
          </div>

          {/* Aggregated Chips - Domain & Channel */}
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-400 mr-2 border-r border-slate-100 pr-4 shrink-0">
                <BarChart3 size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Industry</span>
              </div>
              {domains.filter(d => d !== "전체").map(d => (
                <div key={d} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${stats.domainCounts[d] ? "bg-slate-50 border-slate-200 text-slate-900 shadow-sm" : "bg-transparent border-slate-100 text-slate-200"}`}>
                  <span className="text-[11px] font-bold">{d}</span>
                  <span className={`text-xs font-black ${stats.domainCounts[d] ? "text-blue-600" : "text-slate-100"}`}>{stats.domainCounts[d] || 0}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-blue-500 mr-2 border-r border-blue-50 pr-4 shrink-0">
                <Activity size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Channels</span>
              </div>
              {channels.filter(c => c !== "전체").map(c => (
                <div key={c} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${stats.channelCounts[c] ? "bg-blue-50 border-blue-100 text-blue-900 shadow-sm" : "bg-transparent border-slate-100 text-slate-200"}`}>
                  <span className="text-[11px] font-bold">{c}</span>
                  <span className={`text-xs font-black ${stats.channelCounts[c] ? "text-blue-600" : "text-slate-100"}`}>{stats.channelCounts[c] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Project Grid Header & List */}
      <main className="max-w-7xl mx-auto w-full flex-1 flex flex-col gap-4">
        <div className="flex justify-between items-center px-2">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">프로젝트 목록</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group px-6 py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200 relative overflow-hidden"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" /> 새 프로젝트 추가
          </button>
        </div>
        {currentProjects.length === 0 ? (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-12 text-center animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6 border border-slate-100 shadow-sm">
              <Sparkles size={40} />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">검색 결과가 없습니다.</h2>
            <p className="text-slate-400 font-medium max-w-sm">필터 조건을 변경하거나 새로운 프로젝트를 생성하여 설계를 시작해보세요.</p>
            <button onClick={clearFilters} className="mt-6 text-blue-600 font-black hover:underline text-sm">필터 초기화하기</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentProjects.map((project) => (
              <div 
                key={project.id}
                className="group bg-white rounded-[1.5rem] border border-slate-100 p-5 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 hover:border-blue-100 transition-all cursor-pointer flex flex-col relative animate-in zoom-in-95 duration-300"
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200/50">
                      {project.domain === "직접입력" ? project.customDomain : project.domain}
                    </span>
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100/50">
                      {project.channel}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                    className="p-2.5 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors tracking-tight leading-tight">{project.name}</h3>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold mb-4">
                  <Calendar size={12} className="opacity-70" /> {new Date(project.createdAt).toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                
                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].slice(0, Math.min(3, project.menus?.length || 0)).map(i => (
                        <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-400">
                          M
                        </div>
                      ))}
                    </div>
                    <span className="text-xs font-black text-slate-600">{project.menus?.length || 0} Menus</span>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 5. Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-12 mb-20 flex items-center justify-center gap-4 flex-none">
            <button 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex gap-2">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`w-10 h-10 rounded-xl font-black text-sm transition-all ${
                    currentPage === i + 1 
                    ? "bg-slate-900 text-white shadow-lg" 
                    : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-50 bg-slate-50/50">
              <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tighter">
                <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-200">
                  <PlusSquare className="text-white" size={24} />
                </div> 
                프로젝트 추가
              </h2>
              <p className="text-slate-500 text-sm mt-3 font-medium">서비스의 성격에 맞는 메타데이터를 입력하여 기획 설계를 시작하십시오.</p>
            </div>
            <div className="p-10 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="space-y-4">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Project Identity</label>
                <div className="space-y-6">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 mb-2 px-1">PROJECT NAME</span>
                    <input 
                      type="text" 
                      autoFocus
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-100 transition-all font-bold text-lg placeholder:text-slate-300"
                      placeholder="예: 현대카드 UI/UX 고도화"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-6">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-3 px-1">INDUSTRY / DOMAIN</span>
                      <div className="flex flex-wrap gap-2">
                        {creationDomains.map(d => (
                          <button 
                            key={d}
                            onClick={() => setFormData({...formData, domain: d})}
                            className={`px-3 py-2 rounded-xl text-xs font-black transition-all border ${
                              formData.domain === d 
                              ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                              : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      {formData.domain === "직접입력" && (
                        <input 
                          type="text"
                          className="w-full mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold outline-none focus:bg-white focus:border-blue-500"
                          placeholder="산업군 직접 입력"
                          value={formData.customDomain}
                          onChange={(e) => setFormData({...formData, customDomain: e.target.value})}
                        />
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-3 px-1">PRIMARY CHANNEL</span>
                      <div className="flex flex-wrap gap-2">
                        {creationChannels.map(c => (
                          <button 
                            key={c}
                            onClick={() => setFormData({...formData, channel: c})}
                            className={`px-3 py-2 rounded-xl text-xs font-black transition-all border ${
                              formData.channel === c 
                              ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                              : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-5 bg-white text-slate-500 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all text-sm"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  if (formData.name.trim()) {
                    onCreateProject(formData.name, formData.domain, formData.customDomain, formData.channel);
                    setIsModalOpen(false);
                    setFormData({ name: "", domain: "금융", customDomain: "", channel: "Web" });
                  }
                }}
                className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 text-sm flex items-center justify-center gap-2"
              >
                <Sparkles size={18} /> 프로젝트 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Placeholder icon for modal title
const PlusSquare = ({ className, size }: { className?: string, size?: number }) => (
  <Plus className={className} size={size} />
);

export default ProjectDashboard;
