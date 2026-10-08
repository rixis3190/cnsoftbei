/**
 * 多智能体协同框架
 * 实现不同角色智能体的协作与通信
 */

import { streamChatCompletion } from './api';
import type { ChatMessage } from './api';
import type { ResourceType, StudentProfile } from '../types';

// 智能体角色定义
export type AgentRole =
  | 'profile'      // 画像构建智能体
  | 'resource'     // 资源生成智能体
  | 'path'         // 路径规划智能体
  | 'tutor'        // 辅导答疑智能体
  | 'assessment';  // 效果评估智能体

// 智能体状态
export type AgentStatus = 'idle' | 'thinking' | 'speaking' | 'completed' | 'error';

// 智能体消息
export interface AgentMessage {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  content: string;
  timestamp: number;
}

// 智能体任务
export interface AgentTask {
  id: string;
  type: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgent?: AgentRole;
  result?: unknown;
  error?: string;
}

// 流式更新回调
export type StreamCallback = (delta: string, isThinking: boolean) => void;

// 智能体定义
export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  status: AgentStatus;
  lastMessage?: string;
  lastMessageTime?: number;
}

// 事件类型
export type AgentEventType =
  | 'task_assigned'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'message_received'
  | 'status_changed';

// 事件监听器（data 为 AgentTask 或状态对象，调用方需自行收窄）
type EventListener = (data: unknown) => void;

// ==================== 智能体定义 ====================

