import React from 'react';
import { Layout, Menu } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  AimOutlined,
  QuestionCircleOutlined,
  DashboardOutlined,
  HomeOutlined,
  RocketOutlined,
  TeamOutlined,
  SettingOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { menuItems as menuData } from '../data/mockData';

const { Sider } = Layout;

// 图标名字符串到组件的映射
const iconComponentMap: Record<string, React.ReactNode> = {
  HomeOutlined: <HomeOutlined />,
  UserOutlined: <UserOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  AimOutlined: <AimOutlined />,
  QuestionCircleOutlined: <QuestionCircleOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  RocketOutlined: <RocketOutlined />,
  TeamOutlined: <TeamOutlined />,
  SettingOutlined: <SettingOutlined />,
  MessageOutlined: <MessageOutlined />,
};

interface SideMenuProps {
  collapsed: boolean;
  selectedKey: string;
  onMenuSelect: (key: string) => void;
  isAdmin?: boolean;
  isTeacher?: boolean;
}

// 管理员不显示的学习菜单 key
const ADMIN_HIDDEN_KEYS = ['profile', 'resources', 'path', 'practice', 'tutor', 'assessment'];

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, selectedKey, onMenuSelect, isAdmin, isTeacher }) => {
  // 基础菜单（管理员过滤掉学习模块）
  const baseItems = menuData
    .filter(item => !isAdmin || !ADMIN_HIDDEN_KEYS.includes(item.key))
    .map(item => ({
      key: item.key,
      icon: iconComponentMap[item.iconName] || null,
      label: item.label,
    }));

  // 根据角色添加管理菜单
  const extraItems: any[] = [];

  if (isTeacher) {
    extraItems.push({
      key: 'admin/students',
      icon: <TeamOutlined />,
      label: '学生总览',
    });
  }

  if (isAdmin) {
    extraItems.push({
      key: 'admin/feedback',
      icon: <MessageOutlined />,
      label: '反馈管理',
    });
    extraItems.push({
      key: 'admin/users',
      icon: <SettingOutlined />,
      label: '用户管理',
    });
  }

  // 分隔符 + 管理菜单
  const items = extraItems.length > 0
    ? [...baseItems, { type: 'divider' as const }, ...extraItems]
    : baseItems;

  return (
    <Sider collapsible collapsed={collapsed} trigger={null} style={{ minHeight: '100vh' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
        {collapsed ? 'AI' : '学习智能体'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={({ key }) => onMenuSelect(key)}
        items={items}
      />
    </Sider>
  );
};

export default SideMenu;
