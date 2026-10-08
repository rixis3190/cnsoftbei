import { streamChatCompletion } from './api';
import { jaccardText } from './tutorQuality';
import { buildGradeByAIMessages } from './promptBuilder';
import type {
  PracticeQuestion,
  PracticeResult,
  ModuleProgress,
  TagScore,
  PracticeState,
} from '../types';
import { questions, learningPlan, tagToChinese } from '../data/pythonQuestionBank';
import { initialProfile } from '../data/mockData';
import {
  appendLearningCycleLog,
  buildLearningEvaluationReport,
  syncLearningProfileFromPractice,
  saveProfileAndNotify,
  broadcastEvent,
  SYSTEM_EVENTS,
} from './learningOrchestrator';

// ==================== Tag → 画像维度映射 ====================
const TAG_TO_DIMENSION: Record<string, string> = {
  // 知识基础
  syntax: 'knowledgeBase',
  'data-types': 'knowledgeBase',
  operators: 'knowledgeBase',
  'control-flow': 'knowledgeBase',
  functions: 'knowledgeBase',
  modules: 'knowledgeBase',
  scope: 'knowledgeBase',
  OOP: 'knowledgeBase',
  classes: 'knowledgeBase',
  inheritance: 'knowledgeBase',
  polymorphism: 'knowledgeBase',
  exceptions: 'knowledgeBase',
  files: 'knowledgeBase',
  decorators: 'knowledgeBase',
  comprehensions: 'knowledgeBase',
  // 易错点
  errorProne: 'errorProne',
  // 学习习惯
  studyHabit: 'studyHabit',
  // 数据库知识
  '数据库基础': 'knowledgeBase',
  'SQL基础': 'knowledgeBase',
  '数据库约束': 'knowledgeBase',
  '数据库索引': 'knowledgeBase',
  '数据库事务': 'knowledgeBase',
  '多表查询': 'knowledgeBase',
  '数据库设计': 'knowledgeBase',
  '数据库运维': 'knowledgeBase',
  '数据库类型': 'knowledgeBase',
};

// ==================== 存储键名 ====================
import { userKey } from './storage';

export { learningPlan, questions, tagToChinese };

// ==================== 客观题判分 ====================
export function checkAnswer(question: PracticeQuestion, userAnswer: string): boolean {
  if (question.type === 'choice') {
    return userAnswer === question.correctAnswer;
  }
  if (question.type === 'truefalse') {
    const expected = question.trueFalseAnswer ? 'true' : 'false';
    return userAnswer === expected;
  }
  if (question.type === 'fill') {
    const expected = (question.fillAnswer || '').trim().toLowerCase();
    return userAnswer.trim().toLowerCase() === expected;
  }
  return false;
}

// ==================== AI 判分（简答题） ====================
export async function gradeByAI(
  question: PracticeQuestion,
  userAnswer: string,
  onChunk?: (text: string) => void
): Promise<number> {
  if (question.type === 'short') {
    // prompt 收敛到 promptBuilder，消除双份真相（计划 S3-5 / S6-1）
    const { system, user } = buildGradeByAIMessages(
      question.question,
      question.sampleAnswer ?? '',
      userAnswer,
    );
    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ];

    let fullResponse = '';
    await streamChatCompletion(
      messages,
      (chunk, isThinking) => {
        if (!isThinking) {
          fullResponse += chunk;
          onChunk?.(chunk);
        }
      },
    );

    // 提取数字分数 — 取所有匹配中的最高分（AI 常在解释中放低分，最终结论给合理分）
    const allScores = fullResponse.match(/\d+/g);
    if (allScores && allScores.length > 0) {
      const clampedScores = allScores
        .map(s => parseInt(s, 10))
        .map(n => Math.min(100, Math.max(0, n)));
      if (clampedScores.length > 0) return Math.max(...clampedScores);
    }
    return 0;
  }
  return 0;
}

