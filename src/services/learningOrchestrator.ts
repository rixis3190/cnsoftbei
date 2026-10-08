import { questions } from '../data/pythonQuestionBank';
import type {
  CognitiveStyleLabel,
  DifficultyBand,
  LearningCycleLog,
  LearningEvaluationReport,
  LearningKnowledgeItem,
  LearningPathPlan,
  LearningPathStage,
  LearningProfileSnapshot,
  LearningSource,
  KnowledgeMasteryReportItem,
  MasteryLevel,
  PracticeQuestion,
  PracticeSelectionItem,
  PracticeSelectionReport,
  PracticeState,
  StudentProfile,
  TagScore,
} from '../types';

const DEFAULT_SOURCE: LearningSource = '练习';
const MIN_PRACTICE_QUESTION_COUNT = 5;

const RELATED_TAGS: Record<string, string[]> = {
  syntax: ['data-types', 'control-flow'],
  'data-types': ['syntax', 'operators'],
  operators: ['data-types', 'control-flow'],
  'control-flow': ['syntax', 'functions'],
  functions: ['modules', 'scope'],
  modules: ['functions', 'scope'],
  scope: ['functions', 'modules'],
  OOP: ['classes', 'inheritance'],
  classes: ['OOP', 'inheritance'],
  inheritance: ['classes', 'polymorphism'],
  polymorphism: ['inheritance', 'classes'],
  exceptions: ['files', 'decorators'],
  files: ['exceptions', 'decorators'],
  decorators: ['functions', 'modules'],
  comprehensions: ['control-flow', 'data-types'],
  errorProne: ['functions', 'scope', 'inheritance', 'decorators'],
  studyHabit: ['comprehensions', 'files', 'decorators'],
};

const DIMENSION_LABELS = {
  knowledgeBase: '知识基础',
  cognitiveStyle: '认知风格',
  errorProne: '易错点偏好',
  learningPace: '学习节奏',
  interestDirection: '兴趣方向',
  studyHabit: '学习习惯',
} as const;

const PATH_STAGE_META = [
  {
    stageId: 'stage-1',
    stageName: '入门',
    stageGoal: '建立基础概念和语法认知',
    coreKnowledgePoints: ['syntax', 'data-types', 'operators', 'control-flow'],
  },
  {
    stageId: 'stage-2',
    stageName: '基础',
    stageGoal: '掌握函数、模块和代码组织方式',
    coreKnowledgePoints: ['functions', 'modules', 'scope'],
  },
  {
    stageId: 'stage-3',
    stageName: '进阶',
    stageGoal: '理解面向对象、继承和多态',
    coreKnowledgePoints: ['OOP', 'classes', 'inheritance', 'polymorphism'],
  },
  {
    stageId: 'stage-4',
    stageName: '实战',
    stageGoal: '通过异常、文件、装饰器和推导式完成应用实践',
    coreKnowledgePoints: ['exceptions', 'files', 'decorators', 'comprehensions'],
  },
] as const;

