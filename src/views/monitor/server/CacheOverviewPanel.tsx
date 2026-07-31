import React, { useEffect, useState } from 'react';
import { Button, Col, Descriptions, Progress, Row, Spin, Statistic, Table, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getCache } from '@/api/monitor/cache';
import PageCard from '@/components/PageCard';

interface CommandStat {
  name: string;
  value: string | number;
}

/** 缓存概览面板：Redis 基本信息 + 命令统计 + 内存信息 */
export default function CacheOverviewPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await getCache();
      setData(res.data ?? res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const info = data.info || {};
  const commandStats: CommandStat[] = data.commandStats || [];

  const totalCmd = commandStats.reduce((sum, c) => sum + Number(c.value || 0), 0);
  const commandColumns: ColumnsType<CommandStat> = [
    { title: '命令', dataIndex: 'name', width: 200 },
    { title: '调用次数', dataIndex: 'value', width: 120, align: 'right' },
    {
      title: '占比',
      width: 240,
      render: (_, r) => {
        const percent = totalCmd > 0 ? Math.round((Number(r.value) / totalCmd) * 10000) / 100 : 0;
        return <Progress percent={percent} size="small" />;
      }
    }
  ];

  const memUsage = parseFloat(info.used_memory_human || '0');

  return (
    <div>
      <div style={{ textAlign: 'right', marginBottom: 12 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
      </div>
      <PageCard title={<span>🖥️ 基本信息</span>} className="page-card">
        <Row gutter={[24, 12]}>
          <Col xs={12} md={6}><Statistic title="Redis 版本" value={info.redis_version || '-'} /></Col>
          <Col xs={12} md={6}>
            <Statistic
              title="运行模式"
              value={info.redis_mode === 'standalone' ? '单机' : info.redis_mode === 'cluster' ? '集群' : info.redis_mode || '-'}
            />
          </Col>
          <Col xs={12} md={6}><Statistic title="端口" value={info.tcp_port || '-'} /></Col>
          <Col xs={12} md={6}><Statistic title="客户端数" value={info.connected_clients || 0} /></Col>
          <Col xs={12} md={6}><Statistic title="运行时间(天)" value={info.uptime_in_days || 0} /></Col>
          <Col xs={12} md={6}><Statistic title="使用内存" value={info.used_memory_human || '-'} /></Col>
          <Col xs={12} md={6}>
            <Statistic title="使用 CPU" value={parseFloat(info.used_cpu_user_children || 0).toFixed(2)} />
          </Col>
          <Col xs={12} md={6}><Statistic title="内存配置" value={info.maxmemory_human || '-'} /></Col>
          <Col xs={12} md={6}>
            <Statistic
              title="AOF 是否开启"
              value={info.aof_enabled === '0' ? '否' : '是'}
              valueStyle={{ color: info.aof_enabled === '0' ? '#faad14' : '#52c41a' }}
            />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="RDB 是否成功"
              value={info.rdb_last_bgsave_status || '-'}
              valueStyle={{ color: info.rdb_last_bgsave_status === 'ok' ? '#52c41a' : '#ff4d4f' }}
            />
          </Col>
          <Col xs={12} md={6}><Statistic title="Key 总数" value={data.dbSize || 0} /></Col>
          <Col xs={12} md={6}>
            <Statistic
              title="网络入口/出口(kbps)"
              value={`${info.instantaneous_input_kbps || 0} / ${info.instantaneous_output_kbps || 0}`}
            />
          </Col>
        </Row>
      </PageCard>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <PageCard title={<span>📊 命令统计</span>}>
            {commandStats.length ? (
              <Table
                rowKey="name"
                size="small"
                columns={commandColumns}
                dataSource={commandStats}
                pagination={false}
                scroll={{ y: 360 }}
              />
            ) : (
              <div style={{ color: '#94a3b8' }}>暂无命令统计数据</div>
            )}
          </PageCard>
        </Col>
        <Col xs={24} lg={12}>
          <PageCard title={<span>💾 内存信息</span>}>
            <div style={{ padding: '20px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Progress
                  type="dashboard"
                  percent={Math.min(100, Math.round(memUsage * 10) / 10)}
                  format={() => info.used_memory_human || '-'}
                  strokeColor={{ '0%': '#60a5fa', '100%': '#3b82f6' }}
                />
                <div style={{ marginTop: 16 }}><Tag color="blue">峰值内存消耗</Tag></div>
              </div>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="已使用内存">{info.used_memory_human}</Descriptions.Item>
                <Descriptions.Item label="最大内存">{info.maxmemory_human || '未配置上限'}</Descriptions.Item>
                <Descriptions.Item label="Lua 内存">{info.used_memory_lua_human}</Descriptions.Item>
                <Descriptions.Item label="内存碎片率">{info.mem_fragmentation_ratio}</Descriptions.Item>
              </Descriptions>
            </div>
          </PageCard>
        </Col>
      </Row>
    </div>
  );
}