const AGENT_DEFINITIONS: Record<AgentRole, Omit<Agent, 'status' | 'lastMessage' | 'lastMessageTime'>> = {
  profile: {
    id: 'agent-profile',
    name: '画像构建智能体',
    role: 'profile',
    description: '通过对话分析学生学习特征，构建个性化画像',
    systemPrompt: `你是画像构建智能体。输入为学生基础信息与对话/测验文本。
严格输出以下 JSON（只输出 JSON，不要任何其他文字）：

{
  "user": {"id": "string", "name": "string", "major": "string", "grade": "string"},
  "knowledgeBase": [
    {"tag": "知识点标签", "mastery": "未接触|薄弱|一般|扎实", "score": 0-100, "source": "对话|练习|评估"}
  ],
  "cognitiveStyle": {"label": "视觉型|文字型|实践型|逻辑型", "source": "对话|评估"},
  "errorProne": [
    {"tag": "易错知识点", "count": 出现次数, "source": "练习|评估"}
  ],
  "learningPace": {"label": "快速接受|中等接受|慢接受", "estimatedStudyHours": 每周预估学时, "source": "对话|评估"},
  "interestDirection": {"labels": ["兴趣标签"], "source": "对话|评估"},
  "studyHabit": {"label": "边做边学|理论优先|刷题驱动", "source": "对话|评估"},
  "updatedAt": "ISO8601 时间戳",
  "source": "对话|练习|评估"
}

判定规则：
- mastery 由 score 映射：>=80→扎实，60-79→一般，30-59→薄弱，<30→未接触
- 对话中"熟练掌握""有经验"→score 70-90；"了解一点""学过但不熟"→score 40-60；"没学过""不会"→score 0-30
- 认知风格：反复提到"看视频""看图"→视觉型；"读文档""看书"→文字型；"敲代码""做项目"→实践型；"推导""原理"→逻辑型
- 兴趣方向：从对话中提取技术名词（Python、前端、机器学习、算法等）

错误处理：
- 若输入缺乏任何可推断信息，返回 {"error":"上下文不足，无法构建画像","updatedAt":"ISO8601","source":"对话"}
- 所有字段必须出现，无法推断的填 null 或 []，禁止编造`,
  },

  resource: {
    id: 'agent-resource',
    name: '资源生成智能体',
    role: 'resource',
    description: '依据学习需求生成多模态学习资源',
    systemPrompt: `你是资源生成智能体。输出纯 Markdown 文本（不要套 JSON 外壳），用户会直接阅读你的输出。

依资源类型定格式：
- document：引言→核心讲解（分 3-5 节）→总结。每节配示例，不少于 800 字
- mindmap：用 ## 主节点 + ### 子节点 + 嵌套列表呈现层级结构
- quiz：3 选择题 + 2 填空题 + 1 简答题，末尾附答案（## 答案）
- reading：主题简介 + 3-5 篇推荐（标题、链接、一句话推荐理由）
- video：5 分钟脚本，标注【画面】和【旁白】，分 开场/讲解/总结 三段
- codeCase：完整可运行代码 + 逐行注释 + 输入/输出示例，标注语言和版本

画像自适应：
- 视觉型学习者 → 多用 ASCII 图示、表格、结构图
- 实践型学习者 → 增加动手环节、练习题、代码任务
- 文字型学习者 → 深入的理论讲解和文档式结构
- 知识基础薄弱 → 降低起点，多配生活类比
- 包含易错点时 → 重点标注常见错误和避坑提示

内容约束：
- 知识点必须搭配具体示例，严禁纯理论堆砌
- 在末尾附一行 "🏷️ 覆盖知识点：tag1, tag2" 列出涉及的知识点标签`,
  },

  path: {
    id: 'agent-path',
    name: '路径规划智能体',
    role: 'path',
    description: '分析学习情况，规划个性化学习路径',
    systemPrompt: `你是路径规划智能体。输入包含学生画像（learningProfile）和学习目标字符串。
严格输出以下 JSON（只输出 JSON）：

{
  "pathId": "path-{timestamp}",
  "goal": "学习目标描述",
  "stages": [
    {
      "stageId": "stage-1|stage-2|stage-3|stage-4[|stage-5]",
      "stageName": "入门|基础|进阶|实战|专项强化",
      "stageGoal": "该阶段要达成的具体目标",
      "coreKnowledgePoints": ["知识点标签"],
      "estimatedHours": 预估小时数,
      "unlockCondition": {"previousStageMasteryRate": 70}
    }
  ],
  "totalEstimatedHours": 所有阶段 hours 之和,
  "updatedAt": "ISO8601",
  "source": "对话|评估"
}

规划规则：
1. 基础四阶段（必须包含）：入门→基础→进阶→实战
2. 若画像 errorProne 中知识点 ≥2 个且与学习目标相关，插入一个 stageName="专项强化" 的额外阶段，聚焦这些易错点
3. 兴趣方向匹配：若画像 interestDirection 中的标签与某个阶段知识点重叠，将该阶段前置
4. 前置依赖：确保每个阶段的核心知识点在前一阶段已覆盖或自然前置（如 functions 在 modules 之前）
5. estimatedHours 参考：快速接受→4-6h，中等接受→8-12h，慢接受→12-18h；专项强化阶段额外+4h
6. 知识基础薄弱的阶段增加 30% 时长，扎实的阶段缩短 30%

错误处理：
- 若缺少学习目标，返回 {"error":"缺少学习目标","updatedAt":"ISO8601","source":"对话"}`,
  },

  tutor: {
    id: 'agent-tutor',
    name: '智能辅导智能体',
    role: 'tutor',
    description: '即时答疑，提供多模态解答服务',
    systemPrompt: `你是智能辅导教师。输出纯 Markdown（不要 JSON 外壳），用户直接阅读。

问题类型路由：
- 概念解释（"什么是X"）→ ## 💡 直觉理解（一句话）+ ## 📖 核心原理 + ## 🌰 具体示例
- 代码问题（"怎么写X"）→ ## 🧠 思路分析 + ## 💻 代码实现（必须带注释）+ ## 🔍 关键点说明
- 对比问题（"X vs Y"）→ ## 📊 对比表格 + 各自适用场景 + 选型建议
- 调试问题（"为什么报错X"）→ ## 🐛 错误原因 + ## ✅ 解决方案 + ## 🛡️ 如何避免

通用原则：
1. 引导优先：先给思路提示 → 再展示完整解答
2. 代码必须可运行，标注语言，关键行加行内注释
3. 初学者（画像显示薄弱）→ 用生活类比，避免术语轰炸
4. 进阶者（画像显示扎实）→ 深入底层原理和最佳实践
5. 回答长度与问题匹配，简单问题 200 字内，复杂问题可充分展开
6. 追问时给出连贯深入的回答，不要复读之前的结论

输出末尾附（如有相关知识点）：
> 💪 想巩固一下吗？可以到练习中心找「知识点名称」相关的题目练手。`,
  },

  assessment: {
    id: 'agent-assessment',
    name: '效果评估智能体',
    role: 'assessment',
    description: '跟踪学习效果，提供多维度评估',
    systemPrompt: `你是效果评估智能体。输入包含练习结果（practiceState.results）、学生画像（learningProfile）、阶段信息（stage）。
严格输出以下 JSON（只输出 JSON）：

{
  "stageId": "当前阶段 ID",
  "stageName": "当前阶段名称",
  "masteryItems": [
    {
      "tag": "知识点标签",
      "masteryRate": 0-100,
      "correctCount": 正确题数,
      "questionCount": 总题数,
      "status": "薄弱|正常|扎实"
    }
  ],
  "weakKnowledgePoints": ["掌握率 < 60% 的知识点标签"],
  "profileUpdateInstructions": ["针对画像维度的具体调整动作"],
  "pathOptimizationInstructions": ["针对路径阶段的具体调整动作"],
  "practiceOptimizationInstructions": ["针对题目推送的具体调整动作"],
  "generatedAt": "ISO8601",
  "source": "评估"
}

判定规则：
- masteryRate = Math.round(correctCount / questionCount × 100)；questionCount 为 0 时 masteryRate=0，status="未接触"
- status 阈值：<60→薄弱，60-79→正常，≥80→扎实
- 所有 status="薄弱" 的 tag 必须出现在 weakKnowledgePoints 中

指令生成规则（每条必须包含具体知识点名和数值，禁止"加强学习""多练习"等空泛表述）：
- profileUpdateInstructions：格式 "将 {维度} 中 {tag} 标记为薄弱，level 降为低"
- pathOptimizationInstructions：格式 "在 {阶段名} 后插入专项强化阶段，聚焦 {tag}，预估 {N} 小时" 或 "压缩 {阶段名} 时长至 {N}h（已掌握率达 {X}%）"
- practiceOptimizationInstructions：格式 "下轮练习将 {tag} 占比提升至 {X}%" 或 "减少 {tag} 推送至 {X}%（已掌握）"

错误处理：
- 若练习数据为空，返回 {"error":"无练习数据，无法评估","stageId":"","stageName":"","generatedAt":"ISO8601","source":"评估"}`,
  },
};

