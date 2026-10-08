import { useState, useRef, useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Modal, Form, Input, Select, Slider, Progress, message, Row, Col, Descriptions, Avatar, Spin, Radio } from 'antd';
import { UserOutlined, EditOutlined, SaveOutlined, ReloadOutlined, SendOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import { initialProfile, defaultChatMessages, quizQuestionBank, quizSelectionCounts, dimensionOptions } from '../data/mockData';
import { streamChatCompletion } from '../services/api';
import type { StudentProfile, ProfileDimension } from '../types';
import { usePageCache } from '../context/usePageCache';
import { buildLearningProfileSnapshot, saveProfileAndNotify } from '../services/learningOrchestrator';
import { buildProfileAnalysisPrompt, buildProfileReplyPrompt, buildQuizAnalysisPrompt } from '../services/promptBuilder';
import { userKey } from '../services/storage';
import { useAuth } from '../context/useAuth';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PAGE_KEY = 'profile';

// 测试题目 - 覆盖6个维度的学习画像评估
interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  dimension: string;
  dimensionLabel: string;
  type: 'knowledge' | 'self-assessment';
  correctAnswer?: number;
}

/** 会话缓存内容：跨页面切换时需要保留的画像页状态 */
interface ProfileCacheState {
  profile: StudentProfile;
  isModalOpen: boolean;
  chatMessages: { role: string; content: string; isStreaming?: boolean }[];
  inputValue: string;
  isAnalyzing: boolean;
  currentReply: string;
  isQuizModalOpen: boolean;
  quizStep: number;
  quizAnswers: Record<number, string>;
  isQuizAnalyzing: boolean;
  selectedQuestions: QuizQuestion[];
}

// 从题库中随机抽取题目
function selectQuizQuestions(): QuizQuestion[] {
  const grouped = new Map<string, Omit<QuizQuestion, 'id'>[]>();
  quizQuestionBank.forEach(q => {
    if (!grouped.has(q.dimension)) grouped.set(q.dimension, []);
    grouped.get(q.dimension)!.push(q);
  });

  const selected: QuizQuestion[] = [];
  let id = 1;

  grouped.forEach((questions, dimension) => {
    const count = quizSelectionCounts[dimension] || 2;
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    shuffled.slice(0, count).forEach(q => {
      selected.push({ ...q, id: id++ });
    });
  });

  // 打乱题目顺序
  return selected.sort(() => Math.random() - 0.5).map((q, i) => ({ ...q, id: i + 1 }));
}

