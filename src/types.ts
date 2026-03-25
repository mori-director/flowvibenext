export interface MenuItem {
  id: string;
  name: string;
  depth: 1 | 2;
  parentId?: string;
  flowData?: {
    flowName: string;
    flowDesc: string;
    policy: string;
    nodes: any[];
    edges: any[];
    structuredPlan: any[];
    jsonCode: string;
    layoutDirection: string;
    step: number;
  };
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  customDomain: string;
  channel: string;
  createdAt: number;
  menus: MenuItem[];
}

export interface LegacyHistoryItem {
  id: string;
  domain: string;
  channel: string;
  serviceName: string;
  flowName: string;
  createdAt: string;
  updatedAt: string;
  analysis: any[];
  nodes: any[];
  edges: any[];
  jsonCode: string;
  flowDesc: string;
  policy: string;
}
