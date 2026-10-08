/**
 * StudentOverview — 老师/管理员查看学生总览
 *
 * 功能：查看所有学生的画像、练习进度、学习路径
 */

import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Modal, Descriptions, Typography, Space, Progress, Row, Col, Statistic, Empty } from 'antd'
import { EyeOutlined, TeamOutlined } from '@ant-design/icons'
import { useAuth, type User } from '../../context/AuthContext'
import type { StudentProfile, PracticeState, LearningPathPlan } from '../../types'

const { Title, Text } = Typography

interface StudentData {
  user: User
  profile: StudentProfile | null
  practice: PracticeState | null
  pathPlan: LearningPathPlan | null
}

function loadStudentData(user: User): StudentData {
  try {
    const profileRaw = localStorage.getItem(`${user.id}_studentProfile`)
    const practiceRaw = localStorage.getItem(`${user.id}_practiceState`)
    const pathRaw = localStorage.getItem(`${user.id}_learningPathPlan`)

    return {
      user,
      profile: profileRaw ? JSON.parse(profileRaw) : null,
      practice: practiceRaw ? JSON.parse(practiceRaw) : null,
      pathPlan: pathRaw ? JSON.parse(pathRaw) : null,
    }
  } catch {
    return { user, profile: null, practice: null, pathPlan: null }
  }
}

const StudentOverview: React.FC = () => {
  const { getAllUsers } = useAuth()
  const [students, setStudents] = useState<StudentData[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null)

  useEffect(() => {
    const allUsers = getAllUsers()
    const studentUsers = allUsers.filter(u => u.role === 'student')
    setStudents(studentUsers.map(loadStudentData))
  }, [])

  const handleViewDetail = (student: StudentData) => {
    setSelectedStudent(student)
    setDetailOpen(true)
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: ['user', 'name'],
      key: 'name',
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '用户名',
      dataIndex: ['user', 'username'],
      key: 'username',
    },
    {
      title: '画像状态',
      key: 'profile',
      render: (_: any, record: StudentData) =>
        record.profile ? <Tag color="green">已构建</Tag> : <Tag color="default">未构建</Tag>,
    },
    {
      title: '练习题数',
      key: 'practice',
      render: (_: any, record: StudentData) => {
        const count = record.practice?.results?.length || 0
        return count > 0 ? <Tag color="blue">{count} 题</Tag> : <Tag color="default">未练习</Tag>
      },
    },
    {
      title: '学习路径',
      key: 'path',
      render: (_: any, record: StudentData) =>
        record.pathPlan ? <Tag color="purple">{record.pathPlan.stages.length} 阶段</Tag> : <Tag color="default">未生成</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: StudentData) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          查看详情
        </Button>
      ),
    },
  ]

  const profileDims = selectedStudent?.profile?.dimensions || []
  const totalQuestions = selectedStudent?.practice?.results?.length || 0
  const correctCount = selectedStudent?.practice?.results?.filter(r => r.isCorrect === true).length || 0
  const pathStages = selectedStudent?.pathPlan?.stages || []

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <TeamOutlined /> 学生总览
          </Title>
          <Tag color="blue">共 {students.length} 名学生</Tag>
        </div>

        <Table
          dataSource={students}
          columns={columns}
          rowKey={(r) => r.user.id}
          pagination={false}
          size="middle"
          locale={{ emptyText: <Empty description="暂无学生数据" /> }}
        />
      </Card>

      {/* 学生详情弹窗 */}
      <Modal
        title={`📊 ${selectedStudent?.user.name || ''} — 学习数据详情`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={800}
      >
        {selectedStudent && (
          <div>
            {/* 基本统计 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Statistic title="练习题目" value={totalQuestions} suffix="题" />
              </Col>
              <Col span={8}>
                <Statistic title="答对题目" value={correctCount} suffix="题" valueStyle={{ color: '#3f8600' }} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="正确率"
                  value={totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}
                  suffix="%"
                  valueStyle={{ color: totalQuestions > 0 ? '#1890ff' : '#999' }}
                />
              </Col>
            </Row>

            {/* 画像维度 */}
            {profileDims.length > 0 && (
              <>
                <Title level={5}>🧠 学习画像</Title>
                <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
                  {profileDims.map(dim => (
                    <Descriptions.Item key={dim.key} label={dim.label}>
                      <Space>
                        <Tag color={dim.level === '高' ? 'green' : dim.level === '中' ? 'blue' : 'orange'}>
                          {dim.level}
                        </Tag>
                        <Text>{dim.value || '未填写'}</Text>
                      </Space>
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}

            {/* 学习路径 */}
            {pathStages.length > 0 && (
              <>
                <Title level={5}>🛤️ 学习路径</Title>
                <div style={{ marginBottom: 24 }}>
                  {pathStages.map((stage, i) => (
                    <Card key={stage.stageId} size="small" style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color="blue">阶段 {i + 1}</Tag>
                          <Text strong>{stage.stageName}</Text>
                        </Space>
                        <Tag>{stage.estimatedHours}h</Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{stage.stageGoal}</Text>
                      <div style={{ marginTop: 4 }}>
                        {stage.coreKnowledgePoints.map(kp => (
                          <Tag key={kp} style={{ fontSize: 11 }}>{kp}</Tag>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* 练习详情 */}
            {totalQuestions > 0 && selectedStudent.practice?.tagScores && selectedStudent.practice.tagScores.length > 0 && (
              <>
                <Title level={5}>📈 知识点掌握度</Title>
                <div style={{ marginBottom: 16 }}>
                  {selectedStudent.practice.tagScores.map(ts => (
                    <div key={ts.tag} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ width: 120, fontSize: 13 }}>{ts.tag}</Text>
                      <Progress
                        percent={ts.score}
                        size="small"
                        style={{ flex: 1, margin: '0 12px' }}
                        status={ts.score >= 80 ? 'success' : ts.score >= 50 ? 'normal' : 'exception'}
                      />
                      <Text style={{ width: 40, textAlign: 'right', fontSize: 13 }}>{ts.score}%</Text>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 无数据提示 */}
            {!selectedStudent.profile && !selectedStudent.practice && !selectedStudent.pathPlan && (
              <Empty description="该学生暂无学习数据" />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default StudentOverview