// ==================== 答案相似度计算（Jaccard） ====================
/**
 * 相似度阈值（口径 = tutorQuality.jaccardText，中文 2-gram + 英文整词）。
 *
 * **口径变更记录（评审 MAJOR-1）**：本文件原有一套私有实现（中文单字 + 英文整词），
 * 计划 S3-5/S6-1 把它收敛到 `tutorQuality.jaccardText`（中文 2-gram + 英文整词）。
 * 两种口径的数值**并不相等**。下面每行都标明文本对，且与
 * `tests/unit/practiceGrader.test.ts` 的数值级用例一一对应（可复现）：
 *
 * | 文本对 | 旧口径（单字） | 新口径（2-gram） | 用例 |
 * |---|---|---|---|
 * | 完全相同的文本 | 1.000 | 1.000 | `完全相同 → 相似度 1.0` |
 * | 「Python 是一种解释型编程语言」/ 同句 + 「，支持面向对象」 | 0.647 | 0.625 | `仅差一个从句` |
 * | 「事务的隔离级别包括读未提交和读已提交」/ 「隔离级别共有四种，其中读未提交可能出现脏读」 | 0.308 | 0.207 | `同主题部分覆盖` |
 *
 * 即：新口径在部分覆盖区间整体**偏低约 0.02~0.10**。影响面：
 *   - 分支 1（相似但低分）判定更严格 → 漏报略增，误报减少（保守，可接受）；
 *   - 分支 2（差异大但高分）判定更敏感 → 会多触发 `gradeByAIVerified` 的 3 次评审。
 * 当前**刻意保留** 0.6 / 0.2 不动：教育场景里「判分明显偏高却放行」比多花几次评审更糟。
 * 若要重新标定，请用 tests/unit/practiceGrader.test.ts 里的分布回归用例做依据，
 * 不要凭感觉改数字。
 */
const SIMILARITY_HIGH = 0.6;
const SIMILARITY_LOW = 0.2;

// ==================== AI 判分合理性断言 ====================
export function assertScoreReasonable(
  score: number,
  userAnswer: string,
  sampleAnswer: string
): { reasonable: boolean; reason?: string } {
  // 两者都为空 — 无法比较，视为合理
  if (!userAnswer.trim() && !sampleAnswer.trim()) {
    return { reasonable: true };
  }

  const similarity = jaccardText(userAnswer, sampleAnswer);

  // 答案高度相似但分数过低
  if (similarity > SIMILARITY_HIGH && score < 40) {
    return {
      reasonable: false,
      reason: `答案相似度 ${(similarity * 100).toFixed(0)}% 但分数仅 ${score}，AI 判分可能偏低`,
    };
  }

  // 答案差异很大但分数过高
  if (similarity < SIMILARITY_LOW && score > 80) {
    return {
      reasonable: false,
      reason: `答案相似度仅 ${(similarity * 100).toFixed(0)}% 但分数 ${score}，AI 判分可能偏高`,
    };
  }

  // 用户答案为空或极短（排除空答案得 0 分的正常情况），分数应很低
  if (userAnswer.trim().length > 0 && userAnswer.trim().length < 5 && score > 30) {
    return {
      reasonable: false,
      reason: `答案仅 ${userAnswer.trim().length} 字但分数 ${score}，AI 判分可能偏高`,
    };
  }

  return { reasonable: true };
}

// ==================== AI 判分一致性校验（并发 3 次取中位数） ====================
export async function gradeByAIVerified(
  question: PracticeQuestion,
  userAnswer: string,
): Promise<{ score: number; confidence: 'high' | 'low'; details: number[] }> {
  if (question.type !== 'short') {
    return { score: 0, confidence: 'high', details: [] };
  }

  // 并发调用 3 次
  const results = await Promise.all(
    Array.from({ length: 3 }, () => gradeByAI(question, userAnswer))
  );

  // 取中位数
  const sorted = [...results].sort((a, b) => a - b);
  const median = sorted[1];

  // 计算偏差
  const maxDeviation = Math.max(
    Math.abs(sorted[0] - median),
    Math.abs(sorted[2] - median)
  );

  // 合理性断言
  const reasonableness = assertScoreReasonable(median, userAnswer, question.sampleAnswer || '');

  const confidence: 'high' | 'low' =
    maxDeviation > 20 || !reasonableness.reasonable ? 'low' : 'high';

  // 第一次结果不合理时自动重试一次
  if (confidence === 'low' && reasonableness.reasonable === false) {
    const retryResults = await Promise.all(
      Array.from({ length: 3 }, () => gradeByAI(question, userAnswer))
    );
    const retrySorted = [...retryResults].sort((a, b) => a - b);
    const retryMedian = retrySorted[1];
    const retryReasonable = assertScoreReasonable(retryMedian, userAnswer, question.sampleAnswer || '');

    if (retryReasonable.reasonable) {
      return {
        score: retryMedian,
        confidence: 'high',
        details: [...results, ...retryResults],
      };
    }
  }

  return { score: median, confidence, details: results };
}

