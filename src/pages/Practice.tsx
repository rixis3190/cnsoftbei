import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Typography, Tag, Space, Button, Row, Col, Progress, Radio,
  Input, Spin, message, Divider, Collapse, Drawer, Empty, Badge,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  ReloadOutlined,
  SearchOutlined,
  TrophyOutlined,
  BookOutlined,
  WarningOutlined,
  CrownOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import type { PracticeQuestion, ModuleProgress } from '../types';
import {
  learningPlan,
  questions as allQuestions,
  checkAnswer,
  gradeByAI,
  submitAnswer,
  getOrCreatePracticeState,
  resetPracticeState,
} from '../services/practiceGrader';
import { loadCurrentPathStage } from '../services/learningOrchestrator';
import {
  getStageQuestionSplit,
  searchQuestions,
  getWrongAnswerQuestions,
  categorizeWrongByModule,
  getCategoryCounts,
  sortByProgress,
  tagIndex,
  tagToChinese,
} from '../data/pythonQuestionBank';
import { usePageCache } from '../context/PageCacheContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea, Search } = Input;
const { Panel } = Collapse;

const PAGE_KEY = 'practice';
const BATCH_SIZE = 5;
const CORE_PASS_THRESHOLD = 50;

interface QuestionResult {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean | null;
  aiScore?: number;
  isSubmitted: boolean;
}

