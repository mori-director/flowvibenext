export interface MenuItem {
  id: string;
  name: string;
  depth: 1 | 2;
  order: number;
  parentId?: string;
  flowData?: {
    domain?: string;
    customDomain?: string;
    channel?: string;
    referenceFlowId?: string; // Legacy
    referenceFlowIds?: string[];
    flowName: string;
    flowDesc: string;
    policy: string;
    nodes: any[];
    edges: any[];
    nodesTB?: any[];
    edgesTB?: any[];
    nodesLR?: any[];
    edgesLR?: any[];
    structuredPlan: any[];
    jsonCode: string;
    jsonCodeTB?: string;
    jsonCodeLR?: string;
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