// ==================== 多智能体调度器 ====================

class MultiAgentScheduler {
  private agents: Map<AgentRole, Agent> = new Map();
  private taskQueue: AgentTask[] = [];
  private eventListeners: Map<AgentEventType, EventListener[]> = new Map();
  private messageHistory: AgentMessage[] = [];
  private currentProfile: StudentProfile | null = null;

  constructor() {
    // 初始化所有智能体
    Object.values(AGENT_DEFINITIONS).forEach(def => {
      this.agents.set(def.role, {
        ...def,
        status: 'idle',
      });
    });
  }

  // 事件管理
  on(event: AgentEventType, listener: EventListener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  private emit(event: AgentEventType, data: unknown) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }

  // 获取智能体状态
  getAgent(role: AgentRole): Agent | undefined {
    return this.agents.get(role);
  }

  // 获取所有智能体状态
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // 更新学生画像
  setProfile(profile: StudentProfile) {
    this.currentProfile = profile;
  }

  // 获取画像
  getProfile(): StudentProfile | null {
    return this.currentProfile;
  }

  // 添加消息到历史
  addMessage(message: AgentMessage) {
    this.messageHistory.push(message);
  }

  // 获取消息历史
  getMessageHistory(): AgentMessage[] {
    return this.messageHistory;
  }

