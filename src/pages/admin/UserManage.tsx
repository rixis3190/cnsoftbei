/**
 * UserManage — 管理员用户管理页面
 *
 * 功能：查看所有用户、修改角色、重置密码、删除用户
 */

import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, KeyOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth, type User, type UserRole } from '../../context/AuthContext'
import { useDebounce } from '../../hooks/useDebounce'

const { Title } = Typography

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  admin: { label: '管理员', color: 'red' },
  teacher: { label: '老师', color: 'blue' },
  student: { label: '学生', color: 'green' },
}

const UserManage: React.FC = () => {
  const { getAllUsers, deleteUser, updateUserRole, resetPassword, currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [roleForm] = Form.useForm()
  const [pwdForm] = Form.useForm()

  const refresh = () => setUsers(getAllUsers())

  useEffect(() => { refresh() }, [])

  const handleRoleChange = (user: User) => {
    setEditingUser(user)
    roleForm.setFieldsValue({ role: user.role })
    setRoleModalOpen(true)
  }

  const [roleSubmitting, handleRoleSubmit] = useDebounce(() => {
    const { role } = roleForm.getFieldsValue() as { role: UserRole }
    if (editingUser) {
      updateUserRole(editingUser.id, role)
      message.success(`已将 ${editingUser.name} 的角色改为 ${ROLE_CONFIG[role].label}`)
      refresh()
    }
    setRoleModalOpen(false)
  })

  const handleResetPwd = (user: User) => {
    setEditingUser(user)
    pwdForm.resetFields()
    setPwdModalOpen(true)
  }

  const [pwdSubmitting, handlePwdSubmit] = useDebounce(() => {
    const { newPassword } = pwdForm.getFieldsValue()
    if (editingUser && newPassword) {
      resetPassword(editingUser.id, newPassword)
      message.success(`已重置 ${editingUser.name} 的密码`)
    }
    setPwdModalOpen(false)
  })

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      message.error('不能删除当前登录用户')
      return
    }
    deleteUser(user.id)
    message.success(`已删除用户 ${user.name}`)
    refresh()
  }

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => {
        const cfg = ROLE_CONFIG[role]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleRoleChange(record)}
            disabled={record.id === currentUser?.id}
          >
            改角色
          </Button>
          <Button
            size="small"
            icon={<KeyOutlined />}
            onClick={() => handleResetPwd(record)}
          >
            重置密码
          </Button>
          <Popconfirm
            title={`确定删除 ${record.name}？`}
            onConfirm={() => handleDelete(record)}
            disabled={record.id === currentUser?.id}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.id === currentUser?.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <UserOutlined /> 用户管理
          </Title>
          <Tag color="blue">共 {users.length} 个用户</Tag>
        </div>

        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* 修改角色弹窗 */}
      <Modal
        title="修改用户角色"
        open={roleModalOpen}
        onOk={handleRoleSubmit}
        onCancel={() => setRoleModalOpen(false)}
        confirmLoading={roleSubmitting}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item label="用户">
            <Input value={editingUser?.name} disabled />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="student">学生</Select.Option>
              <Select.Option value="teacher">老师</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title={`重置密码 — ${editingUser?.name}`}
        open={pwdModalOpen}
        onOk={handlePwdSubmit}
        onCancel={() => setPwdModalOpen(false)}
        confirmLoading={pwdSubmitting}
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '至少6个字符' }]}>
            <Input.Password placeholder="输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserManage
