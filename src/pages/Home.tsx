import { useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, Progress, Typography, Tag, Space, Avatar, List, Badge, Empty } from 'antd';
import {
  FileTextOutlined,
  FireOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  TeamOutlined,
  UserOutlined,
  MessageOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { initialProfile, homeStats, agentStatusList } from '../data/mockData';
import type { StudentProfile, PracticeState } from '../types';
import { userKey } from '../services/storage';
import { loadPracticeState, learningPlan as practiceLearningPlan, questions as practiceQuestions } from '../services/practiceGrader';
import { useAuth } from '../context/useAuth';
import { getAllFeedbacks } from '../services/feedback';

const { Title, Text } = Typography;

// ==================== 本地存储读取 ====================
/** 从 localStorage 读取学生画像，解析失败按无画像处理 */
function loadInitialProfile(): StudentProfile | null {
  try {
    const saved = localStorage.getItem(userKey('studentProfile'));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// ==================== Tag 中文映射 ====================
function tagToChinese(tag: string): string {
  const map: Record<string, string> = {
    syntax: '语法基础', 'data-types': '数据类型', operators: '运算符',
    'control-flow': '流程控制', functions: '函数', modules: '模块',
    scope: '作用域', OOP: '面向对象', classes: '类与对象',
    inheritance: '继承', polymorphism: '多态', exceptions: '异常处理',
    files: '文件操作', decorators: '装饰器', comprehensions: '推导式',
    errorProne: '易错点', studyHabit: '学习习惯',
  };
  return map[tag] || tag;
}

// ==================== 学生仪表盘 ====================
function StudentDashboard({ profile, practiceState }: { profile: StudentProfile; practiceState: PracticeState | null }) {
  // 各模块真实题量（由题库实时统计，避免与题库数据不同步）
  const moduleQuestionCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of practiceQuestions) map.set(q.moduleId, (map.get(q.moduleId) ?? 0) + 1);
    return map;
  }, []);

  const totalQuestions = practiceLearningPlan.modules.reduce((s, m) => s + (moduleQuestionCount.get(m.id) ?? 0), 0);
  const completedQuestions = practiceState?.results.length ?? 0;
  const correctCount = practiceState
    ? practiceState.results.filter(r => r.isCorrect === true || (r.aiScore !== undefined && r.aiScore >= 50)).length
    : 0;
  const efficiencyScore = completedQuestions > 0 ? Math.round((correctCount / completedQuestions) * 100) : homeStats.efficiencyScore;
  const estimatedWeeks = practiceLearningPlan.modules.length * 2;

  const topModule = useMemo(() => {
    if (!practiceState?.results.length) return null;
    const counts = new Map<string, number>();
    for (const r of practiceState.results) counts.set(r.moduleId, (counts.get(r.moduleId) || 0) + 1);
    let best = ''; let max = 0;
    counts.forEach((c, m) => { if (c > max) { max = c; best = m; } });
    return practiceLearningPlan.modules.find(m => m.id === best) || null;
  }, [practiceState]);

  const topModuleTotal = topModule ? moduleQuestionCount.get(topModule.id) ?? 0 : 0;
  const topModulePercent = topModule && topModuleTotal > 0 && practiceState
    ? Math.round((practiceState.results.filter(r => r.moduleId === topModule!.id).length / topModuleTotal) * 100)
    : 0;

  const topTagScores = useMemo(() => {
    if (!practiceState?.tagScores.length) return [];
    return [...practiceState.tagScores].sort((a, b) => b.score - a.score).slice(0, 4);
  }, [practiceState]);

  return (
    <>
      <Title level={2}>欢迎回来，{profile.name}</Title>
      <Text type="secondary" style={{ fontSize: 16 }}>专业：{profile.major} | 年级：{profile.grade}</Text>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}><Card><Statistic title="已完成题目" value={completedQuestions} suffix={`/ ${totalQuestions}`} prefix={<FireOutlined style={{ color: '#52c41a' }} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="已生成资源" value={0} prefix={<FileTextOutlined style={{ color: '#1890ff' }} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="学习效率指数" value={efficiencyScore} suffix="分" prefix={<RiseOutlined style={{ color: '#faad14' }} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="预计完成时间" value={estimatedWeeks} suffix="周" prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="当前学习进度" bordered={false}>
            {topModule && practiceState ? (
              <>
                <div style={{ marginBottom: 16 }}><Text strong>{topModule.name}</Text><br /><Text type="secondary">{topModule.description}</Text></div>
                <Progress percent={topModulePercent} status="active" />
                <div style={{ marginTop: 16 }}><Text type="secondary">学习计划：{practiceLearningPlan.name}</Text></div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}><Text strong>暂无练习记录</Text><br /><Text type="secondary">完成一些练习后，这里将展示您的学习进度</Text></div>
                <Progress percent={0} />
              </>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="学习效果评估" bordered={false}>
            {topTagScores.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {topTagScores.map((item, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{tagToChinese(item.tag)}</Text><Text strong>{item.score}分</Text>
                    </div>
                    <Progress percent={item.score} showInfo={false} size="small" />
                  </div>
                ))}
              </Space>
            ) : <Text type="secondary">尚无练习数据</Text>}
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="学习画像概览" bordered={false}>
            <Row gutter={16}>
              {profile.dimensions.map((dim, i) => (
                <Col span={8} key={i} style={{ marginBottom: 16 }}>
                  <Card size="small" style={{ background: '#fafafa' }}>
                    <Space>
                      <Avatar size="small" style={{ background: dim.level === '高' ? '#52c41a' : dim.level === '中' ? '#1890ff' : '#faad14' }}>{dim.label[0]}</Avatar>
                      <div><Text strong>{dim.label}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{dim.value}</Text></div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="多智能体协作系统" bordered={false}>
            <List grid={{ gutter: 16, xs: 1, sm: 2, md: 5 }} dataSource={agentStatusList} renderItem={item => (
              <List.Item>
                <Card size="small" style={{ borderTop: `3px solid ${item.color}` }}>
                  <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
                    <Tag color={item.color}>{item.active ? '运行中' : '待激活'}</Tag>
                    <Text strong style={{ fontSize: 12 }}>{item.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>
                  </Space>
                </Card>
              </List.Item>
            )} />
          </Card>
        </Col>
      </Row>
    </>
  );
}

// ==================== 老师仪表盘 ====================
function TeacherDashboard({ profile, practiceState }: { profile: StudentProfile; practiceState: PracticeState | null }) {
  const { getAllUsers } = useAuth();
  // 学生概况完全由用户列表 + localStorage 派生，渲染期计算即可（原先在 mount 后 setState）
  const studentStats = useMemo(() => {
    const students = getAllUsers().filter(u => u.role === 'student');
    return students.map(s => {
      try {
        const prRaw = localStorage.getItem(`${s.id}_practiceState`);
        const pr: PracticeState | null = prRaw ? JSON.parse(prRaw) : null;
        const pfRaw = localStorage.getItem(`${s.id}_studentProfile`);
        return {
          name: s.name,
          questions: pr?.results?.length || 0,
          hasProfile: !!pfRaw,
        };
      } catch {
        return { name: s.name, questions: 0, hasProfile: false };
      }
    });
  }, [getAllUsers]);
  const studentCount = studentStats.length;

  // 老师自己的学习数据
  const myTotal = practiceState?.results.length ?? 0;
  const myCorrect = practiceState?.results.filter(r => r.isCorrect === true).length ?? 0;

  return (
    <>
      <Title level={2}>欢迎回来，{profile.name}</Title>
      <Text type="secondary" style={{ fontSize: 16 }}>老师视角 · 您可以查看所有学生的学习数据</Text>

      {/* 老师自己的学习统计 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}><Card><Statistic title="我的练习题数" value={myTotal} prefix={<RocketOutlined style={{ color: '#1890ff' }} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="我的答对数" value={myCorrect} prefix={<FireOutlined style={{ color: '#52c41a' }} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="学生总数" value={studentCount} prefix={<TeamOutlined style={{ color: '#722ed1' }} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="已构建画像" value={studentStats.filter(s => s.hasProfile).length} prefix={<UserOutlined style={{ color: '#faad14' }} />} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        {/* 学生列表 */}
        <Col span={14}>
          <Card title="📋 学生学习概况" bordered={false}>
            {studentStats.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: '#666' }}>学生</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: '#666' }}>画像</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: '#666' }}>练习题数</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', color: '#666' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {studentStats.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '10px 12px' }}><Text strong>{s.name}</Text></td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        {s.hasProfile ? <Tag color="green">已构建</Tag> : <Tag>未构建</Tag>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        {s.questions > 0 ? <Tag color="blue">{s.questions} 题</Tag> : <Tag>未练习</Tag>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                        {s.questions >= 10 ? <Badge status="success" text="活跃" /> : s.questions > 0 ? <Badge status="processing" text="进行中" /> : <Badge status="default" text="未开始" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty description="暂无学生数据" />}
          </Card>
        </Col>

        {/* 班级统计 */}
        <Col span={10}>
          <Card title="📊 班级数据" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text type="secondary">学生参与率</Text>
                <Progress
                  percent={studentCount > 0 ? Math.round((studentStats.filter(s => s.questions > 0).length / studentCount) * 100) : 0}
                  status="active"
                />
              </div>
              <div>
                <Text type="secondary">画像构建率</Text>
                <Progress
                  percent={studentCount > 0 ? Math.round((studentStats.filter(s => s.hasProfile).length / studentCount) * 100) : 0}
                  status="active"
                  strokeColor="#52c41a"
                />
              </div>
              <div>
                <Text type="secondary">班级总练习题数</Text>
                <Title level={3} style={{ margin: '4px 0 0' }}>{studentStats.reduce((s, st) => s + st.questions, 0)} 题</Title>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

// ==================== 管理员仪表盘 ====================
function AdminDashboard() {
  const { getAllUsers } = useAuth();
  // 管理面板数据全部为派生值，渲染期计算即可（原先在 mount 后 setState）
  const users = useMemo(() => getAllUsers(), [getAllUsers]);
  const feedbacks = useMemo(() => getAllFeedbacks(), []);
  const userCount = users.length;
  const roleCounts = useMemo(() => ({
    student: users.filter(u => u.role === 'student').length,
    teacher: users.filter(u => u.role === 'teacher').length,
    admin: users.filter(u => u.role === 'admin').length,
  }), [users]);
  const feedbackStats = useMemo(() => ({
    total: feedbacks.length,
    pending: feedbacks.filter(f => f.status === 'pending').length,
    resolved: feedbacks.filter(f => f.status === 'resolved').length,
  }), [feedbacks]);
  const recentFeedbacks = useMemo(() => feedbacks.slice(0, 5), [feedbacks]);

  const TYPE_MAP: Record<string, { label: string; color: string }> = {
    bug: { label: 'Bug', color: 'red' },
    feature: { label: '功能建议', color: 'blue' },
    other: { label: '其他', color: 'default' },
  };

  return (
    <>
      <Title level={2}>系统管理面板</Title>
      <Text type="secondary" style={{ fontSize: 16 }}>管理员视角 · 查看系统使用情况和用户反馈</Text>

      {/* 系统统计 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}><Card><Statistic title="总用户数" value={userCount} prefix={<UserOutlined style={{ color: '#1890ff' }} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="学生" value={roleCounts.student} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="老师" value={roleCounts.teacher} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="待处理反馈" value={feedbackStats.pending} valueStyle={{ color: feedbackStats.pending > 0 ? '#faad14' : '#52c41a' }} prefix={<MessageOutlined />} /></Card></Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        {/* 用户分布 */}
        <Col span={8}>
          <Card title="👤 用户分布" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>学生</Text><Text strong>{roleCounts.student}</Text>
                </div>
                <Progress percent={userCount > 0 ? Math.round((roleCounts.student / userCount) * 100) : 0} strokeColor="#52c41a" showInfo={false} size="small" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>老师</Text><Text strong>{roleCounts.teacher}</Text>
                </div>
                <Progress percent={userCount > 0 ? Math.round((roleCounts.teacher / userCount) * 100) : 0} strokeColor="#722ed1" showInfo={false} size="small" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>管理员</Text><Text strong>{roleCounts.admin}</Text>
                </div>
                <Progress percent={userCount > 0 ? Math.round((roleCounts.admin / userCount) * 100) : 0} strokeColor="#faad14" showInfo={false} size="small" />
              </div>
            </Space>
          </Card>
        </Col>

        {/* 反馈统计 */}
        <Col span={8}>
          <Card title="📬 反馈统计" bordered={false}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Statistic title="总反馈数" value={feedbackStats.total} />
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>待处理</Text><Text style={{ color: '#faad14' }}>{feedbackStats.pending}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>已处理</Text><Text style={{ color: '#52c41a' }}>{feedbackStats.resolved}</Text>
                </div>
                <Progress
                  percent={feedbackStats.total > 0 ? Math.round((feedbackStats.resolved / feedbackStats.total) * 100) : 0}
                  strokeColor="#52c41a"
                />
              </div>
            </Space>
          </Card>
        </Col>

        {/* 最近反馈 */}
        <Col span={8}>
          <Card title="最近反馈" bordered={false}>
            {recentFeedbacks.length > 0 ? (
              <List
                size="small"
                dataSource={recentFeedbacks}
                renderItem={fb => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={TYPE_MAP[fb.type]?.color} style={{ fontSize: 11 }}>{TYPE_MAP[fb.type]?.label}</Tag>
                          <Text style={{ fontSize: 13 }}>{fb.title}</Text>
                        </Space>
                      }
                      description={
                        <Space>
                          <Text type="secondary" style={{ fontSize: 11 }}>{fb.userName}</Text>
                          {fb.status === 'pending' ? <Badge status="processing" text="待处理" /> : <Badge status="success" text="已处理" />}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : <Empty description="暂无反馈" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
      </Row>
    </>
  );
}

// ==================== 主组件 ====================
const Home: React.FC = () => {
  const { currentUser, isAdmin, isTeacher } = useAuth();
  // 画像与练习进度在首帧同步读取（原先在 mount 后 setState，会多一次级联渲染）
  const [profile] = useState<StudentProfile | null>(() => loadInitialProfile());
  const [practiceState] = useState<PracticeState | null>(() => loadPracticeState());

  // 没有画像时，用当前登录用户的信息兜底（不再用 mock 的"张三"）
  const fallbackProfile: StudentProfile = {
    ...initialProfile,
    id: currentUser?.id || initialProfile.id,
    name: currentUser?.name || initialProfile.name,
  };
  const resolvedProfile = profile || fallbackProfile;

  // 管理员 → 管理面板（不显示学习内容）
  if (isAdmin) return <div style={{ padding: 24 }}><AdminDashboard /></div>;

  // 老师 → 自己的学习 + 学生概览
  if (isTeacher) return <div style={{ padding: 24 }}><TeacherDashboard profile={resolvedProfile} practiceState={practiceState} /></div>;

  // 学生 → 学习仪表盘
  return <div style={{ padding: 24 }}><StudentDashboard profile={resolvedProfile} practiceState={practiceState} /></div>;
};

export default Home;