  // 创建任务
  createTask(type: string, input: unknown, assignedAgent?: AgentRole): AgentTask {
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      input,
      status: 'pending',
      assignedAgent,
    };
    this.taskQueue.push(task);
    this.emit('task_assigned', task);
    return task;
  }

  // 执行单智能体任务（支持流式回调）
  async executeTask(task: AgentTask, onStream?: StreamCallback, signal?: AbortSignal): Promise<string> {
    const agentRole = task.assignedAgent || this.inferAgentRole(task.type);
    const agent = this.agents.get(agentRole);

    if (!agent) {
      throw new Error(`Unknown agent role: ${agentRole}`);
    }

    // 更新智能体状态
    agent.status = 'thinking';
    this.emit('status_changed', { role: agentRole, status: 'thinking' });

    try {
      task.status = 'running';
      this.emit('task_started', task);

      const messages: ChatMessage[] = [
        { role: 'system', content: agent.systemPrompt },
      ];

      // 添加上下文
      if (this.currentProfile && agentRole !== 'profile') {
        messages.push({
          role: 'system',
          content: `当前学生画像：${JSON.stringify(this.currentProfile, null, 2)}`,
        });
      }

      // 添加任务输入
      if (typeof task.input === 'string') {
        messages.push({ role: 'user', content: task.input });
      } else {
        messages.push({ role: 'user', content: JSON.stringify(task.input, null, 2) });
      }

      // 调用大模型（使用流式）
      let fullResponse = '';
      const response = await streamChatCompletion(
        messages,
        (chunk, isThinking) => {
          if (!isThinking) {
            fullResponse += chunk;
            onStream?.(chunk, false);
          }
        },
        (thinking) => {
          onStream?.(`[思考中: ${thinking.substring(0, 50)}...]`, true);
        },
        signal
      );
      fullResponse = response;

      // 更新智能体状态
      agent.status = 'speaking';
      agent.lastMessage = fullResponse;
      agent.lastMessageTime = Date.now();
      this.emit('status_changed', { role: agentRole, status: 'speaking' });

      // 记录消息
      this.addMessage({
        id: `msg-${Date.now()}`,
        agentId: agent.id,
        agentRole,
        content: fullResponse,
        timestamp: Date.now(),
      });

      task.status = 'completed';
      task.result = fullResponse;
      task.output = fullResponse;

      agent.status = 'completed';
      this.emit('status_changed', { role: agentRole, status: 'completed' });
      this.emit('task_completed', task);

      return fullResponse;
    } catch (error) {
      const err = error as Error;
      task.status = 'failed';
      task.error = err.message;
      agent.status = 'error';
      this.emit('status_changed', { role: agentRole, status: 'error' });
      this.emit('task_failed', { task, error: err.message });
      throw error;
    }
  }

  // 推断智能体角色
  private inferAgentRole(type: string): AgentRole {
    if (type.includes('profile') || type.includes('画像')) return 'profile';
    if (type.includes('resource') || type.includes('生成') || type.includes('资源')) return 'resource';
    if (type.includes('path') || type.includes('路径') || type.includes('规划')) return 'path';
    if (type.includes('tutor') || type.includes('辅导') || type.includes('答疑')) return 'tutor';
    if (type.includes('assessment') || type.includes('评估') || type.includes('效果')) return 'assessment';
    return 'resource';
  }

  // 多智能体协作任务
  async executeCollaborativeTask(
    taskType: string,
    input: unknown,
    requiredAgents: AgentRole[]
  ): Promise<Record<AgentRole, string>> {
    const results: Record<AgentRole, string> = {} as Record<AgentRole, string>;

    // 依次执行每个智能体任务，上一个智能体的输出可能作为下一个的输入
    for (const role of requiredAgents) {
      const agent = this.agents.get(role);
      if (!agent) continue;

      // 为下一个智能体准备输入（可以包含前一个智能体的结果）
      let taskInput = input;
      if (results[requiredAgents[requiredAgents.indexOf(role) - 1]]) {
        const prevResult = results[requiredAgents[requiredAgents.indexOf(role) - 1]];
        taskInput = {
          originalInput: input,
          previousResult: prevResult,
        };
      }

      const task = this.createTask(taskType, taskInput, role);
      const result = await this.executeTask(task);
      results[role] = result;

      // 模拟协作延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

// 单例导出
export const multiAgentScheduler = new MultiAgentScheduler();

// ==================== 资源生成服务 ====================

export class ResourceGenerator {
  private scheduler: MultiAgentScheduler;

  constructor(scheduler: MultiAgentScheduler) {
    this.scheduler = scheduler;
  }

  // 生成单一资源（支持流式输出）
  async generateResource(
    type: ResourceType,
    topic: string,
    onProgress?: (step: string, progress: number) => void,
    onStream?: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const typeLabels: Record<ResourceType, string> = {
      document: '专业课程讲解文档',
      mindmap: '知识点思维导图',
      quiz: '练习题目',
      reading: '拓展阅读材料',
      video: '多模态教学视频/动画',
      codeCase: '代码类实操案例',
    };

    const prompts: Record<ResourceType, string> = {
      document: `请为"${topic}"生成一份详细的专业课程讲解文档，要求：
1. 结构清晰，包含引言、核心内容、总结
2. 适合大学生学习水平
3. 包含必要的示例和解释
4. 不少于800字`,

      mindmap: `请为"${topic}"生成一份知识点思维导图，要求：
1. 用Markdown格式展示层级结构
2. 包含主节点和分支节点
3. 逻辑清晰，层次分明
4. 覆盖核心知识点`,

      quiz: `请为"${topic}"生成一套练习题目，要求：
1. 包含3道选择题、2道填空题、1道编程题
2. 题目难度适中，符合大学课程水平
3. 编程题需要包含题目描述和参考解答
4. 答案放在最后`,

      reading: `请为"${topic}"生成一份拓展阅读材料，要求：
1. 介绍相关领域的最新发展或经典理论
2. 包含3-5篇参考文献/资料推荐
3. 适合想要深入学习的学生
4. 简明扼要，重点突出`,

      video: `请为"${topic}"生成一份教学视频脚本/动画分镜，要求：
1. 时长约3-5分钟
2. 包含开场、讲解、总结三个部分
3. 设计可视化元素和动画效果说明
4. 适合视觉学习者`,

      codeCase: `请为"${topic}"生成一份代码实操案例，要求：
1. 包含完整的可运行代码
2. 代码需要详细注释
3. 包含运行结果示例
4. 适合实践学习者
5. 标注使用的编程语言和版本`,
    };

    onProgress?.(`正在调用${typeLabels[type]}生成智能体...`, 20);

    const task = this.scheduler.createTask(
      `generate_${type}`,
      prompts[type],
      'resource'
    );

    // 使用流式执行任务
    let fullContent = '';
    const result = await this.scheduler.executeTask(task, (delta, isThinking) => {
      if (!isThinking && onStream) {
        onStream(delta);
      }
    }, signal);
    fullContent = result;

    onProgress?.(`${typeLabels[type]}生成完成`, 100);

    return fullContent;
  }

  // 批量生成资源（多智能体协作）
  async generateResources(
    types: ResourceType[],
    topic: string,
    onProgress?: (type: ResourceType, step: string, progress: number) => void,
    onStream?: (type: ResourceType, delta: string) => void,
    signal?: AbortSignal
  ): Promise<Record<ResourceType, string>> {
    const results: Record<ResourceType, string> = {} as Record<ResourceType, string>;
    const total = types.length;

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const baseProgress = (i / total) * 100;

      onProgress?.(type, `开始生成${type}...`, baseProgress);

      // 检查是否已取消
      if (signal?.aborted) throw new Error('生成已取消');

      // 用于累积当前资源的流式内容
      let currentContent = '';
      if (onStream) {
        results[type] = await this.generateResource(type, topic, (step, p) => {
          onProgress?.(type, step, baseProgress + (p / 100) * (100 / total));
        }, (delta) => {
          currentContent += delta;
          onStream(type, delta);
        }, signal);
        results[type] = currentContent || results[type];
      } else {
        results[type] = await this.generateResource(type, topic, (step, p) => {
          onProgress?.(type, step, baseProgress + (p / 100) * (100 / total));
        }, undefined, signal);
      }

      // 多智能体协作间隔
      if (i < types.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return results;
  }
}

// 导出便捷函数
export const resourceGenerator = new ResourceGenerator(multiAgentScheduler);
