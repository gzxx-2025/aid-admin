import React, { useEffect, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Form, Input, Modal, Popconfirm, Radio, Row,
  Select, Space, Table, Tag, Tooltip, message
} from 'antd';
import {
  DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined,
  ReloadOutlined, SearchOutlined, AppstoreOutlined,
  SafetyCertificateOutlined, EyeInvisibleOutlined, ThunderboltOutlined,
  ClockCircleOutlined, FileTextOutlined, SettingOutlined
} from '@ant-design/icons';
import { listConfig, getConfig, addConfig, updateConfig, delConfig, refreshCache } from '@/api/system/config';
import { download } from '@/utils/request';
import { useDict } from '@/hooks/useDict';
import Auth from '@/components/Auth';
import { parseTime } from '@/utils/ruoyi';

// 与后端 SC7 同源：key 含这些模式时视为敏感配置，前端列表不展示明文
function isSensitiveKey(key?: string): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  return k.includes('password')
    || k.includes('secret')
    || k.includes('apikey')
    || k.includes('api_key')
    || k.includes('token')
    || k.includes('accesskey');
}

export default function ConfigPage() {
  const [queryForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState<any>({ pageNum: 1, pageSize: 10 });
  const [dateRange, setDateRange] = useState<any>(null);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [dlg, setDlg] = useState<{ open: boolean; title: string; data?: any }>({ open: false, title: '' });
  const [saving, setSaving] = useState(false);
  const dicts = useDict('sys_yes_no');
  const yesNoDict = dicts['sys_yes_no'] || [];

  const loadList = async () => {
    setLoading(true);
    try {
      const params: any = { ...query };
      if (dateRange?.length === 2) {
        params.params = { beginTime: dateRange[0]?.format('YYYY-MM-DD'), endTime: dateRange[1]?.format('YYYY-MM-DD') };
      }
      const res: any = await listConfig(params);
      setList(res.rows || []);
      setTotal(res.total || 0);
    } finally { setLoading(false); }
  };
  useEffect(() => { loadList(); }, [query]);

  const openAdd = () => {
    editForm.resetFields();
    editForm.setFieldsValue({ configType: 'N' });
    setDlg({ open: true, title: '添加参数' });
  };
  const openEdit = async (row: any) => {
    editForm.resetFields();
    const res: any = await getConfig(row.configId);
    editForm.setFieldsValue(res.data || res);
    setDlg({ open: true, title: '修改参数', data: res.data || res });
  };
  const handleSave = async () => {
    const values = await editForm.validateFields();
    setSaving(true);
    try {
      if (dlg.data?.configId) {
        await updateConfig({ ...dlg.data, ...values });
        message.success('修改成功');
      } else {
        await addConfig(values);
        message.success('新增成功');
      }
      setDlg({ open: false, title: '' });
      loadList();
    } finally { setSaving(false); }
  };
  const handleDelete = (row?: any) => {
    const ids = row?.configId || selectedKeys.join(',');
    if (!ids) return;
    Modal.confirm({
      title: '提示', content: `是否确认删除参数编号为 "${ids}" 的数据项？`, okType: 'danger',
      onOk: async () => { await delConfig(ids); message.success('删除成功'); setSelectedKeys([]); loadList(); }
    });
  };

  const builtinCount = list.filter((r) => r.configType === 'Y').length;
  const sensitiveCount = list.filter((r) => isSensitiveKey(r.configKey)).length;
  const customCount = list.length - builtinCount;

  // 统计卡配色方案 - 使用柔和高级色
  const statCards = [
    {
      key: 'total',
      label: '参数总数',
      value: total,
      icon: <AppstoreOutlined />,
      accent: '#6366f1',
      bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
      iconBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      subtitle: '当前查询结果总数'
    },
    {
      key: 'builtin',
      label: '系统内置',
      value: builtinCount,
      icon: <SafetyCertificateOutlined />,
      accent: '#0ea5e9',
      bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
      iconBg: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      subtitle: '系统保留参数'
    },
    {
      key: 'custom',
      label: '业务参数',
      value: customCount,
      icon: <ThunderboltOutlined />,
      accent: '#10b981',
      bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
      iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      subtitle: '业务自定义配置'
    },
    {
      key: 'sensitive',
      label: '敏感配置',
      value: sensitiveCount,
      icon: <EyeInvisibleOutlined />,
      accent: '#f59e0b',
      bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      subtitle: '含密钥/令牌类配置'
    }
  ];

  return (
    <div className="crud-page">
      {/* 顶部 Hero */}
      <div style={{
        position: 'relative',
        borderRadius: 18,
        padding: '26px 30px',
        color: '#ffffff',
        overflow: 'hidden',
        background: 'linear-gradient(120deg, #0f172a 0%, #1e293b 40%, #312e81 100%)',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)'
      }}>
        <span aria-hidden style={{
          position: 'absolute', width: 260, height: 260, borderRadius: '50%',
          right: -60, top: -80, background: 'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
        <span aria-hidden style={{
          position: 'absolute', width: 220, height: 220, borderRadius: '50%',
          left: 30, bottom: -120, background: 'radial-gradient(circle, rgba(14, 165, 233, 0.35) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <span aria-hidden style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #a855f7 100%)',
              boxShadow: '0 10px 24px rgba(99, 102, 241, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
            }} />
            <span aria-hidden style={{
              position: 'absolute',
              inset: 2,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 60%)'
            }} />
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 30,
              filter: 'drop-shadow(0 2px 3px rgba(15, 23, 42, 0.25))'
            }}>
              <SettingOutlined />
            </div>
            <span aria-hidden style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)',
              border: '2px solid #1e1b4b',
              boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15)'
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
              padding: '3px 10px',
              borderRadius: 20,
              background: 'rgba(129, 140, 248, 0.18)',
              border: '1px solid rgba(165, 180, 252, 0.28)',
              color: '#c7d2fe',
              letterSpacing: 0.5,
              marginBottom: 8
            }}>
              <ThunderboltOutlined style={{ fontSize: 12 }} />
              SYSTEM CONFIG
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.2, lineHeight: 1.2 }}>系统参数配置</div>
            <div style={{ color: 'rgba(226, 232, 240, 0.78)', fontSize: 13, marginTop: 6 }}>
              维护系统运行所需的全局参数与业务配置，敏感配置值自动脱敏展示
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡 */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        {statCards.map((s) => (
          <Col xs={12} md={6} key={s.key}>
            <Card
              bordered={false}
              styles={{ body: { padding: 18 } }}
              style={{
                borderRadius: 14,
                background: s.bg,
                border: `1px solid ${s.accent}22`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                height: '100%'
              }}
              className="config-stat-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: s.iconBg, color: '#ffffff', fontSize: 22,
                  boxShadow: `0 8px 18px ${s.accent}44`
                }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: s.accent, fontSize: 13, fontWeight: 500, letterSpacing: 0.3 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                    {s.value}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>
                    {s.subtitle}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 搜索区 */}
      <Card className="page-card" bordered={false} style={{ marginTop: 14 }}>
        <Form form={queryForm} layout="inline" onFinish={(v) => setQuery({ ...query, ...v, pageNum: 1 })} style={{ rowGap: 8 }}>
          <Form.Item name="configName" label="参数名称">
            <Input allowClear style={{ width: 200 }} placeholder="请输入参数名称" prefix={<FileTextOutlined style={{ color: '#94a3b8' }} />} />
          </Form.Item>
          <Form.Item name="configKey" label="参数键名">
            <Input allowClear style={{ width: 200 }} placeholder="请输入参数键名" />
          </Form.Item>
          <Form.Item name="configType" label="系统内置">
            <Select allowClear style={{ width: 140 }} placeholder="请选择" options={yesNoDict.map((d: any) => ({ label: d.label, value: d.value }))} />
          </Form.Item>
          <Form.Item label="创建时间">
            <DatePicker.RangePicker value={dateRange} onChange={setDateRange as any} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">搜索</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { queryForm.resetFields(); setDateRange(null); setQuery({ pageNum: 1, pageSize: 10 }); }}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 表格区 */}
      <Card className="page-card" bordered={false} style={{ marginTop: 14 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap'
        }}>
          <Space wrap>
            <Auth permission="system:config:add"><Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增</Button></Auth>
            <Auth permission="system:config:remove"><Button danger disabled={!selectedKeys.length} icon={<DeleteOutlined />} onClick={() => handleDelete()}>批量删除</Button></Auth>
            <Auth permission="system:config:export"><Button icon={<DownloadOutlined />} onClick={() => download('/system/config/export', query, `config_${Date.now()}.xlsx`)}>导出</Button></Auth>
            <Auth permission="system:config:remove">
              <Tooltip title="清空并重新加载后端参数缓存">
                <Button icon={<ThunderboltOutlined />} onClick={async () => { await refreshCache(); message.success('刷新缓存成功'); }}>刷新缓存</Button>
              </Tooltip>
            </Auth>
          </Space>
          <div style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedKeys.length > 0 && <Tag color="blue" style={{ borderRadius: 6 }}>已选 {selectedKeys.length}</Tag>}
            <span>共 <b style={{ color: '#1f2937' }}>{total}</b> 条</span>
          </div>
        </div>

        <Table
          rowKey="configId"
          size="middle"
          loading={loading}
          dataSource={list}
          scroll={{ x: 1200 }}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
          pagination={{ current: query.pageNum, pageSize: query.pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, s) => setQuery({ ...query, pageNum: p, pageSize: s }) }}
          columns={[
            { title: '参数主键', dataIndex: 'configId', width: 100, align: 'center' as const,
              render: (v: any) => <span style={{ color: '#64748b', fontFamily: 'Consolas, Menlo, monospace' }}>#{v}</span> },
            { title: '参数名称', dataIndex: 'configName', width: 220, ellipsis: true,
              render: (v: string) => <span style={{ fontWeight: 500, color: '#1f2937' }}>{v}</span> },
            { title: '参数键名', dataIndex: 'configKey', width: 240, ellipsis: true,
              render: (v: string) => (
                <code style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'Consolas, Menlo, monospace'
                }}>{v}</code>
              ) },
            { title: '参数键值', dataIndex: 'configValue', ellipsis: true, width: 260,
              render: (v: string, r: any) => {
                if (isSensitiveKey(r?.configKey)) {
                  return (
                    <Tag
                      icon={<EyeInvisibleOutlined />}
                      style={{
                        borderRadius: 6,
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '1px solid #fbbf24',
                        color: '#92400e',
                        fontWeight: 500
                      }}
                    >敏感值已隐藏</Tag>
                  );
                }
                const text = String(v ?? '');
                if (!text) return <span style={{ color: '#94a3b8' }}>-</span>;
                return <span title={text} style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{text}</span>;
              } },
            { title: '系统内置', dataIndex: 'configType', width: 110, align: 'center' as const,
              render: (v: string) => {
                const hit = yesNoDict.find((d: any) => d.value === v);
                const label = hit?.label || v;
                if (v === 'Y') {
                  return (
                    <Tag
                      icon={<SafetyCertificateOutlined />}
                      style={{
                        borderRadius: 6,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        fontWeight: 500
                      }}
                    >{label}</Tag>
                  );
                }
                return (
                  <Tag style={{ borderRadius: 6, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }}>
                    {label}
                  </Tag>
                );
              } },
            { title: '备注', dataIndex: 'remark', ellipsis: true,
              render: (v: string) => v ? <span style={{ color: '#64748b' }}>{v}</span> : <span style={{ color: '#cbd5e1' }}>-</span> },
            { title: '创建时间', dataIndex: 'createTime', width: 180,
              render: (v: string) => (
                <span style={{ color: '#64748b', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ClockCircleOutlined style={{ color: '#cbd5e1' }} />
                  {parseTime(v)}
                </span>
              ) },
            { title: '操作', key: 'ops', width: 140, fixed: 'right' as const, align: 'center' as const, render: (_: any, r: any) => (
              <Space size={0}>
                <Auth permission="system:config:edit"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>修改</Button></Auth>
                <Auth permission="system:config:remove"><Popconfirm title="确认删除？" onConfirm={() => handleDelete(r)}><Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Auth>
              </Space>
            ) }
          ]}
        />
      </Card>

      <Modal
        open={dlg.open}
        title={<Space><SettingOutlined style={{ color: '#6366f1' }} /><span>{dlg.title}</span></Space>}
        onCancel={() => setDlg({ open: false, title: '' })}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
        destroyOnClose
        maskClosable={false}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="configName" label="参数名称" rules={[{ required: true, max: 100, message: '请输入参数名称' }]}>
                <Input placeholder="例如：用户管理-账号初始密码" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="configKey" label="参数键名" rules={[{ required: true, max: 100, message: '请输入参数键名' }]}>
                <Input placeholder="例如：sys.user.initPassword" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="configValue" label="参数键值" rules={[{ required: true, message: '请输入参数键值' }]}>
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="请输入参数键值" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="configType" label="系统内置" extra="系统内置参数请谨慎修改，可能影响系统正常运行">
                <Radio.Group>
                  {yesNoDict.map((d: any) => <Radio key={d.value} value={d.value}>{d.label}</Radio>)}
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="请输入备注说明" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