const Practice: React.FC = () => {
  const { cachedState, saveState } = usePageCache(PAGE_KEY);

  const practiceState = getOrCreatePracticeState();
  const tagScores = practiceState.tagScores;
  const currentStage = loadCurrentPathStage();

  // 筛选当前阶段的题目
  const stageSplit = useMemo(() => getStageQuestionSplit(currentStage), [currentStage]);
  const stageQuestions = [...stageSplit.core, ...stageSplit.extension];
  const sortedStageQuestions = useMemo(() => sortByProgress(stageQuestions, tagScores), [stageQuestions, tagScores]);

  // 如果无阶段数据，回退到全题库
  const displayQuestions = stageQuestions.length > 0 ? sortedStageQuestions : sortByProgress(allQuestions, tagScores);

  const [activeTab, setActiveTab] = useState<string>(() => cachedState?.activeTab ?? 'core');
  const [batchIndex, setBatchIndex] = useState<number>(() => cachedState?.batchIndex ?? 0);
  const [results, setResults] = useState<Record<string, QuestionResult>>(() => cachedState?.results ?? {});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [aiGradeText, setAiGradeText] = useState('');
  const [gradingQuestionId, setGradingQuestionId] = useState<string | null>(null);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress[]>(() => practiceState.moduleProgress);

  // 错题集状态
  const [wrongDrawerOpen, setWrongDrawerOpen] = useState(false);
  const [wrongSearchText, setWrongSearchText] = useState('');
  const [wrongActiveModule, setWrongActiveModule] = useState<string>('all');

  // 搜索状态
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchTag, setSearchTag] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<PracticeQuestion[]>([]);

  useEffect(() => {
    saveState({ activeTab, batchIndex, results });
  }, [activeTab, batchIndex, results, saveState]);

  // ----- 进度计算 -----
  const categoryCounts = getCategoryCounts();

  const coreQuestions = allQuestions.filter(q => q.category === 'core');
  const extensionQuestions = allQuestions.filter(q => q.category === 'extension');
  const coreTotal = categoryCounts.core;
  const extTotal = categoryCounts.extension;
  const coreCompleted = coreQuestions.filter(q => results[q.id]?.isSubmitted).length;
  const extCompleted = extensionQuestions.filter(q => results[q.id]?.isSubmitted).length;
  const coreCorrect = coreQuestions.filter(q => results[q.id]?.isSubmitted && results[q.id]?.isCorrect).length;
  const extCorrect = extensionQuestions.filter(q => results[q.id]?.isSubmitted && results[q.id]?.isCorrect).length;
  const coreDone = coreCorrect >= CORE_PASS_THRESHOLD;

  // 按当前 Tab 筛选题目
  const tabQuestions = useMemo(() => {
    const base = activeTab === 'core'
      ? displayQuestions.filter(q => q.category === 'core')
      : displayQuestions.filter(q => q.category === 'extension');
    // 薄弱优先
    const weakTags = new Set(tagScores.filter(ts => ts.score < 60).map(ts => ts.tag));
    return [...base].sort((a, b) => {
      const aW = a.tags.some(t => weakTags.has(t)) ? 1 : 0;
      const bW = b.tags.some(t => weakTags.has(t)) ? 1 : 0;
      if (aW !== bW) return bW - aW;
      return ({ easy: 0, medium: 1, hard: 2 } as Record<string, number>)[a.difficulty] - ({ easy: 0, medium: 1, hard: 2 } as Record<string, number>)[b.difficulty];
    });
  }, [activeTab, displayQuestions, tagScores]);

  const totalBatches = Math.ceil(tabQuestions.length / BATCH_SIZE);
  const currentBatchQuestions = tabQuestions.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);

  const getQuestionResult = useCallback((qId: string) => results[qId], [results]);

  const currentBatchAllSubmitted = currentBatchQuestions.every(q => !!getQuestionResult(q.id)?.isSubmitted);
  const currentBatchHasAnswer = currentBatchQuestions.some(q => !getQuestionResult(q.id)?.isSubmitted && !!answers[q.id]?.trim());

  // ----- 错题数据 -----
  // 抽屉渲染时按 wrongSearchText / wrongActiveModule 现场过滤，此处只提供按模块分组数据
  const wrongQuestions = useMemo(() => getWrongAnswerQuestions(practiceState), [practiceState]);
  const wrongByModule = useMemo(() => categorizeWrongByModule(wrongQuestions), [wrongQuestions]);

  // 搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    if (!value.trim()) { setSearchResults([]); return; }
    const results = searchQuestions({ query: value, tags: searchTag !== 'all' ? [searchTag] : undefined });
    setSearchResults(results);
  };

  // ----- 提交逻辑 -----
  const handleBatchSubmit = async () => {
    const toSubmit = currentBatchQuestions.filter(q => !getQuestionResult(q.id)?.isSubmitted && !!answers[q.id]?.trim());
    if (toSubmit.length === 0) { message.warning('请先作答至少一道题'); return; }

    setIsBatchSubmitting(true);
    setIsAiGrading(true);
    setAiGradeText('');

    const newResults = { ...results };
    try {
      for (const q of toSubmit) {
        const selectedAnswer = answers[q.id] ?? '';
        if (q.type === 'short') {
          setGradingQuestionId(q.id);
          setAiGradeText('');
          try {
            const score = await gradeByAI(q, selectedAnswer, (text) => { setAiGradeText(prev => prev + text); });
            const finalIsCorrect = score >= 50;
            newResults[q.id] = { questionId: q.id, userAnswer: selectedAnswer, isCorrect: finalIsCorrect, aiScore: score, isSubmitted: true };
            submitAnswer(q.id, selectedAnswer, finalIsCorrect, score);
          } catch {
            newResults[q.id] = { questionId: q.id, userAnswer: selectedAnswer, isCorrect: null, aiScore: 0, isSubmitted: true };
          }
        } else {
          const isCorrect = checkAnswer(q, selectedAnswer);
          newResults[q.id] = { questionId: q.id, userAnswer: selectedAnswer, isCorrect, isSubmitted: true };
          submitAnswer(q.id, selectedAnswer, isCorrect);
        }
        setResults({ ...newResults });
        setModuleProgress(getOrCreatePracticeState().moduleProgress);
      }
      setAnswers(prev => { const next = { ...prev }; toSubmit.forEach(q => { delete next[q.id]; }); return next; });
      const correct = toSubmit.filter(q => newResults[q.id].isCorrect).length;
      message.success(`提交完成！正确 ${correct}/${toSubmit.length} 题`);
    } catch {
      message.error('提交失败，请重试');
    } finally {
      setIsBatchSubmitting(false);
      setIsAiGrading(false);
      setGradingQuestionId(null);
      setAiGradeText('');
    }
  };

  const handleReset = () => {
    const state = resetPracticeState();
    setResults({});
    setModuleProgress(state.moduleProgress);
    setBatchIndex(0);
    setAnswers({});
    message.success('练习记录已重置');
  };

  // ----- 渲染题目卡片 -----
  const renderQuestion = (question: PracticeQuestion, globalIndex: number) => {
    const result = getQuestionResult(question.id);
    const isSubmitted = result?.isSubmitted;
    const isCorrect = result?.isCorrect;
    const isAiGradingThis = isAiGrading && gradingQuestionId === question.id;

    return (
      <Card
        key={question.id}
        size="small"
        style={{
          marginBottom: 16,
          borderLeft: `4px solid ${isSubmitted ? (isCorrect ? '#52c41a' : isCorrect === false ? '#f5222d' : '#faad14') : '#d9d9d9'}`,
          background: isSubmitted ? '#fafafa' : '#fff',
        }}
      >
        <Space style={{ marginBottom: 12 }}>
          {question.category === 'extension' && <Tag color="volcano" icon={<CrownOutlined />}>扩展</Tag>}
          <Tag color={question.difficulty === 'easy' ? 'green' : question.difficulty === 'medium' ? 'orange' : 'red'}>
            {question.difficulty === 'easy' ? '简单' : question.difficulty === 'medium' ? '中等' : '困难'}
          </Tag>
          <Tag color={question.type === 'choice' ? 'blue' : question.type === 'truefalse' ? 'cyan' : 'purple'}>
            {question.type === 'choice' ? '选择题' : question.type === 'truefalse' ? '判断题' : '简答题'}
          </Tag>
          {question.tags.slice(0, 2).map(tag => (
            <Tag key={tag} style={{ fontSize: 11 }}>{tagToChinese(tag)}</Tag>
          ))}
        </Space>

        <Title level={5} style={{ margin: '8px 0' }}>{globalIndex}. {question.question}</Title>

        {!isSubmitted ? (
          <>
            {(question.type === 'choice' || question.type === 'truefalse') && (
              <Radio.Group
                value={answers[question.id] ?? ''}
                onChange={e => { if (!getQuestionResult(question.id)?.isSubmitted) setAnswers(prev => ({ ...prev, [question.id]: e.target.value })); }}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {(question.type === 'choice' ? (question.options ?? []) : ['正确', '错误']).map((opt, idx) => {
                    const optValue = question.type === 'choice' ? opt : (idx === 0 ? 'true' : 'false');
                    const isSelected = answers[question.id] === optValue;
                    return (
                      <Radio key={idx} value={optValue} style={{ display: 'block', padding: '10px 14px', background: isSelected ? '#e6f4ff' : '#fff', borderRadius: 6, border: isSelected ? '1px solid #1890ff' : '1px solid #d9d9d9', width: '100%' }}>
                        {question.type === 'choice' ? <Text><Text strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + idx)}.</Text>{opt}</Text> : <Text strong>{opt}</Text>}
                      </Radio>
                    );
                  })}
                </Space>
              </Radio.Group>
            )}
            {question.type === 'short' && (
              <>
                <TextArea rows={4} placeholder="请在此输入你的答案..." value={answers[question.id] ?? ''} onChange={e => { if (!getQuestionResult(question.id)?.isSubmitted) setAnswers(prev => ({ ...prev, [question.id]: e.target.value })); }} disabled={isAiGrading} />
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>参考答案将在提交后显示</Text>
              </>
            )}
            {isAiGradingThis && (
              <Card size="small" style={{ marginTop: 12, background: '#f0f5ff', border: '1px solid #adc6ff' }}>
                <Space><Spin size="small" /><Text>AI 正在评分此题...</Text></Space>
                {aiGradeText && <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>{aiGradeText.substring(0, 100)}</div>}
              </Card>
            )}
          </>
        ) : (
          <>
            <div style={{ padding: '8px 12px', background: isCorrect ? '#f6ffed' : '#fff2f0', borderRadius: 6, marginBottom: 12, border: `1px solid ${isCorrect ? '#b7eb8f' : '#ffccc7'}` }}>
              <Space>
                {isCorrect ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#f5222d' }} />}
                <Text strong style={{ color: isCorrect ? '#52c41a' : '#f5222d' }}>
                  {isCorrect === null ? `AI 评分: ${result.aiScore ?? 0} 分` : isCorrect ? '回答正确' : '回答错误'}
                </Text>
              </Space>
              {question.type !== 'short' && <Text type="secondary" style={{ marginLeft: 16 }}>你的答案: {result.userAnswer}</Text>}
              {question.type === 'short' && <div style={{ marginTop: 8 }}><Text strong>你的答案：</Text><Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.userAnswer}</Paragraph></div>}
            </div>
            {question.type !== 'short' && question.trueFalseAnswer !== undefined && <Text type="secondary">正确答案：{question.trueFalseAnswer ? '正确' : '错误'}</Text>}
            {question.type === 'choice' && question.correctAnswer && question.options && <Text type="secondary">正确答案：{String.fromCharCode(65 + (question.options as string[]).indexOf(question.correctAnswer))}. {question.correctAnswer}</Text>}
            {question.type === 'short' && question.sampleAnswer && <div style={{ marginTop: 8 }}><Text strong>参考答案：</Text><Paragraph style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13, color: '#555' }}>{question.sampleAnswer}</Paragraph></div>}
            {question.explanation && <div style={{ marginTop: 8, padding: '8px', background: '#f5f5f5', borderRadius: 4 }}><Text strong style={{ fontSize: 12 }}>💡 解析：</Text><Text style={{ fontSize: 12 }}> {question.explanation}</Text></div>}
          </>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>练习中心</Title>
      <Text type="secondary">基于学习路径阶段选题，薄弱知识点优先训练</Text>

      {/* 进度卡片 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card style={{ background: coreDone ? 'linear-gradient(135deg, #52c41a 0%, #237804 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
            <Row align="middle">
              <Col span={16}>
                <Space direction="vertical" size={4}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                    <BookOutlined /> 基础内容学习
                  </Text>
                  <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                    {coreCompleted} <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>/ {coreTotal} 题</Text>
                  </div>
                  <Progress percent={coreTotal > 0 ? Math.round((coreCompleted / coreTotal) * 100) : 0} showInfo={false} strokeColor="#fff" trailColor="rgba(255,255,255,0.3)" style={{ width: 200 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                    答对 <Text strong style={{ color: '#fff' }}>{coreCorrect}</Text> / {CORE_PASS_THRESHOLD} 题
                    {coreDone ? <Tag color="success" style={{ marginLeft: 8 }}>✓ 已完成学习</Tag> : <Tag color="default" style={{ marginLeft: 8 }}>未完成</Tag>}
                  </Text>
                </Space>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                {coreDone ? <TrophyOutlined style={{ fontSize: 48, color: '#ffd700' }} /> : <BookOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />}
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card style={{ background: extCompleted > 0 ? 'linear-gradient(135deg, #fa8c16 0%, #d4380d 100%)' : 'linear-gradient(135deg, #434343 0%, #1a1a1a 100%)', color: '#fff' }}>
            <Row align="middle">
              <Col span={16}>
                <Space direction="vertical" size={4}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                    <CrownOutlined /> 扩展挑战
                  </Text>
                  <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                    {extCompleted} <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>/ {extTotal} 题</Text>
                  </div>
                  <Progress percent={extTotal > 0 ? Math.round((extCompleted / extTotal) * 100) : 0} showInfo={false} strokeColor="#fa8c16" trailColor="rgba(255,255,255,0.2)" style={{ width: 200 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                    答对 {extCorrect} 题 · 高手进阶挑战
                  </Text>
                </Space>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <ExperimentOutlined style={{ fontSize: 48, color: extCompleted > 0 ? '#ffd700' : 'rgba(255,255,255,0.3)' }} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 各模块进度（客观题 50% + 简答题 50% 加权） */}
      {moduleProgress.length > 0 && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Row gutter={[16, 12]}>
            {moduleProgress.map(m => (
              <Col span={6} key={m.moduleId}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <Text strong>{m.moduleName}</Text>
                  <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                    {m.completedQuestions}/{m.totalQuestions} 题
                  </Text>
                </div>
                <Progress
                  percent={m.totalQuestions > 0 ? Math.round((m.completedQuestions / m.totalQuestions) * 100) : 0}
                  size="small"
                  format={() => `${m.score} 分`}
                />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 当前阶段信息 + 快捷操作 */}
      {currentStage && (
        <Card size="small" style={{ marginTop: 16, background: '#f0f5ff', border: '1px solid #adc6ff' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <RocketOutlined style={{ color: '#1890ff' }} />
                <Text strong>当前学习阶段：{currentStage.stageName}</Text>
                <Tag color="blue">{currentStage.coreKnowledgePoints.map(t => tagToChinese(t)).join(' · ')}</Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button size="small" icon={<SearchOutlined />} onClick={() => setSearchDrawerOpen(true)}>搜索题目</Button>
                <Badge count={wrongQuestions.length} size="small">
                  <Button size="small" icon={<WarningOutlined />} danger={wrongQuestions.length > 0} onClick={() => setWrongDrawerOpen(true)}>错题集</Button>
                </Badge>
                <Button size="small" icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 无路径阶段时的回退信息 */}
      {!currentStage && (
        <Card size="small" style={{ marginTop: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
          <Space>
            <RocketOutlined style={{ color: '#faad14' }} />
            <Text>尚未设置学习路径阶段，显示全部题库。前往「学习路径」页面开始学习，可获取更精准的题目推荐。</Text>
          </Space>
        </Card>
      )}

      <Row gutter={24} style={{ marginTop: 16 }}>
        {/* 左侧：导航面板 */}
        <Col span={5}>
          <Card title="练习导航" size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type={activeTab === 'core' ? 'primary' : 'default'}
                block
                icon={<BookOutlined />}
                onClick={() => { setActiveTab('core'); setBatchIndex(0); }}
              >
                基础内容 ({coreCompleted}/{coreTotal})
              </Button>
              <Button
                type={activeTab === 'extension' ? 'primary' : 'default'}
                block
                icon={<CrownOutlined />}
                onClick={() => { setActiveTab('extension'); setBatchIndex(0); }}
              >
                扩展挑战 ({extCompleted}/{extTotal})
              </Button>
              <Divider style={{ margin: '4px 0' }} />

              <Text type="secondary" style={{ fontSize: 12 }}>当前阶段知识点</Text>
              {(currentStage?.coreKnowledgePoints || learningPlan.modules[0].tags).map(tag => (
                <Tag key={tag} color={tagScores.find(ts => ts.tag === tag && ts.score < 60) ? 'error' : 'default'} style={{ marginBottom: 4 }}>
                  {tagToChinese(tag)}
                  {tagScores.find(ts => ts.tag === tag) && (
                    <span> ({tagScores.find(ts => ts.tag === tag)!.score}%)</span>
                  )}
                </Tag>
              ))}

              <Divider style={{ margin: '4px 0' }} />
              <Button block size="small" icon={<SearchOutlined />} onClick={() => setSearchDrawerOpen(true)}>搜索全部题目</Button>
              <Badge count={wrongQuestions.length} style={{ width: '100%' }}>
                <Button block size="small" danger={wrongQuestions.length > 0} icon={<WarningOutlined />} onClick={() => setWrongDrawerOpen(true)}>
                  错题集 ({wrongQuestions.length})
                </Button>
              </Badge>
              <Button block size="small" icon={<ReloadOutlined />} onClick={handleReset}>重置记录</Button>
            </Space>
          </Card>
        </Col>

        {/* 右侧：做题区域 */}
        <Col span={19}>
          <Card
            title={activeTab === 'core' ? `基础内容 · ${coreDone ? '已达标 ✓' : '学习中'}` : '扩展挑战 · 高手进阶'}
            extra={
              <Space>
                <Tag color="blue">第 {Math.min(batchIndex + 1, totalBatches)} / {Math.max(totalBatches, 1)} 批</Tag>
                {currentBatchQuestions.length > 0 && (
                  <Text type="secondary">
                    {currentBatchQuestions.filter(q => !!getQuestionResult(q.id)?.isSubmitted).length}/{currentBatchQuestions.length} 题已答
                  </Text>
                )}
              </Space>
            }
          >
            {tabQuestions.length > 0 ? (
              <>
                <Progress percent={totalBatches > 0 ? Math.round(((batchIndex + 1) / totalBatches) * 100) : 0} showInfo={false} style={{ marginBottom: 16 }} />
                {currentBatchQuestions.map((q, idx) => renderQuestion(q, batchIndex * BATCH_SIZE + idx + 1))}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <Button onClick={() => setBatchIndex(prev => Math.max(0, prev - 1))} disabled={batchIndex === 0 || isBatchSubmitting}>上一批</Button>
                  <Space>
                    <Button type="primary" onClick={handleBatchSubmit} loading={isBatchSubmitting} disabled={!currentBatchHasAnswer || currentBatchAllSubmitted || isBatchSubmitting} style={currentBatchAllSubmitted ? { background: '#52c41a', borderColor: '#52c41a' } : {}}>
                      {currentBatchAllSubmitted ? '本批次已完成' : isBatchSubmitting ? '提交中...' : `提交 (${currentBatchQuestions.filter(q => !getQuestionResult(q.id)?.isSubmitted && !!answers[q.id]?.trim()).length})`}
                    </Button>
                    {Array.from({ length: Math.min(totalBatches, 8) }).map((_, idx) => {
                      const batchQs = tabQuestions.slice(idx * BATCH_SIZE, (idx + 1) * BATCH_SIZE);
                      const done = batchQs.every(q => !!getQuestionResult(q.id)?.isSubmitted);
                      return (
                        <Button key={idx} size="small" type={idx === batchIndex ? 'primary' : 'default'} disabled={idx === batchIndex || isBatchSubmitting} onClick={() => setBatchIndex(idx)} style={done ? { background: '#52c41a', borderColor: '#52c41a' } : {}}>
                          {done ? <CheckCircleOutlined /> : idx + 1}
                        </Button>
                      );
                    })}
                  </Space>
                  <Button onClick={() => setBatchIndex(prev => Math.min(totalBatches - 1, prev + 1))} disabled={batchIndex >= totalBatches - 1 || isBatchSubmitting}>下一批</Button>
                </div>

                {isAiGrading && !gradingQuestionId && (
                  <Card size="small" style={{ marginTop: 16, background: '#f0f5ff', border: '1px solid #adc6ff' }}>
                    <Space><Spin size="small" /><Text>AI 正在逐题评分，请稍候...</Text></Space>
                  </Card>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Empty description={activeTab === 'core' ? '当前阶段暂无基础题目，可在扩展挑战中练习' : '当前阶段暂无扩展题目，完成基础内容后可解锁更多挑战'} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 错题集 Drawer */}
      <Drawer
        title={<Space><WarningOutlined />错题集 ({wrongQuestions.length} 题)</Space>}
        placement="right"
        width={640}
        open={wrongDrawerOpen}
        onClose={() => { setWrongDrawerOpen(false); setWrongSearchText(''); setWrongActiveModule('all'); }}
        extra={
          <Search placeholder="搜索错题..." allowClear value={wrongSearchText} onChange={e => setWrongSearchText(e.target.value)} style={{ width: 200 }} />
        }
      >
        {wrongQuestions.length === 0 ? (
          <Empty description="暂无错题，继续加油！" />
        ) : (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={wrongActiveModule === 'all' ? 'blue' : 'default'} onClick={() => setWrongActiveModule('all')} style={{ cursor: 'pointer' }}>全部</Tag>
              {wrongByModule.map(g => (
                <Tag key={g.moduleId} color={wrongActiveModule === g.moduleId ? 'blue' : 'default'} onClick={() => setWrongActiveModule(g.moduleId)} style={{ cursor: 'pointer' }}>
                  {g.moduleName} ({g.questions.length})
                </Tag>
              ))}
            </Space>

            <Collapse>
              {(wrongActiveModule === 'all' ? wrongByModule : wrongByModule.filter(g => g.moduleId === wrongActiveModule)).map(group => (
                <Panel key={group.moduleId} header={<Text strong>{group.moduleName} <Tag>{group.questions.length} 题</Tag></Text>}>
                  {group.questions
                    .filter(q => !wrongSearchText || q.question.toLowerCase().includes(wrongSearchText.toLowerCase()))
                    .map((q, idx) => {
                      const r = practiceState.results.find(res => res.questionId === q.id);
                      return (
                        <Card key={q.id} size="small" style={{ marginBottom: 8, borderLeft: '3px solid #f5222d' }}>
                          <Space style={{ marginBottom: 4 }}>
                            <Tag color="red">{q.difficulty === 'easy' ? '简单' : q.difficulty === 'medium' ? '中等' : '困难'}</Tag>
                            {q.tags.map(t => <Tag key={t} style={{ fontSize: 10 }}>{tagToChinese(t)}</Tag>)}
                          </Space>
                          <Text strong style={{ fontSize: 13 }}>{idx + 1}. {q.question}</Text>
                          {r && (
                            <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                              你的答案: {r.userAnswer?.substring(0, 100)}{r.userAnswer?.length > 100 ? '...' : ''}
                              {r.aiScore !== undefined && <Tag style={{ marginLeft: 8 }}>AI: {r.aiScore}分</Tag>}
                            </div>
                          )}
                          {q.explanation && <div style={{ marginTop: 4, padding: '4px 8px', background: '#f5f5f5', borderRadius: 4, fontSize: 12 }}>💡 {q.explanation}</div>}
                        </Card>
                      );
                    })}
                </Panel>
              ))}
            </Collapse>
          </>
        )}
      </Drawer>

      {/* 搜索 Drawer */}
      <Drawer
        title={<Space><SearchOutlined />搜索题目</Space>}
        placement="right"
        width={640}
        open={searchDrawerOpen}
        onClose={() => { setSearchDrawerOpen(false); setSearchText(''); setSearchTag('all'); setSearchResults([]); }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Search placeholder="输入关键词搜索题目..." allowClear enterButton onSearch={handleSearch} size="large" />
          <Space wrap>
            <Tag color={searchTag === 'all' ? 'blue' : 'default'} onClick={() => setSearchTag('all')} style={{ cursor: 'pointer' }}>全部标签</Tag>
            {Object.keys(tagIndex).map(tag => (
              <Tag key={tag} color={searchTag === tag ? 'blue' : 'default'} onClick={() => setSearchTag(tag)} style={{ cursor: 'pointer' }}>
                {tagToChinese(tag)}
              </Tag>
            ))}
          </Space>
          <Divider />
          {searchResults.length > 0 ? (
            searchResults.map((q, idx) => {
              const r = results[q.id];
              return (
                <Card key={q.id} size="small" style={{ borderLeft: `3px solid ${r?.isSubmitted ? (r?.isCorrect ? '#52c41a' : '#f5222d') : '#d9d9d9'}` }}>
                  <Space style={{ marginBottom: 4 }}>
                    <Tag color={q.category === 'extension' ? 'volcano' : 'green'}>{q.category === 'extension' ? '扩展' : '基础'}</Tag>
                    <Tag color={q.difficulty === 'easy' ? 'green' : q.difficulty === 'medium' ? 'orange' : 'red'}>
                      {q.difficulty === 'easy' ? '简单' : q.difficulty === 'medium' ? '中等' : '困难'}
                    </Tag>
                    {q.tags.map(t => <Tag key={t} style={{ fontSize: 10 }}>{tagToChinese(t)}</Tag>)}
                    {r?.isSubmitted && (r.isCorrect ? <Tag color="success">已答对</Tag> : <Tag color="error">已答错</Tag>)}
                  </Space>
                  <Text strong style={{ fontSize: 13 }}>{idx + 1}. {q.question}</Text>
                </Card>
              );
            })
          ) : (
            searchText ? <Empty description="无匹配结果" /> : <Empty description="输入关键词搜索全部题目" />
          )}
        </Space>
      </Drawer>
    </div>
  );
};

export default Practice;
