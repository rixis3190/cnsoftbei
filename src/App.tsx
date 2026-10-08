import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout, Button, Dropdown, Avatar, Space, Tag, Typography, message, Modal, Form, Input, Select, Spin } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined, MessageOutlined, BugOutlined, BulbOutlined, CommentOutlined } from '@ant-design/icons';
import SideMenu from './components/SideMenu';
import Login from './pages/Login';
import { PageCacheProvider } from './context/PageCacheContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { submitFeedback } from './services/feedback';
import { userKey } from './services/storage';
import { initialProfile } from './data/mockData';
import type { StudentProfile } from './types';
import './App.css';

// ==================== 页面级代码分割 ====================
// 11 个页面 + recharts + react-syntax-highlighter 全部静态引入时，
// 首屏 chunk 达2.1MB（gzip 709KB）。改为按需加载：
//   - 登录页保持静态引入：它是未登录用户的第一屏，多一次请求体验很差；
//   - 其余页面一律 lazy，切换菜单时才下载对应 chunk。
// 注意：新增页面时务必用 lazy 引入，否则会重新把包体打大。
const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const Resources = lazy(() => import('./pages/Resources'));
const Path = lazy(() => import('./pages/Path'));
const Tutor = lazy(() => import('./pages/Tutor'));
const Assessment = lazy(() => import('./pages/Assessment'));
const Practice = lazy(() => import('./pages/Practice'));
const UserManage = lazy(() => import('./pages/admin/UserManage'));
const StudentOverview = lazy(() => import('./pages/admin/StudentOverview'));
const FeedbackManage = lazy(() => import('./pages/admin/FeedbackManage'));

const { Header, Content } = Layout;
const { TextArea } = Input;
const { Text } = Typography;

/** 页面 chunk 加载中的占位（antd Spin 已在主 chunk，不额外增加体积） */
function PageLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <Spin size="large" />
    </div>
  );
}

const ROLE_LABELS: Record<string, { text: string; color: string }> = {
  admin: { text: '管理员', color: 'red' },
  teacher: { text: '老师', color: 'blue' },
  student: { text: '学生', color: 'green' },
};

const MAJOR_OPTIONS = [
  '计算机科学与技术', '软件工程', '人工智能', '数据科学与大数据',
  '网络工程', '信息安全', '物联网工程', '电子信息工程',
  '通信工程', '自动化', '数学与应用数学', '其他',
];

