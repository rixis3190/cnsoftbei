import { useState, useRef, useEffect } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, Steps, Progress, List, Avatar, Collapse, Modal, message } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  AimOutlined,
  DownOutlined,
  ReloadOutlined,
  CloseOutlined,
  LockOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { mockLearningPath, mockResources, smartRecommendations } from '../data/mockData';
import { streamChatCompletion } from '../services/api';
import { saveCurrentPathStage, inferKnowledgePoints } from '../services/learningOrchestrator';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { usePageCache } from '../context/PageCacheContext';
import type { LearningPath, LearningNode, StudentProfile } from '../types';
import { userKey } from '../services/storage';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const PAGE_KEY = 'path';

function loadProfile(): StudentProfile | null {
  try {
    const saved = localStorage.getItem(userKey('studentProfile'));
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function buildProfileContext(profile: StudentProfile | null): string {
  if (!profile || !profile.dimensions?.length) return '';
  const dimMap: Record<string, string> = {};
  profile.dimensions.forEach(d => { dimMap[d.key] = d.value; });

  return `【当前学生画像】
- 知识基础：${dimMap.knowledgeBase || '未知'}
- 认知风格：${dimMap.cognitiveStyle || '未知'}
- 学习节奏：${dimMap.learningPace || '未知'}
- 兴趣方向：${dimMap.interestDirection || '未知'}
- 学习习惯：${dimMap.studyHabit || '未知'}

请根据以上学生画像，调整学习路径的难度、深度和风格。例如：
- 知识基础薄弱的同学 → 更多基础内容，节奏放慢
- 实践型学习者 → 增加动手实践节点
- 视觉型学习者 → 增加图解、视频类学习资源
- 有特定兴趣方向 → 优先安排相关主题
- 学习节奏慢的同学 → 增加复习节点，减少每阶段内容量`;
}

const Path: React.FC<{ onNavigate?: (key: string) => void }> = ({ onNavigate }) => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const [pathData, setPathData] = useState<LearningPath>(() => {
    const cached = cachedState?.pathData;
    if (cached) {
      return {
        ...cached,
        nodes: cached.nodes.map((n: LearningNode) => ({
          ...n,
          status: (n.status as string) === 'pending' ? 'locked' : n.status,
        })),
      };
    }
    return mockLearningPath;
  });
  const [activeNode, setActiveNode] = useState<string>(() => cachedState?.activeNode ?? mockLearningPath.currentNodeId);
  const [isPlanning, setIsPlanning] = useState<boolean>(() => {
    // 跨页面切换后 AbortController 已丢失，强制重置为 false
    return false;
  });
  const [planningResult, setPlanningResult] = useState<string | null>(() => cachedState?.planningResult ?? null);
  const [currentPlanText, setCurrentPlanText] = useState<string>(() => cachedState?.currentPlanText ?? '');
  const [showSteps, setShowSteps] = useState(false);
  const [isChangingPath, setIsChangingPath] = useState(false);
  const [skipModalNode, setSkipModalNode] = useState<{ id: string; title: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 缓存状态变化
  useEffect(() => {
    saveState({ pathData, activeNode, isPlanning, planningResult, currentPlanText });
  }, [pathData, activeNode, isPlanning, planningResult, currentPlanText, saveState]);

  // 调用AI生成个性化学习路径（流式）
  const generateLearningPath = async (topic: string) => {
    setIsPlanning(true);
    setCurrentPlanText('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const profileCtx = buildProfileContext(loadProfile());

      const systemPromptContent = `你是路径规划智能体，专门为学生制定个性化的学习路径。
${profileCtx ? '\n' + profileCtx + '\n' : ''}
请根据用户输入的学习主题或专业方向，生成一个详细的学习路径规划。
${profileCtx ? '\n请务必根据以上学生画像调整学习路径的难度、深度和风格。' : ''}

要求：
1. 按照知识点的依赖关系排序（前置知识必须先学）
2. 每个阶段有明确的目标和内容
3. 包含预估学习时间
4. 用清晰的层级结构展示

请用以下JSON格式输出（只输出JSON，不要其他内容）：
{
  "title": "学习路径名称",
  "description": "路径描述",
  "nodes": [
    {
      "title": "阶段1名称",
      "description": "阶段描述",
      "estimatedHours": 8,
      "resources": ["相关资源描述1", "资源2"]
    },
    ...
  ]
}`;

      const messages = [
        { role: 'system' as const, content: systemPromptContent },
        { role: 'user' as const, content: `请为"${topic}"生成一个完整的个性化学习路径规划` },
      ];

      let fullResponse = '';
      let hasJsonParsed = false;

      await streamChatCompletion(
        messages,
        (chunk, isThinking) => {
          if (!isThinking) {
            fullResponse += chunk;
            if (!hasJsonParsed) {
              setCurrentPlanText(prev => prev + chunk);
            }
          }
        },
        () => {
          // 思考过程处理
        },
        controller.signal,
      );

      // 尝试解析JSON
      try {
        let jsonStr = fullResponse;
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1] || jsonMatch[0];
        }

        const planData = JSON.parse(jsonStr.includes('{') ? jsonStr.substring(jsonStr.indexOf('{')).replace(/```/g, '') : jsonStr);
        hasJsonParsed = true;

        const newNodes = planData.nodes.map((node: any, index: number) => ({
          id: `node-${index + 1}`,
          title: node.title,
          description: node.description,
          status: index === 0 ? 'in-progress' as const : 'locked' as const,
          progress: 0,
          estimatedHours: node.estimatedHours || 8,
        }));

        setPathData({
          id: 'path-ai',
          title: planData.title || `${topic}学习路径`,
          description: planData.description || 'AI生成的个性化学习路径',
          nodes: newNodes,
          estimatedTime: `${Math.round(newNodes.reduce((sum: number, n: LearningNode) => sum + (n.estimatedHours || 8), 0) / 40)}周`,
          currentNodeId: newNodes[0]?.id || 'node-1',
        });

        setActiveNode(newNodes[0]?.id || 'node-1');
        setPlanningResult('学习路径规划完成！');

        // 持久化第一阶段，供练习中心使用
        const firstNode = newNodes[0];
        if (firstNode) {
          saveCurrentPathStage({
            stageName: firstNode.title,
            stageGoal: firstNode.description,
            coreKnowledgePoints: inferKnowledgePoints(firstNode.title, firstNode.description),
          });
        }

        setIsChangingPath(false);
        setShowSteps(false);
        message.success('AI已为您生成个性化学习路径');

      } catch (parseError) {
        console.error('Failed to parse path planning result:', parseError);
        setPlanningResult('路径解析异常，请查看生成内容');
      }

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        message.info('已取消路径生成');
      } else {
        console.error('Path planning failed:', error);
        message.error('路径规划失败：' + error.message);
      }
    } finally {
      setIsPlanning(false);
      abortRef.current = null;
    }
  };

  const doStartLearning = (nodeId: string) => {
    // 检查是否有真实的练习数据，计算初始进度
    let initialProgress = 0;
    try {
      const psRaw = localStorage.getItem(userKey('practiceState'));
      if (psRaw) {
        const ps = JSON.parse(psRaw);
        if (ps.moduleProgress?.length) {
          const totalQ = ps.moduleProgress.reduce((sum: number, m: { totalQuestions: number }) => sum + m.totalQuestions, 0);
          const completedQ = ps.moduleProgress.reduce((sum: number, m: { completedQuestions: number }) => sum + m.completedQuestions, 0);
          if (totalQ > 0) {
            initialProgress = Math.round((completedQ / totalQ) * 100);
          }
        }
      }
    } catch {
      // 路径数据损坏时按 0% 进度兜底，不阻断节点状态更新
    }

    const updatedNodes = pathData.nodes.map(node => {
      if (node.id === nodeId) {
        return { ...node, status: 'in-progress' as const, progress: initialProgress };
      }
      if (node.status === 'in-progress') {
        return { ...node, status: 'locked' as const };
      }
      return node;
    });
    const newPathData = { ...pathData, nodes: updatedNodes, currentNodeId: nodeId };
    setPathData(newPathData);
    setActiveNode(nodeId);

    // 保存当前阶段到本地存储，供练习中心按阶段标签筛选题目
    const currentNode = pathData.nodes.find(n => n.id === nodeId);
    const kps = inferKnowledgePoints(currentNode?.title || '', currentNode?.description);
    saveCurrentPathStage({
      stageName: currentNode?.title || '',
      stageGoal: currentNode?.description || '',
      coreKnowledgePoints: kps,
    });

    saveState({ pathData: newPathData, activeNode: nodeId, isPlanning, planningResult, currentPlanText });
    onNavigate?.('practice');
  };

  const handleStartLearning = (nodeId: string) => {
    const node = pathData.nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.status === 'in-progress') {
      onNavigate?.('practice');
    } else if (node.status === 'completed') {
      onNavigate?.('practice');
    } else {
      setSkipModalNode({ id: nodeId, title: node.title });
    }
  };

  const handleSkipConfirm = () => {
    if (skipModalNode) {
      doStartLearning(skipModalNode.id);
    }
    setSkipModalNode(null);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleGenerate = () => {
    const value = inputRef.current?.value || '';
    if (value.trim()) {
      generateLearningPath(value);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'in-progress':
        return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
      case 'locked':
        return <LockOutlined style={{ color: '#d9d9d9' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'in-progress':
        return '#1890ff';
      case 'locked':
        return '#d9d9d9';
      default:
        return '#d9d9d9';
    }
  };

  const SUGGESTED_TOPICS = ['Python', 'Java', '机器学习', '数据结构与算法', '前端开发'];

  const renderTopicInput = (placeholder: string, btnText: string, recLabel: string, disableInput: boolean) => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space.Compact style={{ width: '100%' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isPlanning) {
              handleGenerate();
            }
          }}
          disabled={isPlanning || disableInput}
        />
        {isPlanning ? (
          <Button danger icon={<CloseOutlined />} onClick={handleCancel}>取消</Button>
        ) : (
          <Button type="primary" icon={<RobotOutlined />} onClick={handleGenerate}>{btnText}</Button>
        )}
      </Space.Compact>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{recLabel}</Text>
        {SUGGESTED_TOPICS.map(t => (
          <Button key={t} type="link" size="small" style={{ padding: '0 4px' }} onClick={() => generateLearningPath(t)} disabled={isPlanning}>{t}</Button>
        ))}
      </div>
      {isPlanning && (
        <Card size="small" style={{ background: '#f5f5f5', marginTop: 8 }}>
          <Text type="secondary">正在规划：</Text>
          <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12, marginTop: 8 }}>
            {currentPlanText ? (
              <MarkdownRenderer content={currentPlanText} />
            ) : (
              <Text type="secondary">AI 正在思考中...</Text>
            )}
            <span style={{ animation: 'blink 1s infinite' }}>|</span>
          </div>
        </Card>
      )}
    </Space>
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>个性化学习路径</Title>
      <Text type="secondary">基于您的学习画像和目标，智能规划学习步骤与顺序</Text>

      {/* AI路径规划入口 */}
      {planningResult && !isPlanning && !isChangingPath ? (
        <Card style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Avatar icon={<AimOutlined />} style={{ background: '#faad14' }} />
              <div>
                <Text strong>{pathData.title}</Text>
                <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>已规划</Tag>
              </div>
            </Space>
            <Space>
              <Button
                icon={<DownOutlined rotate={showSteps ? 180 : 0} />}
                onClick={() => setShowSteps(!showSteps)}
              >
                {showSteps ? '隐藏学习步骤' : '查看学习步骤'}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => setIsChangingPath(true)}>
                更换学习路径
              </Button>
            </Space>
          </div>
        </Card>
      ) : planningResult && !isPlanning && isChangingPath ? (
        <Card style={{ marginTop: 24, borderColor: '#1890ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Avatar icon={<AimOutlined />} style={{ background: '#faad14' }} />
              <div>
                <Text strong>{pathData.title}</Text>
                <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>已规划</Tag>
              </div>
            </Space>
            <Button icon={<CloseOutlined />} onClick={() => setIsChangingPath(false)}>取消更换</Button>
          </div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>输入新学习主题，生成新路径：</Text>
          {renderTopicInput('输入新主题，如：机器学习、数据结构...', '生成新路径', '快速推荐：', false)}
        </Card>
      ) : (
        <Card style={{ marginTop: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Avatar icon={<AimOutlined />} style={{ background: '#faad14' }} />
              <div>
                <Text strong>AI智能路径规划</Text>
                <br />
                <Text type="secondary">基于您的学习画像，自动生成最优学习路径</Text>
              </div>
            </Space>
            {renderTopicInput('输入您想学习的主题，如：Python面向对象编程、机器学习...', '生成路径', '推荐学习：', false)}
          </Space>
        </Card>
      )}

      {/* 路径概览 */}
      <Card style={{ marginTop: 24 }}>
        <Row gutter={24}>
          <Col span={16}>
            <Space direction="vertical">
              <Title level={4} style={{ marginBottom: 0 }}>{pathData.title}</Title>
              <Text type="secondary">{pathData.description}</Text>
            </Space>
          </Col>
          <Col span={8}>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">预计完成时间</Text>
                <br />
                <Text strong style={{ fontSize: 18 }}>{pathData.estimatedTime}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">当前进度</Text>
                <br />
                <Text strong style={{ fontSize: 18 }}>
                  {Math.round((pathData.nodes.filter(n => n.status === 'completed').length / pathData.nodes.length) * 100)}%
                </Text>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* 学习步骤可视化 */}
      {(!planningResult || showSteps) && (
        <Card title="学习步骤" style={{ marginTop: 24 }}>
          <Steps
            current={pathData.nodes.findIndex(n => n.id === pathData.currentNodeId)}
            items={pathData.nodes.map(node => ({
              title: node.title,
              description: node.status === 'in-progress' ? `进行中 - ${node.progress}%` : node.status === 'completed' ? '已完成' : '未解锁',
              icon: getStatusIcon(node.status),
            }))}
          />
        </Card>
      )}

      {/* 学习节点详情 */}
      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={16}>
          <Card title="学习内容">
            <Collapse
              accordion
              activeKey={activeNode}
              onChange={(keys) => setActiveNode(keys.length > 0 ? keys[0] : '')}
            >
              {pathData.nodes.map((node) => (
                <Panel
                  key={node.id}
                  header={
                    <Space>
                      {getStatusIcon(node.status)}
                      <Text strong>{node.title}</Text>
                      {node.status === 'in-progress' && (
                        <Tag color="blue">进行中</Tag>
                      )}
                      {node.status === 'completed' && (
                        <Tag color="success">已完成</Tag>
                      )}
                      {node.status === 'locked' && (
                        <Tag color="default">未解锁</Tag>
                      )}
                    </Space>
                  }
                  extra={
                    node.status === 'locked' ? (
                      <Button size="small" icon={<LockOutlined />} onClick={() => handleStartLearning(node.id)}>
                        开始学习
                      </Button>
                    ) : node.status === 'in-progress' ? (
                      <Button size="small" icon={<PlayCircleOutlined />} onClick={() => onNavigate?.('practice')}>
                        继续学习
                      </Button>
                    ) : (
                      <Button size="small" icon={<EyeOutlined />} onClick={() => onNavigate?.('practice')}>
                        查看回顾
                      </Button>
                    )
                  }
                >
                  {node.status === 'in-progress' && (
                    <Progress percent={node.progress} status="active" style={{ marginBottom: 16 }} />
                  )}
                  <Text type="secondary">{node.description}</Text>
                  {node.estimatedHours && (
                    <div style={{ marginTop: 8 }}>
                      <Tag icon={<ClockCircleOutlined />}>预估时长：{node.estimatedHours}小时</Tag>
                    </div>
                  )}
                </Panel>
              ))}
            </Collapse>
          </Card>
        </Col>

        {/* 右侧：路径统计 */}
        <Col span={8}>
          <Card title="路径统计">
            <Space direction="vertical" style={{ width: '100%' }}>
              {pathData.nodes.map(node => (
                <div key={node.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      {getStatusIcon(node.status)}
                      <Text style={{ color: node.status === 'locked' ? '#999' : '#000' }}>{node.title}</Text>
                    </Space>
                    <Text type="secondary">{node.progress}%</Text>
                  </div>
                  <Progress
                    percent={node.progress}
                    showInfo={false}
                    size="small"
                    strokeColor={getStatusColor(node.status)}
                    style={{ marginTop: 4, marginBottom: 12 }}
                  />
                </div>
              ))}
            </Space>
          </Card>

          <Card title="智能推荐" style={{ marginTop: 16 }}>
            <List
              size="small"
              dataSource={smartRecommendations}
              renderItem={item => (
                <List.Item>
                  <Space direction="vertical" size="small">
                    <Text>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.reason}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 资源推送预览 */}
      <Card title="个性化资源推送" style={{ marginTop: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          基于您的学习进度和画像，系统为您智能推送以下资源
        </Text>
        <Row gutter={16}>
          {mockResources.slice(0, 4).map(resource => (
            <Col span={6} key={resource.id}>
              <Card size="small" hoverable>
                <Card.Meta
                  avatar={
                    <Avatar shape="square" style={{ background: '#1890ff' }}>
                      {resource.type[0].toUpperCase()}
                    </Avatar>
                  }
                  title={<Text style={{ fontSize: 12 }}>{resource.title}</Text>}
                  description={<Tag color="blue">精准推送</Tag>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 跳过确认弹窗 */}
      <Modal
        title="切换学习阶段"
        open={skipModalNode !== null}
        onOk={handleSkipConfirm}
        onCancel={() => setSkipModalNode(null)}
        okText="确认进入"
        cancelText="取消"
      >
        <p>你尚未完成前面阶段的学习，直接学习 <strong>{skipModalNode?.title}</strong> 可能会因基础不足影响学习效果。</p>
        <p>确定要进入该阶段吗？</p>
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

export default Path;