import React, { useState } from "react";
import { Plus, ChevronRight, ChevronDown, ListTree, Layout, FileText, Trash2 } from "lucide-react";
import { MenuItem } from "../types";

interface SidebarProps {
  menus: MenuItem[];
  activeMenuId: string | null;
  onSelectMenu: (id: string) => void;
  onAddMenu: (name: string, parentId?: string) => void;
  onDeleteMenu: (id: string) => void;
  projectName: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  menus,
  activeMenuId,
  onSelectMenu,
  onAddMenu,
  onDeleteMenu,
  projectName,
}) => {
  const [newMenuName, setNewMenuName] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null); // Parent ID for 2nd depth

  const firstDepthMenus = menus.filter((m) => m.depth === 1);
  const getSubMenus = (parentId: string) => menus.filter((m) => m.parentId === parentId);

  return (
    <div className="w-64 h-full bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shadow-xl overflow-hidden">
      {/* Project Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1 flex items-center gap-2">
          <Layout size={12} /> Active Project
        </h2>
        <div className="text-sm font-black text-white truncate px-1" title={projectName}>
          {projectName}
        </div>
      </div>

      {/* Menu List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {firstDepthMenus.map((menu) => {
          const subMenus = getSubMenus(menu.id);
          const isActive = activeMenuId === menu.id || subMenus.some(s => s.id === activeMenuId);
          
          return (
            <div key={menu.id} className="space-y-1">
              <div 
                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                  activeMenuId === menu.id ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "hover:bg-slate-800/50"
                }`}
                onClick={() => onSelectMenu(menu.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={16} className={activeMenuId === menu.id ? "text-white" : "text-blue-500"} />
                  <span className="text-xs font-bold truncate pr-2">{menu.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setAddingTo(addingTo === menu.id ? null : menu.id); }}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                  >
                    <Plus size={12} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteMenu(menu.id); }}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Submenus */}
              <div className="ml-4 pl-2 border-l border-slate-800 space-y-1">
                {subMenus.map((sub) => (
                  <div 
                    key={sub.id}
                    className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                      activeMenuId === sub.id ? "bg-slate-800 text-blue-400 ring-1 ring-blue-500 shadow-sm" : "hover:bg-slate-800/30 text-slate-400 hover:text-slate-200"
                    }`}
                    onClick={() => onSelectMenu(sub.id)}
                  >
                    <span className="text-[11px] font-medium truncate pr-2">↳ {sub.name}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteMenu(sub.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-rose-400 transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                
                {addingTo === menu.id && (
                  <div className="mt-2 px-1">
                    <input 
                      autoFocus
                      type="text"
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-[10px] outline-none focus:border-blue-500 text-white"
                      placeholder="Add sub-menu..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          onAddMenu(e.currentTarget.value.trim(), menu.id);
                          setAddingTo(null);
                        }
                      }}
                      onBlur={() => setAddingTo(null)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add 1st Depth Button */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-2">
          <input 
            type="text"
            className="flex-1 bg-slate-800 border-none rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-slate-500"
            placeholder="New Menu..."
            value={newMenuName}
            onChange={(e) => setNewMenuName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newMenuName.trim()) {
                onAddMenu(newMenuName.trim());
                setNewMenuName("");
              }
            }}
          />
          <button 
            onClick={() => { if (newMenuName.trim()) { onAddMenu(newMenuName.trim()); setNewMenuName(""); } }}
            className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white shadow-lg shadow-blue-900/20"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