const Profile: React.FC = () => {
  const { cachedState, saveState } = usePageCache<ProfileCacheState>(PAGE_KEY);
  const { currentUser } = useAuth();

  // 加载画像：localStorage > 缓存 > 当前用户信息兜底
  const loadInitialProfile = (): StudentProfile => {
    try {
      const saved = localStorage.getItem(userKey('studentProfile'));
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    if (cachedState?.profile) return cachedState.profile;
    return {
      ...initialProfile,
      id: currentUser?.id || initialProfile.id,
      name: currentUser?.name || initialProfile.name,
    };
  };

  const [profile, setProfile] = useState<StudentProfile>(loadInitialProfile);
  const [isModalOpen, setIsModalOpen] = useState(() => cachedState?.isModalOpen ?? false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; isStreaming?: boolean }[]>(() => cachedState?.chatMessages ?? defaultChatMessages);
  const [inputValue, setInputValue] = useState(() => cachedState?.inputValue ?? '');
  const [isAnalyzing, setIsAnalyzing] = useState(() => cachedState?.isAnalyzing ?? false);
  const [currentReply, setCurrentReply] = useState(() => cachedState?.currentReply ?? '');

  // 测试相关状态
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(() => cachedState?.isQuizModalOpen ?? false);
  const [quizStep, setQuizStep] = useState(() => cachedState?.quizStep ?? 0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>(() => cachedState?.quizAnswers ?? {});
  const [isQuizAnalyzing, setIsQuizAnalyzing] = useState(() => cachedState?.isQuizAnalyzing ?? false);
  const [selectedQuestions, setSelectedQuestions] = useState<QuizQuestion[]>(() => cachedState?.selectedQuestions ?? []);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  // 缓存状态变化（使用序列化比较避免 selectedQuestions 对象数组导致频繁写入）
  const prevStateRef = useRef<string>('');
  useEffect(() => {
    const stateObj = { profile, isModalOpen, chatMessages, inputValue, isAnalyzing, currentReply, isQuizModalOpen, quizStep, quizAnswers, isQuizAnalyzing, selectedQuestions };
    const serialized = JSON.stringify(stateObj);
    if (serialized !== prevStateRef.current) {
      prevStateRef.current = serialized;
      saveState(stateObj);
    }
  }, [profile, isModalOpen, chatMessages, inputValue, isAnalyzing, currentReply, isQuizModalOpen, quizStep, quizAnswers, isQuizAnalyzing, selectedQuestions, saveState]);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, currentReply]);

  // 调用AI分析用户输入并更新画像（流式）
  const analyzeAndUpdateProfile = async (userMessage: string) => {
    setIsAnalyzing(true);
    setCurrentReply('');

    try {
      // 构建分析请求
      const { system, user } = buildProfileAnalysisPrompt(profile, userMessage);
      const messages = [
        { role: 'system' as const, content: system },
        { role: 'user' as const, content: user },
      ];

      let fullResponse = '';
      let hasAnalysis = false;

      // 使用流式调用
      await streamChatCompletion(
        messages,
        (chunk, isThinking) => {
          if (!isThinking) {
            fullResponse += chunk;
            // 实时更新回复（用于分析JSON输出后的部分）
            if (hasAnalysis && chunk.length > 0) {
              setCurrentReply((prev: string) => prev + chunk);
            }
          }
        },
        () => {
          // 处理思考过程
        }
      );

      // 尝试解析JSON响应
      try {
        // 提取JSON（可能在markdown代码块中）
        let jsonStr = fullResponse;
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1] || jsonMatch[0];
        }

        const analysis = JSON.parse(jsonStr.includes('{') ? jsonStr.substring(jsonStr.indexOf('{')).replace(/```/g, '') : jsonStr);
        hasAnalysis = true;

        // 更新画像维度
        const nextProfile: StudentProfile = (() => {
          const updatedDimensions = [...profile.dimensions];

          const dimensionKeys: (keyof typeof analysis)[] = [
            'knowledgeBase', 'cognitiveStyle', 'errorProne',
            'learningPace', 'interestDirection', 'studyHabit'
          ];

          dimensionKeys.forEach((key, index) => {
            if (analysis[key]) {
              let level: '高' | '中' | '低' = '中';
              const content = analysis[key].toLowerCase();
              if (content.includes('强') || content.includes('扎实') || content.includes('熟练')) {
                level = '高';
              } else if (content.includes('弱') || content.includes('薄弱') || content.includes('不足')) {
                level = '低';
              }

              if (updatedDimensions[index]) {
                updatedDimensions[index] = {
                  ...updatedDimensions[index],
                  value: analysis[key],
                  level,
                };
              }
            }
          });

          const updatedProfile = {
            ...profile,
            dimensions: updatedDimensions,
            updatedAt: new Date().toISOString(),
            learningProfile: buildLearningProfileSnapshot({
              ...profile,
              dimensions: updatedDimensions,
              updatedAt: new Date().toISOString(),
            }, '对话'),
          };
          setProfile(updatedProfile);
          return updatedProfile;
        })();

        saveProfileAndNotify(nextProfile);

      } catch (parseError) {
        console.error('Failed to parse analysis result:', parseError);
        message.warning('AI 返回格式异常，部分维度可能未更新，请重试描述');
      }

      // 生成简短的智能体回复
      const replyMessages = [
        { role: 'system' as const, content: buildProfileReplyPrompt(userMessage) },
        { role: 'assistant' as const, content: '' },
      ];

      let replyContent = '';
      await streamChatCompletion(
        replyMessages,
        (chunk, isThinking) => {
          if (!isThinking) {
            replyContent += chunk;
            setCurrentReply(replyContent);
          }
        }
      );

      setChatMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
      setCurrentReply('');
      message.success('画像已更新');

    } catch (error) {
      console.error('Profile analysis failed:', error);
      const simpleResponse = generateSimpleResponse(userMessage);
      setChatMessages(prev => [...prev, { role: 'assistant', content: simpleResponse }]);
      setCurrentReply('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 简单的本地分析（API失败时降级）
  const generateSimpleResponse = (message: string): string => {
    const msg = message.toLowerCase();
    if (msg.includes('python') || msg.includes('编程')) {
      return '好的，我已经记录了您的编程学习背景。基于这个信息，我会为您推荐相关的学习资源和练习题目。';
    }
    if (msg.includes('人工智能') || msg.includes('ai') || msg.includes('机器学习')) {
      return '人工智能是非常热门的研究方向！我会为您规划相关的学习路径，包括数学基础、机器学习算法到深度学习。';
    }
    if (msg.includes('基础') || msg.includes('薄弱')) {
      return '明白了，我会针对您的知识基础调整学习内容的难度，确保您能够循序渐进地掌握知识。';
    }
    return '收到！我已经根据您的描述更新了学习画像。您可以继续告诉我更多关于您的学习情况，我会不断完善画像。';
  };

  // ===== 测试相关函数 =====

  // 开始测试：随机抽题，重置状态，打开弹窗
  const startQuiz = () => {
    const questions = selectQuizQuestions();
    setSelectedQuestions(questions);
    setQuizStep(0);
    setQuizAnswers({});
    setIsQuizAnalyzing(false);
    setIsQuizModalOpen(true);
  };

  // 提交测试答案并调用AI分析
  const handleQuizSubmit = async () => {
    setIsQuizModalOpen(false);
    setIsQuizAnalyzing(true);

    // 构建答题详情文本
    const answerSummary = selectedQuestions.map(q => {
      const answer = quizAnswers[q.id] || '未作答';
      return `${q.id}. [${q.dimensionLabel}] ${q.question}\n   我的答案: ${answer}`;
    }).join('\n\n');

    try {
      const messages = [
        {
          role: 'system' as const,
          content: buildQuizAnalysisPrompt(),
        },
        {
          role: 'user' as const,
          content: `以下是我的学习画像测试答案，请分析：\n\n${answerSummary}`,
        },
      ];

      let fullResponse = '';

      await streamChatCompletion(
        messages,
        (chunk, isThinking) => {
          if (!isThinking) {
            fullResponse += chunk;
          }
        },
      );

      // 解析 AI 返回的 JSON
      let analysis: Record<string, string> | null = null;
      try {
        let jsonStr = fullResponse;
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1] || jsonMatch[0];
        }
        jsonStr = jsonStr.includes('{') ? jsonStr.substring(jsonStr.indexOf('{')).replace(/```/g, '') : jsonStr;
        analysis = JSON.parse(jsonStr);
      } catch {
        console.error('Failed to parse AI quiz analysis, using fallback');
      }

      if (analysis) {
        applyQuizAnalysis(analysis);
      } else {
        applyFallbackProfile();
      }

    } catch (error) {
      console.error('Quiz analysis failed:', error);
      applyFallbackProfile();
    } finally {
      setIsQuizAnalyzing(false);
    }
  };

  // 将分析结果应用到画像
  const applyQuizAnalysis = (analysis: Record<string, string>) => {
    const dimensionKeys: (keyof typeof analysis)[] = [
      'knowledgeBase', 'cognitiveStyle', 'errorProne',
      'learningPace', 'interestDirection', 'studyHabit',
    ];

    const nextProfile: StudentProfile = (() => {
      const updatedDimensions = [...profile.dimensions];

      dimensionKeys.forEach((key, index) => {
        if (analysis[key] && updatedDimensions[index]) {
          let level: '高' | '中' | '低' = '中';
          const content = analysis[key].toLowerCase();
          if (content.includes('强') || content.includes('扎实') || content.includes('熟练') || content.includes('丰富') || content.includes('深入')) {
            level = '高';
          } else if (content.includes('弱') || content.includes('薄弱') || content.includes('不足') || content.includes('欠缺')) {
            level = '低';
          }

          updatedDimensions[index] = {
            ...updatedDimensions[index],
            value: analysis[key],
            level,
          };
        }
      });

      const updatedProfile = {
        ...profile,
        dimensions: updatedDimensions,
        updatedAt: new Date().toISOString(),
        learningProfile: buildLearningProfileSnapshot({
          ...profile,
          dimensions: updatedDimensions,
          updatedAt: new Date().toISOString(),
        }, '对话'),
      };
      setProfile(updatedProfile);
      return updatedProfile;
    })();

    localStorage.setItem(userKey('studentProfile'), JSON.stringify(nextProfile));
    message.success('测试完成！画像已根据您的答题结果更新');
  };

  // 降级方案：根据答题结果前端规则推断画像
  const applyFallbackProfile = () => {
    // 计算知识题正确率
    const knowledgeQuestions = selectedQuestions.filter(q => q.type === 'knowledge');
    let correctCount = 0;
    knowledgeQuestions.forEach(q => {
      if (q.correctAnswer !== undefined && quizAnswers[q.id]) {
        const selectedOption = quizAnswers[q.id];
        if (selectedOption === q.options[q.correctAnswer]) {
          correctCount++;
        }
      }
    });
    const accuracy = knowledgeQuestions.length > 0 ? correctCount / knowledgeQuestions.length : 0.5;

    // 根据自评题推断各维度
    const getAnswerForDimension = (dim: string): string[] => {
      return selectedQuestions
        .filter(q => q.dimension === dim && quizAnswers[q.id])
        .map(q => quizAnswers[q.id]);
    };

    const cognitiveAnswers = getAnswerForDimension('cognitiveStyle');
    const errorAnswers = getAnswerForDimension('errorProne');
    const paceAnswers = getAnswerForDimension('learningPace');
    const interestAnswers = getAnswerForDimension('interestDirection');
    const habitAnswers = getAnswerForDimension('studyHabit');

    const knowledgeLevel = accuracy >= 0.75 ? '扎实' : accuracy >= 0.5 ? '一般' : '有待加强';
    const knowledgeValue = `知识测试正确率 ${Math.round(accuracy * 100)}%，基础${knowledgeLevel}`;

    const cognitiveValue = cognitiveAnswers.length > 0
      ? `偏好${cognitiveAnswers[0].includes('阅读') ? '阅读文档学习' : cognitiveAnswers[0].includes('视频') ? '观看视频学习' : cognitiveAnswers[0].includes('实践') ? '动手实践学习' : '多样化学习方式'}`
      : '学习方式待进一步了解';

    const errorValue = errorAnswers.length > 0
      ? `常见困难：${errorAnswers[0].substring(0, 20)}`
      : '易错点待进一步了解';

    const paceValue = paceAnswers.length > 0
      ? `学习节奏：${paceAnswers[0].includes('快') ? '较快，喜欢高效推进' : paceAnswers[0].includes('稳步') ? '稳健，注重深度理解' : '随内容灵活调整'}`
      : '学习节奏待进一步了解';

    const interestValue = interestAnswers.length > 0
      ? `兴趣方向：${interestAnswers[0].substring(0, 25)}`
      : '兴趣方向待进一步了解';

    const habitValue = habitAnswers.length > 0
      ? `学习习惯：${habitAnswers[0].includes('课程') ? '结构化学习' : habitAnswers[0].includes('项目') ? '项目驱动学习' : habitAnswers[0].includes('文档') ? '文档深读型' : '灵活学习'}`
      : '学习习惯待进一步了解';

    const fallbackAnalysis: Record<string, string> = {
      knowledgeBase: knowledgeValue,
      cognitiveStyle: cognitiveValue,
      errorProne: errorValue,
      learningPace: paceValue,
      interestDirection: interestValue,
      studyHabit: habitValue,
    };

    applyQuizAnalysis(fallbackAnalysis);
  };

  const handleChatSend = async () => {
    if (!inputValue.trim()) return;
    if (isAnalyzing) return;

    const userMessage = inputValue;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');

    await analyzeAndUpdateProfile(userMessage);
  };

  const handleAddDimension = () => {
    form.validateFields().then(values => {
      const newDimension: ProfileDimension = {
        key: `dim-${Date.now()}`,
        label: values.label,
        value: values.value,
        level: values.level,
      };
      setProfile(prev => ({
        ...prev,
        dimensions: [...prev.dimensions, newDimension],
        updatedAt: new Date().toISOString(),
      }));
      message.success('已添加新的画像维度');
      form.resetFields();
    });
  };

  const loadSavedProfile = () => {
    const saved = localStorage.getItem(userKey('studentProfile'));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfile(parsed);
        message.success('已加载保存的画像');
      } catch {
        message.error('加载失败');
      }
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case '高': return 'success';
      case '中': return 'processing';
      case '低': return 'warning';
      default: return 'default';
    }
  };

  const getLevelProgress = (level: string) => {
    switch (level) {
      case '高': return 90;
      case '中': return 60;
      case '低': return 30;
      default: return 50;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>学习画像</Title>
      <Text type="secondary">基于对话构建的个性化学习特征分析</Text>

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* 左侧：画像展示 */}
        <Col span={14}>
          <Card
            title={
              <Space>
                <UserOutlined />
                <span>我的学习画像</span>
              </Space>
            }
            extra={
              <Space>
                <Button type="primary" onClick={startQuiz} size="small">
                  开始测试
                </Button>
                <Button icon={<ReloadOutlined />} onClick={loadSavedProfile} size="small">
                  加载已保存
                </Button>
                <Button icon={<EditOutlined />} onClick={() => setIsModalOpen(true)}>
                  编辑画像
                </Button>
              </Space>
            }
          >
            <Descriptions bordered column={2}>
              <Descriptions.Item label="姓名">{profile.name}</Descriptions.Item>
              <Descriptions.Item label="专业">{profile.major}</Descriptions.Item>
              <Descriptions.Item label="年级">{profile.grade}</Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(profile.updatedAt).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Title level={5}>六大维度分析</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                系统通过对话自动分析您的学习特征，构建包含6个维度的动态画像
              </Text>

              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {profile.dimensions.map((dim, index) => (
                  <Card key={index} size="small" style={{ background: '#fafafa' }}>
                    <Row gutter={16} align="middle">
                      <Col span={4}>
                        <Space direction="vertical">
                          <Avatar style={{ background: dim.level === '高' ? '#52c41a' : dim.level === '中' ? '#1890ff' : '#faad14' }}>
                            {dim.label[0]}
                          </Avatar>
                          <Tag color={getLevelColor(dim.level)}>{dim.level}</Tag>
                        </Space>
                      </Col>
                      <Col span={16}>
                        <Text strong>{dim.label}</Text>
                        <br />
                        <Text type="secondary">{dim.value}</Text>
                      </Col>
                      <Col span={4}>
                        <Progress
                          percent={getLevelProgress(dim.level)}
                          size="small"
                          showInfo={false}
                          strokeColor={dim.level === '高' ? '#52c41a' : dim.level === '中' ? '#1890ff' : '#faad14'}
                        />
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Space>
            </div>
          </Card>
        </Col>

        {/* 右侧：对话式画像构建 */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                <span>对话式画像构建</span>
                {isAnalyzing && <Tag color="processing" icon={<LoadingOutlined />}>AI分析中</Tag>}
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ height: 400, overflowY: 'auto', marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                    marginBottom: 12,
                  }}
                >
                  <Space align="start" style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                    )}
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: msg.role === 'user' ? '#1890ff' : '#fff',
                        color: msg.role === 'user' ? '#fff' : '#000',
                        maxWidth: '80%',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {msg.content}
                      {msg.isStreaming && <span style={{ animation: 'blink 1s infinite' }}>|</span>}
                    </div>
                    {msg.role === 'user' && (
                      <Avatar size="small" style={{ background: '#52c41a' }}>我</Avatar>
                    )}
                  </Space>
                </div>
              ))}

              {/* 正在生成的回复 */}
              {currentReply && (
                <div style={{ textAlign: 'left', marginBottom: 12 }}>
                  <Space align="start">
                    <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#fff',
                        maxWidth: '80%',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      }}
                    >
                      {currentReply}
                      <span style={{ display: 'inline-block', width: 8, height: 16, background: '#1890ff', marginLeft: 2, animation: 'blink 1s infinite', verticalAlign: 'middle' }} />
                    </div>
                  </Space>
                </div>
              )}

              {isAnalyzing && !currentReply && (
                <div style={{ textAlign: 'left', marginBottom: 12 }}>
                  <Space align="start">
                    <Avatar size="small" style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff' }}>
                      <Spin size="small" /> 正在分析您的学习特征...
                    </div>
                  </Space>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入你的学习情况..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={handleChatSend}
                disabled={isAnalyzing}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleChatSend}
                loading={isAnalyzing}
              >
                发送
              </Button>
            </Space.Compact>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                提示：告诉我您的专业、学习目标、兴趣方向等信息，我会自动分析并更新您的学习画像
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 测试弹窗 */}
      <Modal
        title={
          <Space>
            <span>学习画像测试</span>
            <Tag color="blue">第 {quizStep + 1}/{selectedQuestions.length} 题</Tag>
          </Space>
        }
        open={isQuizModalOpen}
        onCancel={() => setIsQuizModalOpen(false)}
        footer={null}
        width={640}
        maskClosable={false}
        keyboard={false}
      >
        {/* 进度条 */}
        <Progress
          percent={Math.round(((quizStep + 1) / selectedQuestions.length) * 100)}
          showInfo={false}
          style={{ marginBottom: 24 }}
          strokeColor={{
            '0%': '#1890ff',
            '100%': '#52c41a',
          }}
        />

        {/* 题目卡片 */}
        {selectedQuestions[quizStep] && (
          <Card
            style={{ marginBottom: 24, background: '#fafafa' }}
            styles={{ body: { padding: 24 } }}
          >
            <Space style={{ marginBottom: 16 }}>
              <Tag color="processing">{selectedQuestions[quizStep].dimensionLabel}</Tag>
              {selectedQuestions[quizStep].type === 'knowledge' && (
                <Tag color="warning">知识题</Tag>
              )}
              {selectedQuestions[quizStep].type === 'self-assessment' && (
                <Tag color="default">自评题</Tag>
              )}
            </Space>

            <Title level={4} style={{ marginBottom: 24 }}>
              {quizStep + 1}. {selectedQuestions[quizStep].question}
            </Title>

            <Radio.Group
              value={quizAnswers[selectedQuestions[quizStep].id]}
              onChange={e => {
                setQuizAnswers(prev => ({
                  ...prev,
                  [selectedQuestions[quizStep].id]: e.target.value,
                }));
              }}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {selectedQuestions[quizStep].options.map((option, idx) => (
                  <Radio
                    key={idx}
                    value={option}
                    style={{
                      display: 'block',
                      padding: '12px 16px',
                      background: quizAnswers[selectedQuestions[quizStep].id] === option ? '#e6f4ff' : '#fff',
                      borderRadius: 8,
                      border: quizAnswers[selectedQuestions[quizStep].id] === option ? '1px solid #1890ff' : '1px solid #d9d9d9',
                      width: '100%',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>
                      <Text strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + idx)}.</Text>
                      {option}
                    </Text>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Card>
        )}

        {/* 导航按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            onClick={() => setQuizStep((prev: number) => Math.max(0, prev - 1))}
            disabled={quizStep === 0}
          >
            上一题
          </Button>

          <Text type="secondary">
            按数字键 1-4 快速选择
          </Text>

          {quizStep < selectedQuestions.length - 1 ? (
            <Button
              type="primary"
              onClick={() => {
                if (quizAnswers[selectedQuestions[quizStep].id]) {
                  setQuizStep((prev: number) => prev + 1);
                } else {
                  message.warning('请先选择一个选项');
                }
              }}
            >
              下一题
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={handleQuizSubmit}
              disabled={Object.keys(quizAnswers).length < selectedQuestions.length}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              提交测试
            </Button>
          )}
        </div>

        {/* 键盘快捷键 */}
        <style>{`
          .ant-radio-wrapper {
            margin-right: 0 !important;
          }
        `}</style>
      </Modal>

      {/* AI分析中的loading提示 */}
      <Modal
        title={null}
        open={isQuizAnalyzing}
        footer={null}
        closable={false}
        width={400}
        centered
        maskClosable={false}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin size="large" />
          <Title level={4} style={{ marginTop: 16 }}>
            AI 正在分析您的测试结果...
          </Title>
          <Text type="secondary">
            根据您的 {Object.keys(quizAnswers).length} 道答题结果，
            <br />
            多智能体系统正在从 6 个维度构建您的学习画像
          </Text>
        </div>
      </Modal>

      {/* 添加新维度弹窗 */}
      <Modal
        title="编辑学习画像"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="维度名称" rules={[{ required: true, message: '请输入维度名称' }]}>
            <Select
              placeholder="选择或输入维度名称"
              options={dimensionOptions}
            />
          </Form.Item>
          <Form.Item name="value" label="具体描述" rules={[{ required: true, message: '请输入具体描述' }]}>
            <TextArea rows={3} placeholder="详细描述该维度的特征..." />
          </Form.Item>
          <Form.Item name="level" label="水平等级" rules={[{ required: true, message: '请选择等级' }]}>
            <Slider marks={{ '高': '高', '中': '中', '低': '低' }} min={1} max={3} step={null} />
          </Form.Item>
          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleAddDimension}>
              保存
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>

      {/* 添加闪烁动画样式 */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Profile;