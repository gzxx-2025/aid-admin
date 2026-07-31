import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip
} from 'antd'
import {
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { ErrorLog, listErrorLog } from '@/api/aid/errorlog'
import { listProvider } from '@/api/aid/aimanage'
import { useNavigate } from 'react-router-dom'

/**
 * 未识别错误 / 错误样本日志。
 * <p>
 * 默认只展示未识别的样本（matched_rule_id IS NULL），按出现次数排序。
 * 点"基于此创建规则"跳到错误规则页，预填好关键字。
 * </p>
 */
export default function ErrorLogPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<ErrorLog[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState<any>({ pageNum: 1, pageSize: 20, onlyUnmatched: true })
  const [searchForm] = Form.useForm()

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<ErrorLog | null>(null)
  const [providers, setProviders] = useState<{ providerCode: string; providerName: string }[]>([])

  const loadProviders = async () => {
    try {
      const res: any = await listProvider({ pageNum: 1, pageSize: 999, status: '0' })
      setProviders((res?.rows || []).map((p: any) => ({
        providerCode: p.providerCode,
        providerName: p.providerName
      })))
    } catch {
      // ignore
    }
  }

  const loadList = async () => {
    setLoading(true)
    try {
      const res: any = await listErrorLog(query)
      setList(res.rows || [])
      setTotal(res.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProviders()
  }, [])

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleSearch = () => {
    const v = searchForm.getFieldsValue()
    setQuery({ ...query, ...v, pageNum: 1 })
  }

  const handleReset = () => {
    searchForm.resetFields()
    setQuery({ pageNum: 1, pageSize: query.pageSize, onlyUnmatched: true })
  }

  const handleConvertToRule = (row: ErrorLog) => {
    // 把样本作为关键字预填到新建规则页（通过 query string 传递）
    const params = new URLSearchParams()
    if (row.providerCode) params.set('providerCode', row.providerCode)
    if (row.modelCode) params.set('modelCode', row.modelCode)
    // 取前 80 字作为初始 matchPattern 提示
    const sample = (row.rawMessage || '').slice(0, 80)
    params.set('matchPattern', sample)
    params.set('matchType', 'KEYWORD')
    navigate(`/aid/errorrule?${params.toString()}`)
  }

  const columns: any[] = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '厂商 / 模型',
      key: 'scope',
      width: 220,
      render: (_: any, r: ErrorLog) => (
        <Space direction="vertical" size={2}>
          <Tag color="geekblue">{r.providerCode || '_global'}</Tag>
          {r.modelCode && <Tag color="purple">{r.modelCode}</Tag>}
        </Space>
      )
    },
    {
      title: 'HTTP',
      dataIndex: 'httpStatus',
      width: 80,
      render: (v: number) => (v ? <Tag>{v}</Tag> : <span style={{ color: '#94a3b8' }}>--</span>)
    },
    {
      title: '原始错误（截断）',
      dataIndex: 'rawMessage',
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v} placement="topLeft">
          <code
            style={{
              background: '#f8fafc',
              color: '#475569',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'Consolas, Menlo, monospace'
            }}
          >
            {v}
          </code>
        </Tooltip>
      )
    },
    {
      title: '命中规则',
      dataIndex: 'matchedRuleId',
      width: 130,
      render: (v: number | null, r: ErrorLog) =>
        v ? (
          <Tag color="green">规则 #{v}</Tag>
        ) : (
          <Tag color="orange">未识别 → {r.matchedErrorCode}</Tag>
        )
    },
    { title: '次数', dataIndex: 'occurrenceCount', width: 80 },
    { title: '首次', dataIndex: 'firstSeen', width: 160 },
    { title: '最近', dataIndex: 'lastSeen', width: 160 },
    {
      title: '操作',
      key: 'op',
      width: 220,
      fixed: 'right',
      render: (_: any, r: ErrorLog) => (
        <Space>
          <Button
            size="small"
            icon={<FileSearchOutlined />}
            onClick={() => {
              setDetail(r)
              setDetailOpen(true)
            }}
          >
            详情
          </Button>
          {!r.matchedRuleId && (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleConvertToRule(r)}
            >
              转为规则
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            未识别错误样本
          </Space>
        }
      >
        <Form form={searchForm} layout="inline" style={{ marginBottom: 12 }} onFinish={handleSearch}>
          <Row gutter={[8, 8]} style={{ width: '100%' }}>
            <Col>
              <Form.Item name="providerCode" label="厂商">
                <Select
                  allowClear
                  showSearch
                  placeholder="选择厂商"
                  style={{ width: 220 }}
                  optionFilterProp="label"
                  options={providers.map((p) => ({
                    value: p.providerCode,
                    label: `${p.providerName}（${p.providerCode}）`
                  }))}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="onlyUnmatched" label="仅未识别" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
            <Col>
              <Space>
                <Button icon={<SearchOutlined />} type="primary" htmlType="submit">
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          columns={columns}
          scroll={{ x: 1200 }}
          pagination={{
            current: query.pageNum,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, s) => setQuery({ ...query, pageNum: p, pageSize: s })
          }}
        />
      </Card>

      <Modal
        title="样本详情"
        open={detailOpen}
        footer={null}
        width={760}
        onCancel={() => setDetailOpen(false)}
      >
        {detail && (
          <div>
            <p>
              <Tag color="geekblue">{detail.providerCode || '_global'}</Tag>
              {detail.modelCode && <Tag color="purple">{detail.modelCode}</Tag>}
              {detail.httpStatus && <Tag>HTTP {detail.httpStatus}</Tag>}
              <Tag>出现 {detail.occurrenceCount} 次</Tag>
            </p>
            <pre
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                padding: 16,
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.6,
                maxHeight: 360,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}
            >
              {detail.rawMessage}
            </pre>
            <p style={{ marginTop: 12 }}>
              <span style={{ marginRight: 8 }}>命中：</span>
              {detail.matchedRuleId ? (
                <Tag color="green">规则 #{detail.matchedRuleId}</Tag>
              ) : (
                <Tag color="orange">未识别 → {detail.matchedErrorCode}</Tag>
              )}
            </p>
            {!detail.matchedRuleId && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleConvertToRule(detail)}>
                基于此创建规则
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
