import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Tag, Space, Button, Row, Col, Avatar, Spin, Progress, Modal, Form, Input, Checkbox, message, Alert } from 'antd';
import {
  FileTextOutlined,
  AimOutlined,
  ReadOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { multiAgentScheduler, resourceGenerator, type AgentRole } from '../services/multiAgentFramework';
import type { ResourceType, StudentProfile } from '../types';
import { resourceTypeMeta, resourceAgentDisplay } from '../data/mockData';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { usePageCache } from '../context/PageCacheContext';
import { userKey } from '../services/storage';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PAGE_KEY = 'resources';

/** 会话缓存内容：跨页面切换时需要保留的资源生成页状态 */
interface ResourcesCacheState {
  generating: boolean;
  progress: Record<ResourceType, number>;
  currentStep: string;
  isModalOpen: boolean;
  selectedTypes: ResourceType[];
  learningNeed: string;
  error: string | null;
  streamingContent: Record<ResourceType, string>;
  streamingType: ResourceType | null;
  isComplete: boolean;
}

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  FileTextOutlined: <FileTextOutlined />,
  AimOutlined: <AimOutlined />,
  ThunderboltOutlined: <ThunderboltOutlined />,
  ReadOutlined: <ReadOutlined />,
  PlayCircleOutlined: <PlayCircleOutlined />,
  CodeOutlined: <CodeOutlined />,
};

// 资源类型配置（从集中数据构建）
const resourceTypeConfig: Record<ResourceType, { icon: React.ReactNode; color: string; label: string; desc: string }> = {} as Record<ResourceType, { icon: React.ReactNode; color: string; label: string; desc: string }>;
for (const [key, meta] of Object.entries(resourceTypeMeta)) {
  resourceTypeConfig[key as ResourceType] = {
    icon: iconMap[meta.iconName] || <FileTextOutlined />,
    color: meta.color,
    label: meta.label,
    desc: meta.desc,
  };
}

