/**
 * promptBuilder — AI Prompt 构造层
 *
 * 将分散在各组件中的 prompt 构造逻辑收敛为可测试的纯函数。
 * 所有函数无副作用，只接收数据、返回字符串。
 */

import type { StudentProfile, QAItem } from '../types';
import { userKey } from './storage';

// ==================== 画像加载 ====================

/** 从 localStorage 加载学生画像 */
export function loadProfile(): StudentProfile | null {
  try {
    const saved = localStorage.getItem(userKey('studentProfile'));
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

// ==================== 画像上下文 ====================

/** 将画像 6 维度格式化为 prompt 注入文本 */
export function buildProfileContext(profile: StudentProfile | null): string {
  if (!profile || !profile.dimensions?.length) return '';
  const dimMap: Record<string, string> = {};
  profile.dimensions.forEach(d => { dimMap[d.key] = d.value; });

  return `\n\n【当前学生画像】
- 姓名：${profile.name}，专业：${profile.major}，年级：${profile.grade}
- 知识基础：${dimMap.knowledgeBase || '未知'}
- 认知风格：${dimMap.cognitiveStyle || '未知'}
- 易错点：${dimMap.errorProne || '未知'}
- 学习节奏：${dimMap.learningPace || '未知'}
- 兴趣方向：${dimMap.interestDirection || '未知'}
- 学习习惯：${dimMap.studyHabit || '未知'}

请根据以上画像调整回答风格和深度。`;
}

// ==================== Tutor 模式 Prompt ====================

const MODE_PROMPTS: Record<string, string> = {
  text: '你是一位专业的AI辅导老师，请详细解答用户的问题。用清晰的结构回答，包含必要的解释和示例。',
  image: '你是一位专业的AI辅导老师，请解答用户的问题并生成可视化图解说明。尽量用ASCII图或结构化方式来展示概念。',
  video: '你是一位专业的AI辅导老师，请为用户提供视频讲解脚本。内容包括开场、讲解步骤、总结，每部分时间控制在1分钟内。',
  code: '你是一位专业的编程老师，请为用户提供完整的代码示例。代码要包含注释和运行说明。',
};

/** 获取指定模式的 base prompt */
export function getModePrompt(mode: string): string {
  return MODE_PROMPTS[mode] || MODE_PROMPTS.text;
}

/** 构建 Tutor 完整 system prompt（模式 + 画像） */
export function buildTutorSystemPrompt(mode: string, profile: StudentProfile | null): string {
  const basePrompt = getModePrompt(mode);
  const profileCtx = buildProfileContext(profile);
  return basePrompt + profileCtx;
}

// ==================== 追问 Prompt ====================

/** 构建追问场景的 system prompt */
export function buildFollowUpSystemPrompt(profile: StudentProfile | null): string {
  const profileCtx = buildProfileContext(profile);
  return `${getModePrompt('text')}${profileCtx}

用户可能正在基于之前的回答进行追问或提出新问题。请根据上下文判断：
- 如果新问题与之前的问答主题相关 → 将其视为追问，结合上下文给出连贯深入的回复
- 如果新问题与之前的问答完全无关 → 将其视为全新问题，忽略之前的上下文

注意：不要显式输出你的判断过程，直接给出最合适的回答。`;
}

/** 构建追问场景的 user prompt（包含父问答） */
export function buildFollowUpUserPrompt(parentQA: QAItem, newQuestion: string): string {
  return `之前的问答：
问：${parentQA.question}
答：${parentQA.answer.substring(0, 2000)}

用户的新输入：${newQuestion}`;
}

// ==================== 点踩重生成 Prompt ====================

/** 构建点踩重生成的 system prompt */
export function buildRegenerateSystemPrompt(profile: StudentProfile | null): string {
  const profileCtx = buildProfileContext(profile);
  return `你是一位专业的AI辅导老师。用户对之前的回答点了"踩"，现在重新提问同一问题。${profileCtx}
1. 简要分析旧回答为什么让用户不满意
2. 给出全新的、明显不同的高质量回答

请严格按以下格式输出（用markdown）：
## 📊 原因分析
（2-3句话分析旧回答不足）
## ✅ 重新解答
（全新的回答）`;
}

/** 构建点踩重生成的 user prompt */
export function buildRegenerateUserPrompt(question: string, oldAnswer: string): string {
  return `原始问题：${question}\n\n之前的回答（用户不满意）：${oldAnswer.substring(0, 1500)}\n\n请分析原因并重新解答。`;
}

// ==================== 相关性判断 Prompt ====================

/** 构建追问相关性判断的 system prompt */
export function buildRelevanceCheckPrompt(): string {
  return '你是一个问题相关性判断助手。判断用户的新问题是否与之前讨论的主题相关。仅回复"相关"或"无关"，不要输出其他任何内容。';
}

// ==================== Profile 画像分析 Prompt ====================

/** 构建画像分析的 system prompt（对话模式） */
export function buildProfileAnalysisPrompt(profile: StudentProfile, userMessage: string): { system: string; user: string } {
  return {
    system: `你是画像构建智能体，专门分析学生的学习特征。
当前学生画像：
姓名：${profile.name}
专业：${profile.major}
年级：${profile.grade}

已有维度：
${profile.dimensions.map(d => `- ${d.label}: ${d.value} (${d.level})`).join('\n')}

请分析用户的下一条输入，提取或更新以下维度的信息：
1. 知识基础 - 用户当前的技术水平
2. 认知风格 - 用户喜欢的学习方式（视觉/听觉/动手等）
3. 易错点偏好 - 用户经常遇到困难的地方
4. 学习节奏 - 用户学习的快慢和习惯
5. 兴趣方向 - 用户感兴趣的技术领域
6. 学习习惯 - 用户的学习方法和习惯

请用JSON格式输出分析结果，格式如下（只输出JSON，不要其他内容）：
{
  "knowledgeBase": "分析出的知识基础描述",
  "cognitiveStyle": "分析出的认知风格",
  "errorProne": "分析出的易错点",
  "learningPace": "分析出的学习节奏",
  "interestDirection": "分析出的兴趣方向",
  "studyHabit": "分析出的学习习惯"
}`,
    user: userMessage,
  };
}

/** 构建画像分析后的简短回复 prompt */
export function buildProfileReplyPrompt(userMessage: string): string {
  return `你是画像构建智能体，友好、专业地回应用户的输入。根据刚才的分析结果，给出一个简短（50字以内）的肯定性回复，并可以追问一个关于学习的问题。用户输入是："${userMessage}"`;
}

/** 构建测试答题分析的 system prompt */
export function buildQuizAnalysisPrompt(): string {
  return `你是画像构建智能体，专门分析学生的学习特征。请根据用户的测试答案，从以下6个维度分析其学习特征：

1. 知识基础 - 根据知识题的答题情况评估用户当前技术水平
2. 认知风格 - 根据用户偏好的学习方式判断（视觉型/听觉型/动手型/阅读型）
3. 易错点偏好 - 用户经常遇到困难的地方
4. 学习节奏 - 用户学习的快慢和深度偏好
5. 兴趣方向 - 用户感兴趣的技术领域
6. 学习习惯 - 用户的学习方法和习惯

请用JSON格式输出分析结果（只输出JSON，不要其他内容）：
{
  "knowledgeBase": "一句话描述知识基础水平",
  "cognitiveStyle": "认知风格描述",
  "errorProne": "易错点和薄弱环节描述",
  "learningPace": "学习节奏描述",
  "interestDirection": "兴趣方向描述",
  "studyHabit": "学习习惯描述"
}

注意：
- 知识基础维度要根据知识题的正确情况给出客观评价（"扎实"/"一般"/"有待加强"等）
- 每个维度的value应该是完整的一句话描述，不少于10个字
- 根据用户的自评选项推断其特点，不要简单复述选项文字`;
}

// ==================== practiceGrader AI 判分 Prompt ====================

/** 构建 AI 判分的 messages（system + user） */
/**
 * 质量评审 prompt（收敛自 Tutor.tsx 内联的评审提示词，计划 S3-4）
 * 只输出整数：LLM-as-judge 的分数漂移是已知风险（T3-R4），温度已配置化。
 */
export function buildQualityReviewPrompt(): string {
  return '你是一个严格的教育内容质量评审员。请评估以下回答的质量（0-100分）。评分标准：准确性(40%)、完整性(30%)、清晰度(20%)、实用性(10%)。只输出一个整数分数。';
}

/** 评审请求的 messages（便于单测断言 prompt 内容） */
export function buildQualityReviewMessages(
  questionText: string,
  answer: string,
): { system: string; user: string } {
  return {
    system: buildQualityReviewPrompt(),
    user: `问题：${questionText}\n\n回答：${answer.substring(0, 2000)}\n\n请只输出一个0-100的整数分数。`,
  };
}

/**
 * 把拦截原因转成重生成反馈（计划 S3-4）。
 * 单条原因时保持既有措辞（避免改变 Tutor 原有的重试提示），
 * 多条原因时列点给出可执行的改进方向。
 */
export function buildRagRegenerateHint(reasons: readonly string[]): string {
  if (reasons.length === 0) return ''
  if (reasons.length === 1) {
    return `你的回答质量评分仅偏低：${reasons[0]}。请改进回答的准确性、完整性和清晰度，重新回答。`;
  }
  const list = reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
  return `你的回答质量评分偏低，问题如下：\n${list}\n请针对以上问题改进回答的准确性、完整性和清晰度，重新回答。`;
}

export function buildGradeByAIMessages(
  questionText: string,
  sampleAnswer: string,
  userAnswer: string,
): { system: string; user: string } {
  return {
    system: `你是一个严谨的编程教育评估专家。请根据参考答案为用户的答案评分（0-100分）。
评分标准：
- 90-100：正确理解题意，答案完整准确，有深度
- 70-89：基本正确，有少量遗漏或小错误
- 50-69：理解部分题意，答案有较多不完整或错误
- 20-49：理解基本错误，答案偏离题意
- 0-19：完全错误或未作答

请严格按此标准评分，不要随意给高分。`,
    user: `题目：${questionText}

参考答案：${sampleAnswer}

用户答案：${userAnswer}

请只输出一个0-100的整数分数，不要输出其他内容。`,
  };
}
