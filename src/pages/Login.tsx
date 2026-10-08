/**
 * Login — 登录/注册页面
 */

import React, { useState } from 'react'
import { Card, Form, Input, Button, Tabs, message, Typography } from 'antd'
import { UserOutlined, LockOutlined, SmileOutlined } from '@ant-design/icons'
import { useAuth } from '../context/useAuth'

const { Title, Text } = Typography

const Login: React.FC = () => {
  const { login, register } = useAuth()
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)

  const onLogin = (values: { username: string; password: string }) => {
    setLoading(true)
    setTimeout(() => {
      const ok = login(values.username, values.password)
      if (ok) {
        message.success('登录成功')
      } else {
        message.error('用户名或密码错误')
      }
      setLoading(false)
    }, 300)
  }

  const onRegister = (values: { username: string; password: string; name: string }) => {
    setLoading(true)
    setTimeout(() => {
      const result = register(values.username, values.password, values.name)
      if (result.success) {
        message.success(result.message)
        // 注册后自动登录，AppLayout 会检测到没有 profile 并弹出登记表
      } else {
        message.error(result.message)
      }
      setLoading(false)
    }, 300)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card
        style={{ width: 420, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>🤖 学习智能体系统</Title>
          <Text type="secondary">第十五届中国软件杯 · A3 赛题</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form onFinish={onLogin} size="large" style={{ marginTop: 8 }}>
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form onFinish={onRegister} size="large" style={{ marginTop: 8 }}>
                  <Form.Item name="name" rules={[{ required: true, message: '请输入姓名' }]}>
                    <Input prefix={<SmileOutlined />} placeholder="姓名" />
                  </Form.Item>
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 3, message: '至少3个字符' }]}>
                    <Input prefix={<UserOutlined />} placeholder="用户名（至少3个字符）" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6个字符' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码（至少6个字符）" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />

        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#999' }}>
          <div>预置账号：</div>
          <div>admin / admin123（管理员）</div>
          <div>teacher1 / teacher123（老师）</div>
          <div>student1 / student123（学生）</div>
        </div>
      </Card>
    </div>
  )
}

export default Login