const GRADE_OPTIONS = ['大一', '大二', '大三', '大四', '研一', '研二', '研三'];

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('home');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackForm] = Form.useForm();
  const [profileForm] = Form.useForm();
  const { currentUser, isLoggedIn, logout, isAdmin, isTeacher } = useAuth();

  // 所有 useState/useEffect 必须在条件返回之前
  const [needProfile, setNeedProfile] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !currentUser) { setNeedProfile(false); return; }
    if (isAdmin) { setNeedProfile(false); return; }
    try {
      const saved = localStorage.getItem(userKey('studentProfile'));
      if (saved) {
        setNeedProfile(false);
      } else {
        profileForm.setFieldsValue({ name: currentUser.name, major: '计算机科学与技术', grade: '大三' });
        setNeedProfile(true);
      }
    } catch { setNeedProfile(true); }
  }, [isLoggedIn, currentUser?.id]);

  // 条件返回放在所有 hooks 之后
  if (!isLoggedIn) return <Login />;

  const handleProfileSubmit = async () => {
    const values = profileForm.getFieldsValue();
    if (!values.major) { message.warning('请选择专业'); return; }
    if (!values.grade) { message.warning('请选择年级'); return; }

    setProfileSubmitting(true);
    try {
      const profile: StudentProfile = {
        id: currentUser!.id,
        name: currentUser!.name,
        major: values.major,
        grade: values.grade,
        updatedAt: new Date().toISOString(),
        dimensions: initialProfile.dimensions.map(d => ({ ...d, value: '', level: '中' as const })),
      };
      localStorage.setItem(userKey('studentProfile'), JSON.stringify(profile));
      message.success('信息登记完成！');
      setNeedProfile(false);
      window.location.reload();
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleProfileSkip = () => {
    const profile: StudentProfile = {
      id: currentUser!.id,
      name: currentUser!.name,
      major: '计算机科学与技术',
      grade: '大三',
      updatedAt: new Date().toISOString(),
      dimensions: initialProfile.dimensions.map(d => ({ ...d, value: '', level: '中' as const })),
    };
    localStorage.setItem(userKey('studentProfile'), JSON.stringify(profile));
    message.info('已使用默认信息');
    setNeedProfile(false);
    window.location.reload();
  };

  const handleFeedbackSubmit = async () => {
    const values = feedbackForm.getFieldsValue();
    if (!values.title?.trim()) { message.warning('请填写标题'); return; }
    if (!values.content?.trim()) { message.warning('请填写内容'); return; }

    setFeedbackSubmitting(true);
    try {
      submitFeedback(
        currentUser!.id,
        currentUser!.name,
        currentUser!.role,
        values.type || 'other',
        values.title.trim(),
        values.content.trim(),
      );
      message.success('反馈已提交，感谢您的建议！');
      setFeedbackOpen(false);
      feedbackForm.resetFields();
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const renderPage = () => {
    switch (selectedKey) {
      case 'home': return <Home />;
      case 'profile': return <Profile />;
      case 'resources': return <Resources />;
      case 'path': return <Path onNavigate={setSelectedKey} />;
      case 'tutor': return <Tutor />;
      case 'assessment': return <Assessment />;
      case 'practice': return <Practice />;
      case 'admin/users': return <UserManage />;
      case 'admin/students': return <StudentOverview />;
      case 'admin/feedback': return <FeedbackManage />;
      default: return <Home />;
    }
  };

  const roleInfo = ROLE_LABELS[currentUser?.role || 'student'];

  const userMenuItems = [
    {
      key: 'role',
      label: <Tag color={roleInfo.color}>{roleInfo.text}</Tag>,
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
    {
      key: 'feedback',
      icon: <MessageOutlined />,
      label: '意见反馈',
    },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
      message.success('已退出登录');
      setSelectedKey('home');
    } else if (key === 'feedback') {
      feedbackForm.resetFields();
      setFeedbackOpen(true);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <SideMenu
        collapsed={collapsed}
        selectedKey={selectedKey}
        onMenuSelect={setSelectedKey}
        isAdmin={isAdmin}
        isTeacher={isTeacher}
      />
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 64, height: 64 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontWeight: 'bold', color: '#1890ff', fontSize: 16 }}>
              第十五届中国软件杯 - A3赛题
            </div>
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span style={{ fontSize: 14 }}>{currentUser?.name}</span>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 0, background: '#f0f2f5' }}>
          <PageCacheProvider>
            <Suspense fallback={<PageLoading />}>
              {renderPage()}
            </Suspense>
          </PageCacheProvider>
        </Content>
      </Layout>

      {/* 信息登记弹窗 */}
      <Modal
        title="📋 信息登记"
        open={needProfile}
        onOk={handleProfileSubmit}
        onCancel={handleProfileSkip}
        okText="开始学习"
        cancelText="跳过"
        closable={false}
        maskClosable={false}
        confirmLoading={profileSubmitting}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">请填写基本信息，系统将为你生成个性化学习方案。</Text>
        </div>
        <Form form={profileForm} layout="vertical">
          <Form.Item name="name" label="姓名">
            <Input disabled />
          </Form.Item>
          <Form.Item name="major" label="专业" rules={[{ required: true, message: '请选择专业' }]}>
            <Select showSearch placeholder="选择你的专业">
              {MAJOR_OPTIONS.map(m => <Select.Option key={m} value={m}>{m}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="grade" label="年级" rules={[{ required: true, message: '请选择年级' }]}>
            <Select placeholder="选择你的年级">
              {GRADE_OPTIONS.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 反馈弹窗 */}
      <Modal
        title="💬 意见反馈"
        open={feedbackOpen}
        onOk={handleFeedbackSubmit}
        onCancel={() => setFeedbackOpen(false)}
        okText="提交"
        cancelText="取消"
        confirmLoading={feedbackSubmitting}
      >
        <Form form={feedbackForm} layout="vertical" initialValues={{ type: 'other' }}>
          <Form.Item name="type" label="反馈类型">
            <Select>
              <Select.Option value="bug"><BugOutlined /> Bug 报告</Select.Option>
              <Select.Option value="feature"><BulbOutlined /> 功能建议</Select.Option>
              <Select.Option value="other"><CommentOutlined /> 其他意见</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写标题' }]}>
            <Input placeholder="简要描述您的反馈" />
          </Form.Item>
          <Form.Item name="content" label="详细内容" rules={[{ required: true, message: '请填写内容' }]}>
            <TextArea rows={4} placeholder="请详细描述您遇到的问题或建议..." />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}

export default App;