function now() {
  return new Date().toISOString();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeScore(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function scoreToMastery(score: number): MasteryLevel {
  if (score >= 80) return '扎实';
  if (score >= 60) return '一般';
  if (score >= 30) return '薄弱';
  return '未接触';
}

function masteryToDifficultyBand(mastery: MasteryLevel, questionDifficulty: PracticeQuestion['difficulty']): DifficultyBand {
  if (mastery === '扎实') {
    return questionDifficulty === 'hard' ? '挑战' : '进阶';
  }
  if (mastery === '一般') {
    return questionDifficulty === 'medium' ? '进阶' : '入门';
  }
  if (mastery === '薄弱') {
    return questionDifficulty === 'easy' ? '基础' : '进阶';
  }
  return questionDifficulty === 'easy' ? '入门' : '基础';
}

function estimateHoursFromPace(pace: string): number {
  if (pace.includes('快')) return 6;
  if (pace.includes('慢')) return 16;
  return 10;
}

function buildDefaultKnowledgeBase(tagScores?: TagScore[]): LearningKnowledgeItem[] {
  if (!tagScores || tagScores.length === 0) return [];
  return tagScores.map(item => ({
    tag: item.tag,
    mastery: scoreToMastery(item.score),
    score: normalizeScore(item.score),
    source: DEFAULT_SOURCE,
  }));
}

function getKnowledgeMastery(profile: LearningProfileSnapshot | null | undefined, tag: string): MasteryLevel {
  const matched = profile?.knowledgeBase.find(item => item.tag === tag);
  return matched?.mastery ?? '一般';
}

export function buildLearningProfileSnapshot(
  profile: StudentProfile,
  source: LearningSource,
  tagScores: TagScore[] = [],
): LearningProfileSnapshot {
  const dimensionValue = (key: string) => profile.dimensions.find(item => item.key === key)?.value ?? '';
  const knowledgeBase = tagScores.length > 0
    ? buildDefaultKnowledgeBase(tagScores)
    : profile.learningProfile?.knowledgeBase ?? [];

  const cognitiveStyle = (dimensionValue('cognitiveStyle') || profile.learningProfile?.cognitiveStyle.label || '文字型') as CognitiveStyleLabel;
  const paceValue = dimensionValue('learningPace') || profile.learningProfile?.learningPace.label || '中等接受';
  const habitValue = dimensionValue('studyHabit') || profile.learningProfile?.studyHabit.label || '边做边学';
  const interests = unique(
    (dimensionValue('interestDirection') || '')
      .split(/[，,、/|]/)
      .map(item => item.trim())
      .filter(Boolean),
  );

  return {
    user: {
      id: profile.id,
      name: profile.name,
      major: profile.major,
      grade: profile.grade,
    },
    knowledgeBase,
    cognitiveStyle: {
      label: cognitiveStyle,
      source,
    },
    errorProne: tagScores
      .filter(item => item.score < 60)
      .sort((left, right) => left.score - right.score)
      .map(item => ({ tag: item.tag, count: Math.max(1, Math.round((100 - item.score) / 10)), source })),
    learningPace: {
      label: paceValue as LearningProfileSnapshot['learningPace']['label'],
      estimatedStudyHours: estimateHoursFromPace(paceValue),
      source,
    },
    interestDirection: {
      labels: interests.length > 0 ? interests : [dimensionValue('interestDirection') || '前端开发'],
      source,
    },
    studyHabit: {
      label: habitValue as LearningProfileSnapshot['studyHabit']['label'],
      source,
    },
    updatedAt: now(),
    source,
  };
}

export function syncLearningProfileFromPractice(
  profile: StudentProfile,
  tagScores: TagScore[],
): StudentProfile {
  const updatedProfile: StudentProfile = {
    ...profile,
    learningProfile: buildLearningProfileSnapshot(profile, '练习', tagScores),
    updatedAt: now(),
  };

  return updatedProfile;
}

function buildStageFromMeta(meta: typeof PATH_STAGE_META[number], profile: LearningProfileSnapshot, goal: string, index: number): LearningPathStage {
  const relatedInterest = profile.interestDirection.labels.some(label => goal.includes(label) || meta.stageGoal.includes(label));
  const estimatedHours = Math.max(
    4,
    Math.round((profile.learningPace.estimatedStudyHours / 2) + (relatedInterest ? -1 : 1) + index * 2),
  );

  return {
    stageId: meta.stageId,
    stageName: meta.stageName,
    stageGoal: meta.stageGoal,
    coreKnowledgePoints: [...meta.coreKnowledgePoints],
    estimatedHours,
    unlockCondition: {
      previousStageMasteryRate: 70,
    },
  };
}

export function buildLearningPathPlan(
  profile: LearningProfileSnapshot,
  goal: string,
): LearningPathPlan {
  const reorderedStages = [...PATH_STAGE_META];
  const interestLabels = profile.interestDirection.labels;

  if (interestLabels.some(label => goal.includes(label))) {
    const matchingIndex = reorderedStages.findIndex(stage => interestLabels.some(label => stage.stageGoal.includes(label) || stage.stageName.includes(label)));
    if (matchingIndex > 0) {
      const [matchedStage] = reorderedStages.splice(matchingIndex, 1);
      reorderedStages.unshift(matchedStage);
    }
  }

  const stages = reorderedStages.map((stage, index) => buildStageFromMeta(stage, profile, goal, index));
  const totalEstimatedHours = stages.reduce((sum, stage) => sum + stage.estimatedHours, 0);

  return {
    pathId: `path-${Date.now()}`,
    goal,
    stages,
    totalEstimatedHours,
    updatedAt: now(),
    source: '评估',
  };
}

function getQuestionDifficultyBand(question: PracticeQuestion, mastery: MasteryLevel): DifficultyBand {
  return masteryToDifficultyBand(mastery, question.difficulty);
}

function getQuestionPriority(question: PracticeQuestion, stageTags: string[], profile: LearningProfileSnapshot): number {
  const matchedStageTags = question.tags.filter(tag => stageTags.includes(tag)).length;
  const errorTags = new Set(profile.errorProne.map(item => item.tag));
  const errorBoost = question.tags.some(tag => errorTags.has(tag)) ? 3 : 0;
  const masteryPenalty = question.tags.reduce((sum, tag) => {
    const mastery = getKnowledgeMastery(profile, tag);
    return sum + (mastery === '扎实' ? -1 : mastery === '薄弱' ? 2 : mastery === '未接触' ? 1 : 0);
  }, 0);
  return matchedStageTags * 5 + errorBoost + masteryPenalty;
}

function selectFallbackQuestions(
  questions: PracticeQuestion[],
  stageTags: string[],
  profile: LearningProfileSnapshot,
  targetCount: number,
  selected: PracticeQuestion[],
): PracticeQuestion[] {
  const selectedIds = new Set(selected.map(item => item.id));
  const fallbackTags = unique(stageTags.flatMap(tag => RELATED_TAGS[tag] ?? []));
  const fallbackPool = questions.filter(question => !selectedIds.has(question.id) && question.tags.some(tag => fallbackTags.includes(tag)));

  fallbackPool.sort((left, right) => getQuestionPriority(right, stageTags, profile) - getQuestionPriority(left, stageTags, profile));

  const merged = [...selected];
  for (const question of fallbackPool) {
    if (merged.length >= targetCount) break;
    merged.push(question);
    selectedIds.add(question.id);
  }

  return merged;
}

function duplicateForCoverage(questions: PracticeQuestion[], targetCount: number): PracticeQuestion[] {
  if (questions.length === 0) return [];
  const duplicated = [...questions];
  let cursor = 0;
  while (duplicated.length < targetCount) {
    duplicated.push(questions[cursor % questions.length]);
    cursor += 1;
  }
  return duplicated;
}

export function buildPracticeSelection(
  profile: LearningProfileSnapshot,
  stage: LearningPathStage,
  targetQuestionCount = MIN_PRACTICE_QUESTION_COUNT,
): { questions: PracticeQuestion[]; report: PracticeSelectionReport; selectionItems: PracticeSelectionItem[] } {
  const allQuestions = questions as PracticeQuestion[];
  const stageTags = unique(stage.coreKnowledgePoints);
  const exactMatchQuestions = allQuestions.filter(question => question.tags.some(tag => stageTags.includes(tag)));

  const missingKnowledgePoints = stageTags.filter(tag => !exactMatchQuestions.some(question => question.tags.includes(tag)));

  const initialSelection = exactMatchQuestions
    .slice()
    .sort((left, right) => getQuestionPriority(right, stageTags, profile) - getQuestionPriority(left, stageTags, profile));

  let selected = initialSelection;
  const fallbackKnowledgePoints: string[] = [];

  if (selected.length < stageTags.length * 2) {
    const beforeCount = selected.length;
    selected = selectFallbackQuestions(allQuestions, stageTags, profile, Math.max(stageTags.length * 2, targetQuestionCount), selected);
    if (selected.length > beforeCount) {
      fallbackKnowledgePoints.push(...stageTags.filter(tag => !exactMatchQuestions.some(question => question.tags.includes(tag))));
    }
  }

  if (selected.length < targetQuestionCount) {
    selected = duplicateForCoverage(selected, targetQuestionCount);
  }

  const errorTags = profile.errorProne.map(item => item.tag);
  const errorProneSelected = selected.filter(question => question.tags.some(tag => errorTags.includes(tag)));
  const errorProneTarget = Math.ceil(selected.length * 0.4);

  if (errorTags.length > 0 && errorProneSelected.length < errorProneTarget) {
    const boostPool = allQuestions
      .filter(question => !selected.some(item => item.id === question.id) && question.tags.some(tag => errorTags.includes(tag)))
      .sort((left, right) => getQuestionPriority(right, stageTags, profile) - getQuestionPriority(left, stageTags, profile));
    for (const question of boostPool) {
      if (selected.filter(item => item.tags.some(tag => errorTags.includes(tag))).length >= errorProneTarget) break;
      selected.push(question);
    }
  }

  if (selected.length < targetQuestionCount) {
    selected = duplicateForCoverage(selected, targetQuestionCount);
  }

  const selectionItems: PracticeSelectionItem[] = selected.map(question => {
    const matchedTag = question.tags.find(tag => stageTags.includes(tag)) ?? question.tags[0] ?? 'unknown';
    const mastery = getKnowledgeMastery(profile, matchedTag);
    const band = getQuestionDifficultyBand(question, mastery);
    return {
      questionId: question.id,
      knowledgePoint: matchedTag,
      difficultyBand: band,
      repeated: selected.filter(item => item.id === question.id).length > 1,
      reason: question.tags.some(tag => errorTags.includes(tag))
        ? '易错点强化'
        : exactMatchQuestions.some(item => item.id === question.id)
          ? '知识点强匹配'
          : '关联知识点补充',
    };
  });

  const difficultyDistribution = selectionItems.reduce<Record<DifficultyBand, number>>((acc, item) => {
    acc[item.difficultyBand] += 1;
    return acc;
  }, { 入门: 0, 基础: 0, 进阶: 0, 挑战: 0 });

  const shortageReport = selected.length < targetQuestionCount
    ? `题库题量不足，当前仅能提供 ${selected.length} 题，已启用重复推送和关联知识点补充。`
    : missingKnowledgePoints.length > 0
      ? `部分核心知识点缺失：${missingKnowledgePoints.join('、')}`
      : undefined;

  return {
    questions: selected,
    selectionItems,
    report: {
      stageId: stage.stageId,
      stageName: stage.stageName,
      targetQuestionCount: Math.max(targetQuestionCount, MIN_PRACTICE_QUESTION_COUNT),
      selectedQuestionIds: selected.map(item => item.id),
      missingKnowledgePoints,
      fallbackKnowledgePoints: unique(fallbackKnowledgePoints),
      repeatedQuestionIds: unique(selectionItems.filter(item => item.repeated).map(item => item.questionId)),
      difficultyDistribution,
      shortageReport,
      generatedAt: now(),
      source: DEFAULT_SOURCE,
    },
  };
}

function getPracticeAccuracy(results: PracticeState['results'], tag: string): { correct: number; total: number } {
  const relevantResults = results.filter(result => {
    const question = questions.find(item => item.id === result.questionId);
    return question?.tags.includes(tag);
  });

  const objectiveResults = relevantResults.filter(result => result.isCorrect !== null);
  const correct = objectiveResults.filter(result => result.isCorrect).length + relevantResults.filter(result => (result.aiScore ?? 0) >= 60).length;
  const total = relevantResults.length;
  return { correct, total };
}

export function buildLearningEvaluationReport(
  profile: LearningProfileSnapshot,
  stage: LearningPathStage,
  practiceState: PracticeState,
  pathPlan?: LearningPathPlan | null,
): LearningEvaluationReport {
  const masteryItems = stage.coreKnowledgePoints.map(tag => {
    const { correct, total } = getPracticeAccuracy(practiceState.results, tag);
    const masteryRate = total > 0 ? Math.round((correct / total) * 100) : 0;
    const status: KnowledgeMasteryReportItem['status'] = masteryRate < 60 ? '薄弱' : masteryRate >= 80 ? '扎实' : '正常';
    return {
      tag,
      masteryRate,
      correctCount: correct,
      questionCount: total,
      status,
    };
  });

  const weakKnowledgePoints = masteryItems.filter(item => item.masteryRate < 60).map(item => item.tag);
  const pathOptimizationInstructions: string[] = [];
  const practiceOptimizationInstructions: string[] = [];
  const profileUpdateInstructions: string[] = [];

  if (weakKnowledgePoints.length > 0) {
    pathOptimizationInstructions.push(`新增专项强化阶段：${weakKnowledgePoints.join('、')}。`);
    profileUpdateInstructions.push(`将知识基础中 ${weakKnowledgePoints.join('、')} 标记为薄弱。`);
    practiceOptimizationInstructions.push(`增加 ${weakKnowledgePoints.join('、')} 的推送占比，并允许重复题目标注为强化练习。`);
  }

  const strongKnowledgePoints = masteryItems.filter(item => item.masteryRate >= 80).map(item => item.tag);
  if (strongKnowledgePoints.length > 0) {
    pathOptimizationInstructions.push(`压缩或合并 ${strongKnowledgePoints.join('、')} 相关内容，减少后续阶段重复覆盖。`);
    practiceOptimizationInstructions.push(`减少 ${strongKnowledgePoints.join('、')} 的推送比例，避免已掌握知识点过度重复。`);
  }

  if (profile.interestDirection.labels.length > 0) {
    pathOptimizationInstructions.push(`优先前置与兴趣方向 ${profile.interestDirection.labels.join('、')} 相关的阶段。`);
  }

  if (!pathPlan || pathPlan.stages.length === 0) {
    pathOptimizationInstructions.push('当前缺少有效路径计划，请重新生成阶段规划。');
  }

  if (practiceState.results.length < MIN_PRACTICE_QUESTION_COUNT) {
    practiceOptimizationInstructions.push('当前练习题量不足，保持至少 5 题的兜底推送。');
  }

  return {
    stageId: stage.stageId,
    stageName: stage.stageName,
    masteryItems,
    weakKnowledgePoints,
    profileUpdateInstructions,
    pathOptimizationInstructions,
    practiceOptimizationInstructions,
    generatedAt: now(),
    source: '评估',
  };
}

export function appendLearningCycleLog(
  currentLogs: LearningCycleLog[] | undefined,
  entry: Omit<LearningCycleLog, 'cycleId' | 'createdAt'>,
): LearningCycleLog[] {
  const nextLogs = currentLogs ? [...currentLogs] : [];
  nextLogs.push({
    ...entry,
    cycleId: `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now(),
  });
  return nextLogs.slice(-20);
}

export function profileDimensionLabel(key: string): string {
  return DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS] ?? key;
}

export function buildDefaultPathPlanFromProfile(profile: LearningProfileSnapshot, goal = 'Python 编程学习'): LearningPathPlan {
  return buildLearningPathPlan(profile, goal);
}

// ==================== 系统状态快照（统一数据读取入口） ====================

export interface SystemSnapshot {
  profile: StudentProfile | null;
  practiceState: PracticeState | null;
  pathPlan: LearningPathPlan | null;
  evaluationReport: LearningEvaluationReport | null;
  loadedAt: string;
}

import { userKey } from './storage';

// ==================== 路径阶段持久化 ====================

export interface CurrentPathStage {
  stageName: string;
  stageGoal: string;
  coreKnowledgePoints: string[];
  updatedAt: string;
}

/** 保存当前学习路径阶段（由 Path 页面调用） */
export function saveCurrentPathStage(stage: Omit<CurrentPathStage, 'updatedAt'>): void {
  const data: CurrentPathStage = { ...stage, updatedAt: new Date().toISOString() };
  localStorage.setItem(userKey('currentPathStage'), JSON.stringify(data));
}

/** 读取当前学习路径阶段 */
export function loadCurrentPathStage(): CurrentPathStage | null {
  try {
    const raw = localStorage.getItem(userKey('currentPathStage'));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 保存学习路径计划 */
export function savePathPlan(plan: LearningPathPlan): void {
  plan.updatedAt = new Date().toISOString();
  localStorage.setItem(userKey('learningPathPlan'), JSON.stringify(plan));
  broadcastEvent(SYSTEM_EVENTS.PATH_UPDATED, { plan });
}

/** 读取学习路径计划 */
export function loadPathPlan(): LearningPathPlan | null {
  try {
    const raw = localStorage.getItem(userKey('learningPathPlan'));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 根据阶段名称推断核心知识点标签 */
export function inferKnowledgePoints(stageName: string, stageDescription?: string): string[] {
  const text = (stageName + (stageDescription || '')).toLowerCase();
  const points: string[] = [];

  if (/基础|入门|语法|变量|类型|运算|控制|循环|条件|分支/.test(text)) {
    points.push('syntax', 'data-types', 'operators', 'control-flow');
  }
  if (/函数|模块|作用域|参数|lambda|装饰器|导入/.test(text) && !/装饰器深入|装饰器高级/.test(text)) {
    points.push('functions', 'modules', 'scope');
  }
  if (/对象|类|继承|多态|面向|封装|抽象/.test(text)) {
    points.push('OOP', 'classes', 'inheritance', 'polymorphism');
  }
  if (/异常|文件|装饰|推导|实战|高级|进阶|项目|应用|综合/.test(text)) {
    points.push('exceptions', 'files', 'decorators', 'comprehensions');
  }
  if (/习惯|规范|调试|测试|优化|性能/.test(text)) {
    points.push('studyHabit', 'errorProne');
  }

  // 去重
  return [...new Set(points.length > 0 ? points : ['syntax', 'data-types', 'operators', 'control-flow'])];
}

/** 统一读取系统全部状态 — 所有页面应通过此函数获取数据 */
export function getSystemSnapshot(): SystemSnapshot {
  let profile: StudentProfile | null = null;
  let practiceState: PracticeState | null = null;

  try {
    const raw = localStorage.getItem(userKey('studentProfile'));
    if (raw) profile = JSON.parse(raw);
  } catch {
    // localStorage 数据损坏时按「无画像」处理，不阻断快照生成
  }

  try {
    const raw = localStorage.getItem(userKey('practiceState'));
    if (raw) practiceState = JSON.parse(raw);
  } catch {
    // localStorage 数据损坏时按「无练习记录」处理
  }

  const report = practiceState?.lastEvaluationReport ?? null;
  const pathPlan = loadPathPlan();

  return {
    profile,
    practiceState,
    pathPlan,
    evaluationReport: report,
    loadedAt: new Date().toISOString(),
  };
}

/** 跨页面事件名常量 */
export const SYSTEM_EVENTS = {
  PROFILE_UPDATED: 'profileUpdated',
  PRACTICE_UPDATED: 'practiceStateUpdated',
  PATH_UPDATED: 'pathUpdated',
  EVALUATION_COMPLETED: 'evaluationCompleted',
} as const;

/** 广播系统事件，通知其他页面刷新 */
export function broadcastEvent(eventName: string, detail?: any) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/** 保存画像并通知其他页面 */
export function saveProfileAndNotify(profile: StudentProfile) {
  profile.updatedAt = new Date().toISOString();
  localStorage.setItem(userKey('studentProfile'), JSON.stringify(profile));
  broadcastEvent(SYSTEM_EVENTS.PROFILE_UPDATED, { profile });
}

/** 从 localStorage 读取画像（各页面统一入口） */
export function loadProfileFromStorage(): StudentProfile | null {
  try {
    const raw = localStorage.getItem(userKey('studentProfile'));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
