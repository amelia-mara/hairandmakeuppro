export interface ContinuityEvent {
  id: string;
  characterId: string;
  type: 'injury' | 'makeup' | 'hair' | 'wardrobe' | 'prop' | 'other';
  description: string;
  startSceneId: string;
  endSceneId?: string;
  stages?: ContinuityStage[];
}

export interface ContinuityStage {
  sceneId: string;
  description: string;
  intensity?: number;
}
