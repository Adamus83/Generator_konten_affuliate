export interface ScriptScene {
  scene: number;
  duration: string;
  visual: string;
  audio: string;
  speech: string;
  veoPrompt: string;
}

export interface AffiliateContent {
  titles: string[];
  description: string;
  hashtags: string[];
  script: ScriptScene[];
  productDetails: {
    extractedName: string;
    mainBenefit: string;
  };
}

export interface GenerationHistoryItem {
  id: string;
  timestamp: string;
  productInput: string;
  productUrl?: string;
  tone: string;
  category: string;
  ctaStyle: string;
  content: AffiliateContent;
}

export interface VideoGenerationStatus {
  taskId: string;
  sceneIndex: number;
  operationName: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  videoUrl?: string; // local proxy URL or downloaded link
  error?: string;
}

export interface TopUpTransaction {
  id: string;
  packageName: string;
  price: number;
  credits: number;
  senderName: string;
  whatsappNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
}

