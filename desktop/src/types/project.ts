export interface Project {
  id: string;
  name: string;
  created: number;
  modified: number;
  scriptFileName?: string;
  scriptContent?: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  sceneCount: number;
  characterCount: number;
  lastOpened: number;
}
