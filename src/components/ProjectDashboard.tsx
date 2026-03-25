import React, { useState } from "react";
import { Plus, Layout, Calendar, Trash2, ArrowRight, Layers, Sparkles } from "lucide-react";
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

  const domains = ["금융", "커머스", "공공", "엔터테인먼트", "헬스케어", "직접입력"];
  const channels = ["Web", "App", "Admin", "Kiosk", "Event"];

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Layers className="text-blue-600" size={32} /> FlowCraft Projects
            </h1>
            <p className="text-slate-500 mt-2 font-medium">관리 중인 서비스 기획 프로젝트 리스트</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-200"
          >
            <Plus size={20} /> 새 프로젝트 추가
          </button>
        </header>

        {/* Project List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-full py-24 flex flex-col items-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <Sparkles size={32} />
              </div>
              <p className="text-slate-400 font-bold text-lg">아직 생성된 프로젝트가 없습니다.</p>
              <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-600 font-black hover:underline">첫 프로젝트 시작하기</button>
            </div>
          ) : (
            projects.map((project) => (
              <div 
                key={project.id}
                className="group bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer relative"
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase tracking-widest">{project.domain === "직접입력" ? project.customDomain : project.domain}</span>
                    <span className="px-2 py-1 bg-blue-50 text-blue-500 rounded text-[10px] font-black uppercase tracking-widest">{project.channel}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                    className="p-2 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 truncate group-hover:text-blue-600 transition-colors">{project.name}</h3>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-6">
                  <Calendar size={14} /> {new Date(project.createdAt).toLocaleDateString()} 생성
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50 text-blue-600 font-black text-xs">
                  <span>{project.menus?.length || 0}개의 메뉴 구성됨</span>
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3"><Layers className="text-blue-600" /> 프로젝트 추가</h2>
              <p className="text-slate-500 text-sm mt-1">프로젝트의 기본 정보를 입력하여 설계를 시작하세요.</p>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">프로젝트명</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold"
                  placeholder="예: 마이뱅크 비대면 서비스 고도화"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">도메인 / 서비스군</label>
                  <div className="flex flex-wrap gap-2">
                    {domains.map(d => (
                      <button 
                        key={d}
                        onClick={() => setFormData({...formData, domain: d})}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${formData.domain === d ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  {formData.domain === "직접입력" && (
                    <input 
                      type="text"
                      className="w-full mt-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold outline-none focus:border-blue-500"
                      placeholder="산업군 직접 입력"
                      value={formData.customDomain}
                      onChange={(e) => setFormData({...formData, customDomain: e.target.value})}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">플랫폼 / 채널</label>
                  <div className="flex flex-wrap gap-2">
                    {channels.map(c => (
                      <button 
                        key={c}
                        onClick={() => setFormData({...formData, channel: c})}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${formData.channel === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-4 bg-white text-slate-500 rounded-2xl font-black border border-slate-200 hover:bg-slate-100 transition-all"
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
                className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
