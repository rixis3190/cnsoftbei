import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Tag, Space, Row, Col, Progress,
  List, Avatar, Statistic, Timeline, Button, Alert
} from 'antd';
import {
  DashboardOutlined,
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  TrophyOutlined,
  FireOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { mockLearningPath, learningStats, assessmentSuggestions } from '../data/mockData';
import { loadPracticeState, learningPlan } from '../services/practiceGrader';
import { questions } from '../data/pythonQuestionBank';
import { SYSTEM_EVENTS } from '../services/learningOrchestrator';
import { userKey } from '../services/storage';
import type { PracticeState, StudentProfile } from '../types';
import RadarChart, { type RadarDataItem } from '../components/RadarChart';

const { Title, Text } = Typography;

/* ------------------------------------------------------------------ */
/*  Tag → 6 维画像映射（与 practiceGrader 保持一致）                     */
/* ------------------------------------------------------------------ */

const TAG_TO_DIMENSION: Record<string, string> = {
  syntax: 'knowledgeBase', 'data-types': 'knowledgeBase', operators: 'knowledgeBase',
  'control-flow': 'knowledgeBase', functions: 'knowledgeBase', modules: 'knowledgeBase',
  scope: 'knowledgeBase', OOP: 'knowledgeBase', classes: 'knowledgeBase',
  inheritance: 'knowledgeBase', polymorphism: 'knowledgeBase', exceptions: 'knowledgeBase',
  files: 'knowledgeBase', decorators: 'knowledgeBase', comprehensions: 'knowledgeBase',
  errorProne: 'errorProne',
  studyHabit: 'studyHabit',
};

const DIMENSION_META: { key: string; label: string; color: string }[] = [
  { key: 'knowledgeBase',    label: '知识基础',   color: '#5B6AF0' },
  { key: 'cognitiveStyle',   label: '认知风格',   color: '#52c41a' },
  { key: 'errorProne',       label: '易错点',     color: '#f97316' },
  { key: 'learningPace',     label: '学习节奏',   color: '#a855f7' },
  { key: 'interestDirection',label: '兴趣方向',   color: '#ec4899' },
  { key: 'studyHabit',       label: '学习习惯',   color: '#06b6d4' },
];

/** 根据画像 level 映射到估算分数 */
function levelToScore(level: string): number {
  if (level === '高') return 80;
  if (level === '中') return 50;
  if (level === '低') return 25;
  return 0;
}

interface DimensionItem {
  dimension: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  feedback: string;
  color: string;
  key: string;
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */

const Assessment: React.FC = () => {
  const [practiceState, setPracticeState] = useState<PracticeState | null>(null);

  const loadData = () => {
    const state = loadPracticeState();
    setPracticeState(state);
  };

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('storage', handler);
    window.addEventListener(SYSTEM_EVENTS.PRACTICE_UPDATED, handler);
    window.addEventListener(SYSTEM_EVENTS.PROFILE_UPDATED, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(SYSTEM_EVENTS.PRACTICE_UPDATED, handler);
      window.removeEventListener(SYSTEM_EVENTS.PROFILE_UPDATED, handler);
    };
  }, []);

  /* ---- 统计 ---- */
  const completedQuestions = practiceState?.results.length ?? 0;
  const totalQuestions = learningPlan.modules.reduce(
    (sum, m) => sum + questions.filter(q => q.moduleId === m.id).length, 0,
  );
  const correctCount = practiceState?.results.filter(r => r.isCorrect).length ?? 0;
  const accuracy = completedQuestions > 0 ? Math.round((correctCount / completedQuestions) * 100) : 0;
  const completedModules = practiceState?.moduleProgress.filter(m => m.completedQuestions === m.totalQuestions).length ?? 0;
  const totalModules = learningPlan.modules.length;

  /* ---- 6 维雷达数据 ---- */
  const dimensionItems: DimensionItem[] = useMemo(() => {
    // 读取画像作为兜底
    let profile: StudentProfile | null = null;
    try {
      const raw = localStorage.getItem(userKey('studentProfile'));
      if (raw) profile = JSON.parse(raw);
    } catch { /* ignore */ }

    // 把 tagScores 聚合到画像维度
    const dimScores: Record<string, { total: number; count: number }> = {};
    if (practiceState) {
      for (const ts of practiceState.tagScores) {
        const dimKey = TAG_TO_DIMENSION[ts.tag];
        if (!dimKey) continue;
        if (!dimScores[dimKey]) dimScores[dimKey] = { total: 0, count: 0 };
        if (ts.totalAnswered > 0) {
          dimScores[dimKey].total += ts.score;
          dimScores[dimKey].count++;
        }
      }
    }

    return DIMENSION_META.map(dm => {
      const entry = dimScores[dm.key];
      let score: number;
      let feedback: string;
      let trend: 'up' | 'down' | 'stable' = 'stable';

      if (entry && entry.count > 0) {
        score = Math.round(entry.total / entry.count);
        feedback = `${entry.count} 个知识点，综合正确率 ${score}%`;
        trend = score >= 70 ? 'up' : score >= 45 ? 'stable' : 'down';
      } else {
        // 练习题没有覆盖到的维度，从画像取值
        const dim = profile?.dimensions?.find(d => d.key === dm.key);
        score = levelToScore(dim?.level ?? '');
        feedback = dim?.value?.slice(0, 30) || '暂未评估，去练习中心做题吧';
      }

      return { dimension: dm.label, score, trend, feedback, color: dm.color, key: dm.key };
    });
  }, [practiceState]);

  const radarData: RadarDataItem[] = useMemo(
    () => dimensionItems.map(d => ({ dimension: d.dimension, score: d.score, color: d.color })),
    [dimensionItems],
  );

  const overallScore = dimensionItems.reduce((sum, d) => sum + d.score, 0) / dimensionItems.length;

  /* ---- 工具 ---- */
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <RiseOutlined style={{ color: '#52c41a' }} />;
      case 'down': return <FallOutlined style={{ color: '#f5222d' }} />;
      default: return <MinusOutlined style={{ color: '#d9d9d9' }} />;
    }
  };
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'success';
      case 'down': return 'danger';
      default: return 'default';
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>学习效果评估</Title>
      <Text type="secondary">多维度精准评估学习效果，动态调整学习方案</Text>

      {/* 练习引导 */}
      {!practiceState || practiceState.results.length === 0 ? (
        <Alert
          type="info"
          showIcon
          icon={<RocketOutlined />}
          message="还没有开始练习"
          description="前往「练习中心」开始做题，系统将根据你的答题情况自动更新学习画像和效果评估。"
          style={{ marginTop: 16 }}
          action={
            <Button size="small" onClick={() => {
              const event = new CustomEvent('navigateToPage', { detail: 'practice' });
              window.dispatchEvent(event);
            }}>
              去练习中心
            </Button>
          }
        />
      ) : null}

      {/* 总体评分 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>总体评分</span>}
              value={Math.round(overallScore)}
              suffix="分"
              valueStyle={{ color: '#fff', fontSize: 48 }}
              prefix={<TrophyOutlined />}
            />
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.8)' }}>
              <Space>
                {getTrendIcon('up')}
                <span>较上周提升 {completedQuestions > 0 ? Math.round(accuracy / 10) : 0}%</span>
              </Space>
            </div>
          </Card>
        </Col>

        {/* 动态练习统计 */}
        {practiceState && practiceState.results.length > 0 ? (
          <>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已完成题目"
                  value={completedQuestions}
                  suffix={`/ ${totalQuestions}`}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                />
                <Progress
                  percent={Math.round((completedQuestions / totalQuestions) * 100)}
                  size="small"
                  showInfo={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="正确率"
                  value={accuracy}
                  suffix="%"
                  prefix={<RiseOutlined style={{ color: '#faad14' }} />}
                />
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginTop: 8 }}>
                  正确 {correctCount} 题
                </Tag>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="模块完成"
                  value={`${completedModules}/${totalModules}`}
                  prefix={<DashboardOutlined style={{ color: '#722ed1' }} />}
                />
                <Tag icon={<FireOutlined />} color="processing" style={{ marginTop: 8 }}>
                  {totalModules - completedModules} 个进行中
                </Tag>
              </Card>
            </Col>
          </>
        ) : (
          learningStats.map((stat, index) => (
            <Col span={6} key={index}>
              <Card>
                <Statistic
                  title={stat.label}
                  value={stat.value}
                  suffix={stat.unit}
                  prefix={index === 0 ? <ClockCircleOutlined /> : index === 1 ? <FireOutlined /> : <CheckCircleOutlined />}
                />
                <Tag
                  icon={getTrendIcon(stat.trend)}
                  color={getTrendColor(stat.trend)}
                  style={{ marginTop: 8 }}
                >
                  {stat.trendValue}
                </Tag>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <Row gutter={24} style={{ marginTop: 24 }}>
        {/* 能力雷达图 —— 固定 6 维六边形 */}
        <Col span={12}>
          <Card title="能力雷达图">
            {practiceState && practiceState.results.length > 0 ? (
              <RadarChart data={radarData} height={420} />
            ) : (
              <div
                style={{
                  height: 280,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#bfbfbf',
                  fontSize: 14,
                }}
              >
                开始练习后可查看能力雷达图
              </div>
            )}
          </Card>
        </Col>

        {/* 6 维评估详情 */}
        <Col span={12}>
          <Card title="多维度评估详情">
            <List
              dataSource={dimensionItems}
              renderItem={(item) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Card
                    size="small"
                    style={{ width: '100%', borderLeft: `3px solid ${item.color}` }}
                  >
                    <Row gutter={12} align="middle">
                      <Col span={11}>
                        <Space>
                          <Text strong>{item.dimension}</Text>
                          <Tag icon={getTrendIcon(item.trend)} color={getTrendColor(item.trend)}>
                            {item.trend === 'up' ? '提升' : item.trend === 'down' ? '下降' : '稳定'}
                          </Tag>
                        </Space>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.feedback}</Text>
                      </Col>
                      <Col span={9}>
                        <Progress
                          percent={item.score}
                          size="small"
                          strokeColor={item.score >= 80 ? '#52c41a' : item.score >= 50 ? '#faad14' : '#f5222d'}
                        />
                      </Col>
                      <Col span={4} style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: 22 }}>{item.score}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>分</Text>
                      </Col>
                    </Row>
                  </Card>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 练习模块进度 */}
      {practiceState && practiceState.results.length > 0 && (
        <Card title="练习模块进度" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            {practiceState.moduleProgress.map((module, index) => (
              <Col span={6} key={module.moduleId}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Avatar
                    size={48}
                    style={{
                      background: module.score >= 80 ? '#52c41a' : module.score >= 50 ? '#1890ff' : '#d9d9d9',
                      marginBottom: 8,
                    }}
                  >
                    {index + 1}
                  </Avatar>
                  <br />
                  <Text strong style={{ fontSize: 12 }}>{module.moduleName}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {module.completedQuestions}/{module.totalQuestions} 题
                  </Text>
                  <Progress
                    percent={module.score}
                    size="small"
                    strokeColor={module.score >= 80 ? '#52c41a' : '#1890ff'}
                    style={{ marginTop: 8 }}
                  />
                  <Tag
                    color={module.score >= 80 ? 'success' : module.score >= 50 ? 'processing' : 'default'}
                    style={{ marginTop: 4 }}
                  >
                    {module.score}分
                  </Tag>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 学习路径完成情况（无练习数据时） */}
      {(!practiceState || practiceState.results.length === 0) && (
        <Card title="学习路径完成情况" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            {mockLearningPath.nodes.map((node, index) => (
              <Col span={6} key={node.id}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Avatar
                    size={48}
                    style={{
                      background: node.status === 'completed' ? '#52c41a' : node.status === 'in-progress' ? '#1890ff' : '#d9d9d9',
                      marginBottom: 8,
                    }}
                  >
                    {index + 1}
                  </Avatar>
                  <br />
                  <Text strong style={{ fontSize: 12 }}>{node.title}</Text>
                  <br />
                  <Progress
                    percent={node.progress}
                    size="small"
                    strokeColor={node.status === 'completed' ? '#52c41a' : '#1890ff'}
                    style={{ marginTop: 8 }}
                  />
                  <Tag
                    color={node.status === 'completed' ? 'success' : node.status === 'in-progress' ? 'processing' : 'default'}
                    style={{ marginTop: 4 }}
                  >
                    {node.status === 'completed' ? '已完成' : node.status === 'in-progress' ? '进行中' : '未开始'}
                  </Tag>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 智能调整建议 */}
      <Card title="智能调整建议" style={{ marginTop: 24 }}>
        <Timeline
          items={assessmentSuggestions.map(item => {
            const dotIconMap: Record<string, React.ReactNode> = {
              DashboardOutlined: <DashboardOutlined />,
              CheckCircleOutlined: <CheckCircleOutlined />,
              FireOutlined: <FireOutlined />,
            };
            return {
              color: item.color,
              dot: dotIconMap[item.dotIcon] || <DashboardOutlined />,
              children: (
                <Space direction="vertical">
                  <Text strong>{item.title}</Text>
                  <Text type="secondary">{item.description}</Text>
                </Space>
              ),
            };
          })}
        />
      </Card>
    </div>
  );
};

export default Assessment;