// ==================== 计算模块进度 ====================
export function calculateModuleProgress(
  moduleId: string,
  results: PracticeResult[],
  allQuestions: PracticeQuestion[]
): ModuleProgress {
  const moduleQuestions = allQuestions.filter(q => q.moduleId === moduleId);
  const moduleResults = results.filter(r => r.moduleId === moduleId);

  const totalQuestions = moduleQuestions.length;
  const completedQuestions = moduleResults.length;

  // 客观题判分
  const objectiveResults = moduleResults.filter(r => r.isCorrect !== null);
  const correctCount = objectiveResults.filter(r => r.isCorrect).length;

  // 简答题统计
  const shortResults = moduleResults.filter(r => {
    const q = allQuestions.find(q => q.id === r.questionId);
    return q?.type === 'short';
  });
  const shortAnswerTotalScore = shortResults.reduce((sum, r) => sum + (r.aiScore || 0), 0);

  // 计算总分：客观题每题 50%权重，简答题每题 50%权重
  const objectiveCount = moduleQuestions.filter(q => q.type !== 'short').length;
  const objectiveScore = objectiveCount > 0
    ? (correctCount / objectiveCount) * 50
    : 0;
  const shortScore = totalQuestions > 0
    ? (shortAnswerTotalScore / 100) * 50
    : 0;

  const score = Math.round(objectiveScore + shortScore);

  return {
    moduleId,
    moduleName: learningPlan.modules.find(m => m.id === moduleId)?.name || moduleId,
    totalQuestions,
    completedQuestions,
    correctCount,
    shortAnswerCount: shortResults.length,
    shortAnswerGradedCount: shortResults.filter(r => r.aiScore !== undefined).length,
    shortAnswerTotalScore,
    score,
  };
}

// ==================== 计算 Tag 维度得分 ====================
export function calculateTagScores(
  results: PracticeResult[],
  allQuestions: PracticeQuestion[]
): TagScore[] {
  const tagMap = new Map<string, { total: number; correct: number }>();

  for (const result of results) {
    const question = allQuestions.find(q => q.id === result.questionId);
    if (!question) continue;

    // 加权正确贡献：客观题二值(0/1)，AI 判分题按 aiScore/100 加权
    let weightedCorrect: number;
    if (result.isCorrect === true) {
      weightedCorrect = 1;
    } else if (result.isCorrect === false) {
      weightedCorrect = 0;
    } else if (result.aiScore !== undefined) {
      weightedCorrect = result.aiScore / 100;
    } else {
      continue; // 未评分的简答题，跳过不参与计分
    }

    for (const tag of question.tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, { total: 0, correct: 0 });
      const entry = tagMap.get(tag)!;
      entry.total++;
      entry.correct += weightedCorrect;
    }
  }

  return Array.from(tagMap.entries()).map(([tag, data]) => ({
    tag,
    totalAnswered: data.total,
    correctCount: data.correct,
    score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }));
}

// ==================== 更新画像 ====================
export function updateProfileByTagScores(tagScores: TagScore[]) {
  if (tagScores.length === 0) return;

  const savedProfile = localStorage.getItem(userKey('studentProfile'));
  const profile = savedProfile ? JSON.parse(savedProfile) : { ...initialProfile };

  // 按 Tag 维度分组
  const dimensionScores: Record<string, { scores: number[]; count: number }> = {};

  for (const ts of tagScores) {
    const dimension = TAG_TO_DIMENSION[ts.tag] || ts.tag;
    if (!dimensionScores[dimension]) dimensionScores[dimension] = { scores: [], count: 0 };
    if (ts.totalAnswered > 0) {
      dimensionScores[dimension].scores.push(ts.score);
      dimensionScores[dimension].count++;
    }
  }

  // 计算每个画像维度的综合得分并更新
  const dimensionKeys = [
    'knowledgeBase', 'cognitiveStyle', 'errorProne',
    'learningPace', 'interestDirection', 'studyHabit',
  ];

  dimensionKeys.forEach(dimKey => {
    const entry = dimensionScores[dimKey];
    const dimIndex = profile.dimensions.findIndex((d: { key: string }) => d.key === dimKey);
    if (!entry || dimIndex === -1) return;

    const avgScore = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length;

    let level: '高' | '中' | '低' = '中';
    if (avgScore >= 80) level = '高';
    else if (avgScore < 50) level = '低';

    profile.dimensions[dimIndex] = {
      ...profile.dimensions[dimIndex],
      level,
      value: `通过练习测评，综合得分 ${Math.round(avgScore)}%，${level === '高' ? '掌握扎实' : level === '中' ? '有一定基础，需继续加强' : '基础薄弱，建议重点复习'}`,
    };
  });

  const syncedProfile = syncLearningProfileFromPractice(profile, tagScores);
  syncedProfile.dimensions = profile.dimensions;
  syncedProfile.updatedAt = new Date().toISOString();
  saveProfileAndNotify(syncedProfile);
  return syncedProfile;
}

