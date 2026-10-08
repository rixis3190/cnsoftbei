import type { Agent, StudentProfile, LearningResource, LearningPath, LearningAssessment, QAItem } from '../types';
import rawData from './mockData.json';

const now = new Date().toISOString();

// ============ 核心 mock 数据 ============

export const agents: Agent[] = rawData.agents as Agent[];

export const initialProfile: StudentProfile = {
  ...rawData.initialProfile,
  updatedAt: now,
} as StudentProfile;

export const mockResources: LearningResource[] = rawData.mockResources.map(r => ({
  ...r,
  createdAt: now,
})) as LearningResource[];

export const mockLearningPath: LearningPath = rawData.mockLearningPath as LearningPath;

export const mockAssessments: LearningAssessment[] = rawData.mockAssessments as LearningAssessment[];

// ============ 首页数据 ============

export const homeStats = rawData.homeStats;

export const agentStatusList = rawData.agentStatusList;

// ============ 评估页数据 ============

export const learningStats = rawData.learningStats;

export const assessmentSuggestions = rawData.assessmentSuggestions;

// ============ 路径页数据 ============

export const smartRecommendations = rawData.smartRecommendations;

// ============ 资源页数据 ============

export const resourceTypeMeta = rawData.resourceTypeMeta as Record<string, {
  label: string;
  desc: string;
  iconName: string;
  color: string;
}>;

export const resourceAgentDisplay = rawData.resourceAgentDisplay as {
  name: string;
  desc: string;
  role: string;
}[];

// ============ 辅导页数据 ============

export const defaultTutorHistory: QAItem[] = rawData.defaultTutorHistory.map(h => ({
  ...h,
  createdAt: now,
})) as QAItem[];

export const tutorQuickQuestions: string[] = rawData.tutorQuickQuestions;

// ============ 画像页数据 ============

export const defaultChatMessages = rawData.defaultChatMessages;

export const quizQuestionBank = rawData.quizQuestionBank as {
  question: string;
  options: string[];
  dimension: string;
  dimensionLabel: string;
  type: 'knowledge' | 'self-assessment';
  correctAnswer?: number;
}[];

export const quizSelectionCounts: Record<string, number> = rawData.quizSelectionCounts;

export const dimensionOptions = rawData.dimensionOptions as { label: string; value: string }[];

// ============ 菜单数据 ============

export const menuItems = rawData.menuItems as {
  key: string;
  iconName: string;
  label: string;
}[];
