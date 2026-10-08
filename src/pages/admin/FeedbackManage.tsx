/**
 * FeedbackManage — 管理员反馈管理页面
 */

import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, message, Space, Typography, Popconfirm, Descriptions, Modal, Badge } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EyeOutlined, MessageOutlined } from '@ant-design/icons'
import { getAllFeedbacks, resolveFeedback, deleteFeedback, type Feedback } from '../../services/feedback'

const { Title, Text, Paragraph } = Typography

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  bug: { label: 'Bug', color: 'red' },
  feature: { label: '功能建议', color: 'blue' },
  other: { label: '其他', color: 'default' },
}

const FeedbackManage: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<Feedback | null>(null)

  const refresh = () => setFeedbacks(getAllFeedbacks())

  useEffect(() => { refresh() }, [])

  const handleResolve = (fb: Feedback) => {
    resolveFeedback(fb.id)
    message.success('已标记为已处理')
    refresh()
  }

  const handleDelete = (fb: Feedback) => {
    deleteFeedback(fb.id)
    message.success('已删除')
    refresh()
  }

  const handleView = (fb: Feedback) => {
    setSelected(fb)
    setDetailOpen(true)
  }

  const pendingCount = feedbacks.filter(f => f.status === 'pending').length

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const cfg = TYPE_MAP[type] || TYPE_MAP.other
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '提交人',
      key: 'user',
      width: 120,
      render: (_: unknown, r: Feedback) => (
        <Space size={4}>
          <Text>{r.userName}</Text>
          <Tag style={{ fontSize: 11 }}>{r.userRole === 'student' ? '学生' : r.userRole === 'teacher' ? '老师' : '管理员'}</Tag>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) =>
        status === 'pending'
          ? <Badge status="processing" text="待处理" />
          : <Badge status="success" text="已处理" />,
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, r: Feedback) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>查看</Button>
          {r.status === 'pending' && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleResolve(r)}>
              处理
            </Button>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
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
            <MessageOutlined /> 用户反馈
          </Title>
          <Space>
            {pendingCount > 0 && <Tag color="orange">{pendingCount} 条待处理</Tag>}
            <Tag>共 {feedbacks.length} 条</Tag>
          </Space>
        </div>

        <Table
          dataSource={feedbacks}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>

      <Modal
        title="反馈详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={selected?.status === 'pending'
          ? <Button type="primary" onClick={() => { handleResolve(selected!); setDetailOpen(false) }}>标记已处理</Button>
          : null
        }
      >
        {selected && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="类型">
              <Tag color={TYPE_MAP[selected.type]?.color}>{TYPE_MAP[selected.type]?.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="标题">{selected.title}</Descriptions.Item>
            <Descriptions.Item label="提交人">{selected.userName}（{selected.userRole}）</Descriptions.Item>
            <Descriptions.Item label="提交时间">{new Date(selected.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {selected.status === 'pending' ? <Badge status="processing" text="待处理" /> : <Badge status="success" text="已处理" />}
            </Descriptions.Item>
            <Descriptions.Item label="内容">
              <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selected.content}</Paragraph>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default FeedbackManage