// ==================== 持久化练习状态 ====================
export function loadPracticeState(): PracticeState | null {
  const saved = localStorage.getItem(userKey('practiceState'));
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function savePracticeState(state: PracticeState): void {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(userKey('practiceState'), JSON.stringify(state));
}

export function getOrCreatePracticeState(): PracticeState {
  const existing = loadPracticeState();
  if (existing) return existing;

  const state: PracticeState = {
    planId: learningPlan.id,
    results: [],
    moduleProgress: learningPlan.modules.map(m => calculateModuleProgress(m.id, [], questions)),
    tagScores: [],
    updatedAt: new Date().toISOString(),
  };
  savePracticeState(state);
  return state;
}

// ==================== 提交答题结果 ====================
export function submitAnswer(
  questionId: string,
  userAnswer: string,
  isCorrect: boolean | null,
  aiScore?: number
): PracticeState {
  const state = getOrCreatePracticeState();
  const previousProfile = localStorage.getItem(userKey('studentProfile'));

  // 更新或添加结果
  const existingIdx = state.results.findIndex(r => r.questionId === questionId);
  const result: PracticeResult = {
    questionId,
    moduleId: questions.find(q => q.id === questionId)?.moduleId || '',
    userAnswer,
    isCorrect,
    aiScore,
    submittedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    state.results[existingIdx] = result;
  } else {
    state.results.push(result);
  }

  // 重新计算模块进度
  state.moduleProgress = learningPlan.modules.map(m => calculateModuleProgress(m.id, state.results, questions));

  // 重新计算 Tag 得分
  state.tagScores = calculateTagScores(state.results, questions);

  const updatedProfile = updateProfileByTagScores(state.tagScores);
  if (updatedProfile?.learningProfile) {
    const question = questions.find(item => item.id === questionId);
    const moduleMeta = learningPlan.modules.find(module => module.id === (question?.moduleId ?? ''));
    if (moduleMeta) {
      const stage = {
        stageId: moduleMeta.id,
        stageName: moduleMeta.name,
        stageGoal: moduleMeta.description,
        coreKnowledgePoints: [...moduleMeta.tags],
        estimatedHours: Math.max(4, questions.filter(q => q.moduleId === moduleMeta.id).length),
        unlockCondition: {
          previousStageMasteryRate: 70,
        },
      };
      const evaluationReport = buildLearningEvaluationReport(
        updatedProfile.learningProfile,
        stage,
        state,
      );

      state.lastEvaluationReport = evaluationReport;
      state.cycleLogs = appendLearningCycleLog(state.cycleLogs, {
        source: '练习',
        before: {
          profile: previousProfile ? JSON.parse(previousProfile).learningProfile ?? null : null,
        },
        after: {
          profile: updatedProfile.learningProfile,
          evaluation: evaluationReport,
        },
        notes: evaluationReport.profileUpdateInstructions,
      });
    }
  }

  savePracticeState(state);
  broadcastEvent(SYSTEM_EVENTS.PRACTICE_UPDATED, { state });
  return state;
}

// ==================== 重置练习状态 ====================
export function resetPracticeState(): PracticeState {
  const state: PracticeState = {
    planId: learningPlan.id,
    results: [],
    moduleProgress: learningPlan.modules.map(m => calculateModuleProgress(m.id, [], questions)),
    tagScores: [],
    updatedAt: new Date().toISOString(),
  };
  savePracticeState(state);
  return state;
}