// 读取学生画像
function loadProfile(): StudentProfile | null {
  try {
    const saved = localStorage.getItem(userKey('studentProfile'));
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

// 构建画像上下文文本
function buildProfileContext(profile: StudentProfile | null): string {
  if (!profile || !profile.dimensions?.length) return '';
  const dimMap: Record<string, string> = {};
  profile.dimensions.forEach(d => { dimMap[d.key] = d.value; });

  return `\n\n学生画像参考：
- 姓名：${profile.name}，专业：${profile.major}，年级：${profile.grade}
- 知识基础水平：${dimMap.knowledgeBase || '未知'}
- 认知风格：${dimMap.cognitiveStyle || '未知'}
- 兴趣方向：${dimMap.interestDirection || '未知'}
- 易错点：${dimMap.errorProne || '未知'}
- 学习节奏：${dimMap.learningPace || '未知'}
- 学习习惯：${dimMap.studyHabit || '未知'}

请根据以上画像调整资源内容的难度、深度和呈现方式。`;
}

// 流式内容卡片组件
const StreamingContentCard: React.FC<{
  type: ResourceType;
  content: string;
  isStreaming: boolean;
}> = ({ type, content, isStreaming }) => {
  const config = resourceTypeConfig[type];

  return (
    <Card
      size="small"
      style={{ borderTop: `3px solid ${config.color}` }}
      title={
        <Space>
          {config.icon}
          <span>{config.label}</span>
          {isStreaming && <Tag color="processing" icon={<LoadingOutlined />}>生成中</Tag>}
          {!isStreaming && <Tag color="success">已完成</Tag>}
        </Space>
      }
      extra={<Tag icon={<RobotOutlined />}>资源生成智能体</Tag>}
    >
      <div
        style={{
          background: type === 'codeCase' ? '#1e1e1e' : type === 'mindmap' ? '#f5f5f5' : '#fafafa',
          padding: 16,
          borderRadius: 8,
          maxHeight: 400,
          overflow: 'auto',
        }}
      >
        {content ? (
          <MarkdownRenderer content={content} />
        ) : (
          <span style={{ color: '#999' }}>正在生成...</span>
        )}
        {isStreaming && (
          <span style={{ display: 'inline-block', width: 8, height: 16, background: '#1890ff', marginLeft: 2, animation: 'blink 1s infinite' }} />
        )}
      </div>
    </Card>
  );
};

const Resources: React.FC = () => {
  const { cachedState, saveState } = usePageCache<ResourcesCacheState>(PAGE_KEY);

  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setStreamingType(null);
    message.info('已取消生成');
  };
  const [progress, setProgress] = useState<Record<ResourceType, number>>(() => cachedState?.progress ?? {} as Record<ResourceType, number>);
  const [currentStep, setCurrentStep] = useState(() => cachedState?.currentStep ?? '');
  const [isModalOpen, setIsModalOpen] = useState(() => cachedState?.isModalOpen ?? false);
  const [selectedTypes, setSelectedTypes] = useState<ResourceType[]>(() => cachedState?.selectedTypes ?? []);
  const [learningNeed, setLearningNeed] = useState(() => cachedState?.learningNeed ?? '');
  const [error, setError] = useState<string | null>(() => cachedState?.error ?? null);

  // 流式内容状态
  const [streamingContent, setStreamingContent] = useState<Record<ResourceType, string>>(() => cachedState?.streamingContent ?? {} as Record<ResourceType, string>);
  const [streamingType, setStreamingType] = useState<ResourceType | null>(() => cachedState?.streamingType ?? null);
  const [isComplete, setIsComplete] = useState(() => {
    const cachedContent = cachedState?.streamingContent ?? {};
    // 有缓存内容且不在生成中 → 视为已完成
    return cachedState?.isComplete ?? (Object.keys(cachedContent).length > 0 && !cachedState?.generating);
  });

  const [form] = Form.useForm();

  // 缓存状态变化
  useEffect(() => {
    saveState({ generating, progress, currentStep, isModalOpen, selectedTypes, learningNeed, error, streamingContent, streamingType, isComplete });
  }, [generating, progress, currentStep, isModalOpen, selectedTypes, learningNeed, error, streamingContent, streamingType, isComplete, saveState]);

  // 获取智能体状态
  const getAgentStatus = (role: AgentRole) => {
    const agent = multiAgentScheduler.getAgent(role);
    return agent?.status || 'idle';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'thinking': return '#1890ff';
      case 'speaking': return '#52c41a';
      case 'completed': return '#52c41a';
      case 'error': return '#f5222d';
      default: return '#d9d9d9';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'thinking': return <LoadingOutlined />;
      case 'speaking': return <RobotOutlined />;
      case 'completed': return <CheckCircleOutlined />;
      default: return <RobotOutlined />;
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // 开始生成资源
  const startGeneration = async () => {
    if (selectedTypes.length === 0) {
      message.warning('请至少选择一种资源类型');
      return;
    }
    if (!learningNeed.trim()) {
      message.warning('请输入学习需求描述');
      return;
    }

    setIsModalOpen(false);
    setGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({} as Record<ResourceType, number>);
    setError(null);
    setStreamingContent({} as Record<ResourceType, string>);
    setStreamingType(null);
    setIsComplete(false);

    try {
      setCurrentStep('初始化多智能体协同框架...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // 读取学生画像并构建增强 prompt
      const profile = loadProfile();
      const profileCtx = buildProfileContext(profile);
      const enhancedLearningNeed = profileCtx
        ? `主题：${learningNeed}${profileCtx}`
        : learningNeed;

      // 使用流式生成
      await resourceGenerator.generateResources(
        selectedTypes,
        enhancedLearningNeed,
        (type, step, p) => {
          setProgress(prev => ({ ...prev, [type]: p }));
          setCurrentStep(`${resourceTypeConfig[type].label} - ${step}`);
        },
        (type, delta) => {
          setStreamingType(type);
          setStreamingContent(prev => ({
            ...prev,
            [type]: (prev[type] || '') + delta,
          }));
        },
        controller.signal
      );

      setIsComplete(true);
      message.success('资源生成完成！');
    } catch (err) {
      const error = err as Error;
      console.error('Generation failed:', error);
      setError(error.message || '资源生成失败，请重试');
      message.error('资源生成失败');
    } finally {
      setGenerating(false);
      setStreamingType(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>多智能体资源生成</Title>
      <Text type="secondary">通过不同角色的智能体协作，基于大模型生成个性化多模态学习资源</Text>

      {error && (
        <Alert
          message="生成出错"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginTop: 16 }}
        />
      )}

      {/* 多智能体协作状态 */}
      <Card title="多智能体协作状态" style={{ marginTop: 24 }}>
        <Row gutter={16} align="middle">
          {resourceAgentDisplay.map((agent, index) => {
            const status = getAgentStatus(agent.role as AgentRole);
            return (
              <React.Fragment key={agent.name}>
                <Col span={5} style={{ textAlign: 'center' }}>
                  <Avatar
                    size={64}
                    style={{ background: getStatusColor(status) }}
                    icon={getStatusIcon(status)}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>{agent.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{agent.desc}</Text>
                  </div>
                  <Tag
                    color={status === 'completed' ? 'success' : status === 'thinking' ? 'processing' : 'default'}
                    style={{ marginTop: 4 }}
                  >
                    {status === 'idle' ? '待命' :
                     status === 'thinking' ? '思考中' :
                     status === 'speaking' ? '生成中' :
                     status === 'completed' ? '完成' : '错误'}
                  </Tag>
                </Col>
                {index < 3 && (
                  <Col span={1} style={{ textAlign: 'center' }}>
                    <Text type="secondary">→</Text>
                  </Col>
                )}
              </React.Fragment>
            );
          })}
        </Row>
      </Card>

      {/* 资源生成控制台 */}
      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>资源生成控制台</span>
            {generating && <Tag color="processing" icon={<LoadingOutlined />}>生成中</Tag>}
          </Space>
        }
        extra={
          generating
            ? <Button danger icon={<CloseCircleOutlined />} onClick={handleCancel}>取消生成</Button>
            : <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleOpenModal}>生成资源</Button>
        }
        style={{ marginTop: 24 }}
      >
        {generating ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <div style={{ marginTop: 24 }}>
              <Text strong style={{ fontSize: 16 }}>多智能体协同生成中...</Text>
              <br />
              <Text type="secondary">{currentStep}</Text>
            </div>

            {/* 流式内容展示 */}
            {streamingType && (
              <div style={{ marginTop: 32, maxWidth: 800, margin: '32px auto 0', textAlign: 'left' }}>
                <StreamingContentCard
                  type={streamingType}
                  content={streamingContent[streamingType] || '正在生成...'}
                  isStreaming={true}
                />
              </div>
            )}

            {/* 进度条 */}
            <div style={{ marginTop: 32, maxWidth: 600, margin: '32px auto 0' }}>
              {selectedTypes.map(type => (
                <div key={type} style={{ marginBottom: 16 }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Space>
                      {resourceTypeConfig[type].icon}
                      <Text>{resourceTypeConfig[type].label}</Text>
                      {isComplete ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : streamingType === type ? (
                        <LoadingOutlined style={{ color: '#1890ff' }} />
                      ) : (
                        <LoadingOutlined />
                      )}
                    </Space>
                    <Text>{Math.round(progress[type] || 0)}%</Text>
                  </Space>
                  <Progress
                    percent={Math.round(progress[type] || 0)}
                    status={isComplete ? 'success' : 'active'}
                    size="small"
                    strokeColor={resourceTypeConfig[type].color}
                    style={{ marginTop: 4 }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, background: '#fafafa', borderRadius: 8 }}>
            <RobotOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 16 }}>点击"生成资源"启动多智能体协作</Text>
              <br />
              <Text type="secondary">系统将调用大模型，为您生成多种个性化学习资源</Text>
            </div>
          </div>
        )}
      </Card>

      {/* 已生成资源展示 */}
      {Object.keys(streamingContent).length > 0 && (
        <Card title={isComplete ? "已生成资源" : "生成中的资源"} style={{ marginTop: 24 }}>
          <Row gutter={[16, 16]}>
            {Object.entries(streamingContent).map(([type, content]) => (
              <Col span={12} key={type}>
                <StreamingContentCard
                  type={type as ResourceType}
                  content={content}
                  isStreaming={!isComplete && streamingType === type}
                />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 资源类型说明 */}
      <Card title="支持生成的资源类型" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          {Object.entries(resourceTypeConfig).map(([key, config]) => (
            <Col span={8} key={key} style={{ marginBottom: 16 }}>
              <Card
                size="small"
                style={{
                  background: `${config.color}10`,
                  border: `1px solid ${config.color}`,
                  opacity: selectedTypes.includes(key as ResourceType) ? 1 : 0.7,
                }}
              >
                <Space>
                  <Avatar icon={config.icon} style={{ background: config.color }} />
                  <div>
                    <Text strong>{config.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {config.desc}
                    </Text>
                  </div>
                  {selectedTypes.includes(key as ResourceType) && (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 生成配置弹窗 */}
      <Modal
        title="配置资源生成"
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={startGeneration}
        okText="开始生成"
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="学习需求描述">
            <TextArea
              rows={4}
              placeholder="描述你需要的学习资源，例如：Python面向对象编程、机器学习算法、深度学习基础等"
              value={learningNeed}
              onChange={e => setLearningNeed(e.target.value)}
            />
          </Form.Item>
          <Form.Item
            label="选择要生成的资源类型"
            extra={<Text type="secondary">选择越多，生成时间越长，请耐心等待</Text>}
          >
            <Checkbox.Group
              value={selectedTypes}
              onChange={(values) => setSelectedTypes(values as ResourceType[])}
              style={{ width: '100%' }}
            >
              <Row gutter={[16, 8]}>
                {Object.entries(resourceTypeConfig).map(([key, config]) => (
                  <Col span={12} key={key}>
                    <Checkbox value={key}>
                      <Space>
                        {config.icon}
                        <span>{config.label}</span>
                      </Space>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
          <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 8, marginTop: 16 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">
                已选择 <Text strong>{selectedTypes.length}</Text> 种资源类型，
                学习主题：<Text strong>{learningNeed || '未指定'}</Text>
              </Text>
              {loadProfile() && (
                <Tag color="blue" icon={<RobotOutlined />}>已关联画像</Tag>
              )}
            </Space>
          </div>
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

export default Resources;