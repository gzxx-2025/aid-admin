import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  message
} from 'antd';
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  ControlOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RocketOutlined,
  SaveOutlined,
  SettingOutlined,
  SyncOutlined
} from '@ant-design/icons';

import {
  getUpdaterLogs,
  getUpgradeSource,
  rollbackSystem,
  saveUpgradeSource,
  startUpdaterUpgrade,
  startUpgrade,
  UpdaterLog,
  UpgradeSourceSetting
} from '@/api/aidconfig/upgrade';
import { useUpgradeStore } from '@/store/useUpgradeStore';
import './style.less';

const { Paragraph, Text } = Typography;

const UPDATER_TAG: Record<string, { color: string; text: string }> = {
  AVAILABLE: { color: 'green', text: '运行正常' },
  NOT_INSTALLED: { color: 'red', text: '未安装' },
  STOPPED: { color: 'orange', text: '已停止' },
  INCOMPATIBLE: { color: 'volcano', text: '版本不兼容' },
  UNKNOWN: { color: 'default', text: '状态异常' }
};

const TASK_ACTION_TEXT: Record<string, string> = {
  UPGRADE: '系统升级',
  UPDATER_UPGRADE: '升级器升级',
  ROLLBACK: '版本回退'
};

const TASK_STATE_META: Record<string, { alert: 'info' | 'success' | 'error'; text: string }> = {
  RUNNING: { alert: 'info', text: '执行中' },
  SUCCESS: { alert: 'success', text: '成功' },
  FAILED: { alert: 'error', text: '失败' }
};

const taskKey = (task?: {
  taskId?: string;
  action?: string;
  state?: string;
  finishedAt?: string;
}) => [task?.taskId, task?.action, task?.state, task?.finishedAt].filter(Boolean).join('|');

export default function UpgradeConfigPage() {
  const status = useUpgradeStore((state) => state.status);
  const loading = useUpgradeStore((state) => state.loading);
  const checking = useUpgradeStore((state) => state.checking);
  const loadStatusShared = useUpgradeStore((state) => state.loadStatus);

  const [installOpen, setInstallOpen] = useState(false);
  const [updaterLogs, setUpdaterLogs] = useState<UpdaterLog | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceLoadError, setSourceLoadError] = useState(false);
  const [sourceSaving, setSourceSaving] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<string>();
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollbackConfirmText, setRollbackConfirmText] = useState('');
  const [rollbackSubmitting, setRollbackSubmitting] = useState(false);
  const [taskPolling, setTaskPolling] = useState(false);
  const pollingBaseline = useRef('');
  const pollingTaskSeen = useRef(false);
  const [sourceForm] = Form.useForm<UpgradeSourceSetting>();

  const updater = status?.updater;
  const updaterTag = UPDATER_TAG[updater?.status || 'UNKNOWN'] || UPDATER_TAG.UNKNOWN;
  const rollbackCount = status?.rollbackReleases?.length || 0;
  const lastTask = updater?.lastTask;
  const lastTaskMeta = lastTask?.state ? TASK_STATE_META[lastTask.state] : undefined;
  const selectedRollback = status?.rollbackReleases?.find((item) => item.version === rollbackVersion);

  const loadStatus = useCallback(async (force: boolean) => {
    const next = await loadStatusShared(force);
    if (force) {
      if (next?.checkError) {
        message.warning('检查完成，更新源当前不可用');
      } else {
        message.success('检查完成');
      }
    }
    return next;
  }, [loadStatusShared]);

  const loadSource = useCallback(async () => {
    setSourceLoading(true);
    setSourceLoadError(false);
    try {
      const res = await getUpgradeSource();
      sourceForm.setFieldsValue({
        releaseChannel: 'stable',
        keepBackups: 3,
        manifestUrl: '',
        ...(res.data || {})
      });
      setSourceDirty(false);
    } catch {
      setSourceLoadError(true);
    } finally {
      setSourceLoading(false);
    }
  }, [sourceForm]);

  const loadUpdaterLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await getUpdaterLogs();
      setUpdaterLogs(res.data || null);
    } catch {
      setUpdaterLogs(null);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!useUpgradeStore.getState().status) {
      loadStatus(false).catch(() => undefined);
    }
    loadSource();
  }, [loadSource, loadStatus]);

  useEffect(() => {
    if (installOpen) {
      loadUpdaterLogs();
    }
  }, [installOpen, loadUpdaterLogs]);

  useEffect(() => {
    if (!taskPolling) return;

    let attempts = 0;
    let requesting = false;
    const poll = async () => {
      if (requesting) return;
      requesting = true;
      attempts += 1;
      try {
        const next = await loadStatusShared(false);
        const nextTask = next?.updater?.lastTask;
        const changed = !!nextTask && taskKey(nextTask) !== pollingBaseline.current;
        if (changed) {
          pollingTaskSeen.current = true;
        }
        if (pollingTaskSeen.current && nextTask?.state !== 'RUNNING') {
          setTaskPolling(false);
        } else if (attempts >= 60) {
          setTaskPolling(false);
        }
      } catch {
        if (attempts >= 60) setTaskPolling(false);
      } finally {
        requesting = false;
      }
    };

    const firstTimer = window.setTimeout(poll, 800);
    const timer = window.setInterval(poll, 2500);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(timer);
    };
  }, [loadStatusShared, taskPolling]);

  const beginTaskPolling = useCallback(() => {
    pollingBaseline.current = taskKey(useUpgradeStore.getState().status?.updater?.lastTask);
    pollingTaskSeen.current = false;
    setTaskPolling(true);
  }, []);

  const handleSaveSource = async () => {
    if (sourceLoadError || sourceLoading) return;
    const values = await sourceForm.validateFields();
    setSourceSaving(true);
    try {
      await saveUpgradeSource({
        releaseChannel: values.releaseChannel,
        keepBackups: values.keepBackups,
        manifestUrl: values.manifestUrl?.trim() ?? ''
      });
      setSourceDirty(false);
      message.success('升级配置已保存');
      await loadStatus(true);
    } finally {
      setSourceSaving(false);
    }
  };

  const handleStartUpgrade = () => {
    Modal.confirm({
      title: '确认升级系统？',
      icon: <ExclamationCircleOutlined />,
      content: (
        <Descriptions size="small" column={1} className="upgrade-page__confirm-details">
          <Descriptions.Item label="当前版本">v{status?.currentVersion || '-'}</Descriptions.Item>
          <Descriptions.Item label="目标版本">v{status?.latestVersion || '-'}</Descriptions.Item>
          <Descriptions.Item label="发布渠道">
            {status?.latestChannel === 'beta' ? '测试版' : '正式版'}
          </Descriptions.Item>
          <Descriptions.Item label="影响">服务将短暂重启，升级器会先创建备份</Descriptions.Item>
        </Descriptions>
      ),
      okText: '开始升级',
      cancelText: '取消',
      onOk: async () => {
        const res: any = await startUpgrade();
        message.success(res?.msg || '升级任务已受理');
        beginTaskPolling();
      }
    });
  };

  const handleUpgradeUpdater = () => {
    Modal.confirm({
      title: '确认升级升级器？',
      icon: <ExclamationCircleOutlined />,
      content: `将从 v${updater?.version || '-'} 升级到 v${updater?.latestVersion || '-'}，升级器会自动重启。`,
      okText: '开始升级',
      cancelText: '取消',
      onOk: async () => {
        const res: any = await startUpdaterUpgrade();
        message.success(res?.msg || '升级器升级任务已受理');
        beginTaskPolling();
      }
    });
  };

  const handleRollbackConfirm = async () => {
    if (!selectedRollback || rollbackConfirmText.trim() !== selectedRollback.version) return;
    setRollbackSubmitting(true);
    try {
      const res: any = await rollbackSystem(selectedRollback.version);
      message.success(res?.msg || '回退任务已受理');
      setRollbackConfirmOpen(false);
      setRollbackConfirmText('');
      beginTaskPolling();
    } finally {
      setRollbackSubmitting(false);
    }
  };

  const releaseLinks = (
    <Space wrap size={12}>
      {status?.giteeReleaseUrl && (
        <a href={status.giteeReleaseUrl} target="_blank" rel="noreferrer">
          <FileTextOutlined /> Gitee 发布页
        </a>
      )}
      {status?.githubReleaseUrl && (
        <a href={status.githubReleaseUrl} target="_blank" rel="noreferrer">
          <FileTextOutlined /> GitHub 发布页
        </a>
      )}
      {status?.docsUrl && (
        <a href={status.docsUrl} target="_blank" rel="noreferrer">
          <FileTextOutlined /> 使用教程
        </a>
      )}
      {status?.promptDocsUrl && (
        <a href={status.promptDocsUrl} target="_blank" rel="noreferrer">
          <FileTextOutlined /> 提示词教程
        </a>
      )}
    </Space>
  );

  const statusNotice = (() => {
    if (!status) return null;
    if (status.checkError) {
      return (
        <Alert
          type="warning"
          showIcon
          message={`更新源不可用：${status.checkError}`}
          description="请检查服务器网络和升级配置，恢复后重新检查。"
          action={<Button size="small" loading={checking} onClick={() => loadStatus(true)}>重新检查</Button>}
        />
      );
    }
    if (status.hasUpdate && status.belowMinimumVersion) {
      return (
        <Alert
          type="warning"
          showIcon
          message={`当前版本低于最低直升版本 v${status.minimumVersion}`}
          description={<Space direction="vertical" size={6}><Text>请先安装中间版本，再执行一键升级。</Text>{releaseLinks}</Space>}
        />
      );
    }
    if (status.hasUpdate) {
      return (
        <Alert
          type="info"
          showIcon
          icon={<CloudDownloadOutlined />}
          message={
            <Space wrap size={6}>
              <Text strong>发现新版本 v{status.latestVersion}</Text>
              <Tag color={status.latestChannel === 'beta' ? 'purple' : 'blue'}>
                {status.latestChannel === 'beta' ? '测试版' : '正式版'}
              </Tag>
              <Text type="secondary">{status.publishedAt || '-'}</Text>
            </Space>
          }
          description={
            <div>
              <Paragraph className="upgrade-page__release-notes">
                {status.releaseNotes || '本次发布未提供更新日志。'}
              </Paragraph>
              {releaseLinks}
            </div>
          }
          action={
            <Button
              type="primary"
              icon={<RocketOutlined />}
              disabled={!updater?.ready}
              title={updater?.ready ? undefined : '需先安装并启动升级器'}
              onClick={handleStartUpgrade}
            >
              立即升级
            </Button>
          }
        />
      );
    }
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message="当前已是最新版本"
        description={`最近检查：${status.checkedAt || '-'}`}
      />
    );
  })();

  const updaterPanel = (
    <div className="upgrade-page__tab-panel">
      <div className="upgrade-page__section-toolbar">
        <div>
          <Text strong>升级器状态</Text>
          <Text type="secondary"> · {updater?.message || '负责制品校验、备份、升级和回退'}</Text>
        </div>
        <Space wrap>
          {updater && !updater.ready && (
            <Button
              type="primary"
              danger={updater.status === 'NOT_INSTALLED'}
              icon={<DownloadOutlined />}
              onClick={() => setInstallOpen(true)}
            >
              {updater.status === 'NOT_INSTALLED' ? '安装升级器' : '修复引导'}
            </Button>
          )}
          <Button icon={<SyncOutlined />} loading={loading || taskPolling} onClick={() => loadStatus(false)}>
            重新检测
          </Button>
        </Space>
      </div>

      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
        <Descriptions.Item label="运行状态"><Tag color={updaterTag.color}>{updaterTag.text}</Tag></Descriptions.Item>
        <Descriptions.Item label="部署方式">
          {updater?.serviceManager === 'docker'
            ? 'Docker'
            : updater?.serviceManager === 'systemd' ? 'systemd' : '未上报'}
        </Descriptions.Item>
        <Descriptions.Item label="当前版本">{updater?.version ? `v${updater.version}` : '-'}</Descriptions.Item>
        <Descriptions.Item label="最新版本">{updater?.latestVersion ? `v${updater.latestVersion}` : '-'}</Descriptions.Item>
      </Descriptions>

      {lastTask && lastTaskMeta && (
        <Alert
          className="upgrade-page__task-alert"
          type={lastTaskMeta.alert}
          showIcon
          icon={lastTask.state === 'RUNNING' || taskPolling ? <Spin size="small" /> : undefined}
          message={`${TASK_ACTION_TEXT[lastTask.action || ''] || lastTask.action || '升级任务'} · ${lastTaskMeta.text}`}
          description={
            <Space direction="vertical" size={2}>
              {lastTask.message && <Text>{lastTask.message}</Text>}
              {lastTask.finishedAt && <Text type="secondary">完成时间：{lastTask.finishedAt}</Text>}
            </Space>
          }
        />
      )}

      {updater?.hasUpdate && (
        <Alert
          className="upgrade-page__task-alert"
          type="info"
          showIcon
          message={`升级器可升级到 v${updater.latestVersion}`}
          action={
            <Button type="primary" disabled={!updater.ready} onClick={handleUpgradeUpdater}>
              在线升级
            </Button>
          }
        />
      )}

      {updater && !updater.ready && (
        <Alert
          className="upgrade-page__task-alert"
          type="warning"
          showIcon
          message={updater.status === 'NOT_INSTALLED' ? '未安装升级器' : '升级器当前不可用'}
          description="一键升级和回退暂不可用，请打开修复引导处理。"
        />
      )}
    </div>
  );

  const rollbackPanel = (
    <div className="upgrade-page__tab-panel">
      <div className="upgrade-page__section-toolbar">
        <div>
          <Text strong>可回退版本</Text>
          <Text type="secondary"> · 执行前会自动备份程序、配置和数据库</Text>
        </div>
        {rollbackCount > 0 && (
          <Button
            danger
            disabled={!rollbackVersion || !updater?.ready}
            title={updater?.ready ? undefined : '需先安装并启动升级器'}
            onClick={() => {
              setRollbackConfirmText('');
              setRollbackConfirmOpen(true);
            }}
          >
            回退到所选版本
          </Button>
        )}
      </div>

      {rollbackCount > 0 ? (
        <Radio.Group
          value={rollbackVersion}
          onChange={(event) => setRollbackVersion(event.target.value)}
          className="upgrade-page__rollback-list"
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {status?.rollbackReleases?.map((release) => (
              <Radio key={release.version} value={release.version}>
                <span className="upgrade-page__rollback-item">
                  <Text strong>v{release.version}</Text>
                  <Text type="secondary">{release.publishedAt || '-'}</Text>
                  <Tag color={release.databaseCompatible ? 'green' : 'orange'}>
                    {release.databaseCompatible ? '数据库兼容' : '需要数据库回退'}
                  </Tag>
                  {release.notes && <Text type="secondary">{release.notes}</Text>}
                </span>
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      ) : (
        <div className="upgrade-page__empty">
          <HistoryOutlined />
          <span>当前没有可回退版本</span>
        </div>
      )}
    </div>
  );

  const settingsPanel = (
    <div className="upgrade-page__tab-panel">
      <div className="upgrade-page__section-toolbar">
        <Space>
          <Text strong>升级配置</Text>
          {sourceDirty && <Tag color="gold">有未保存修改</Tag>}
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            disabled={sourceLoading || sourceSaving}
            onClick={loadSource}
          >
            重新加载
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={sourceSaving}
            disabled={sourceLoading || sourceLoadError || !sourceDirty}
            onClick={handleSaveSource}
          >
            保存配置
          </Button>
        </Space>
      </div>

      {sourceLoadError && (
        <Alert
          type="error"
          showIcon
          message="升级配置加载失败"
          description="为避免覆盖现有配置，数据恢复前已禁止保存。"
          action={<Button size="small" onClick={loadSource}>重试</Button>}
        />
      )}

      <Spin spinning={sourceLoading}>
        <Form
          form={sourceForm}
          layout="vertical"
          className="upgrade-page__source-form"
          disabled={sourceLoading || sourceLoadError}
          onValuesChange={() => setSourceDirty(true)}
        >
          <Row gutter={24}>
            <Col xs={24} lg={14}>
              <Form.Item
                name="releaseChannel"
                label="接收版本渠道"
                rules={[{ required: true, message: '请选择版本渠道' }]}
                extra="仅正式版只读取顶层；正式版 + 测试版会比较顶层和 beta，选择版本号更高的一项。"
              >
                <Radio.Group>
                  <Space direction="vertical" size={8}>
                    <Radio value="stable">仅正式版</Radio>
                    <Radio value="all">正式版 + 测试版</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} lg={10}>
              <Form.Item
                name="keepBackups"
                label="备份保留份数"
                rules={[{ required: true, message: '请输入备份保留份数' }]}
                extra="每次升级或回退前自动备份，超出后优先清理最旧备份。"
              >
                <InputNumber min={1} max={50} precision={0} style={{ width: 180 }} />
              </Form.Item>
            </Col>
          </Row>

          <Collapse
            className="upgrade-page__advanced"
            ghost
            items={[
              {
                key: 'manifest',
                label: '高级设置',
                children: (
                  <Form.Item
                    name="manifestUrl"
                    label="版本更新清单地址"
                    extra="留空使用官方源。修改后保存，再点击页面顶部“检查更新”验证连通性。"
                    rules={[{ type: 'url', message: '请输入合法的 http/https 地址' }]}
                  >
                    <Input
                      placeholder="留空使用官方默认源"
                      allowClear
                      addonAfter={
                        <Button
                          type="link"
                          size="small"
                          onClick={() => {
                            sourceForm.setFieldValue('manifestUrl', '');
                            setSourceDirty(true);
                          }}
                        >
                          恢复官方源
                        </Button>
                      }
                    />
                  </Form.Item>
                )
              }
            ]}
          />
        </Form>
      </Spin>
    </div>
  );

  return (
    <div className="crud-page upgrade-page">
      <div className="upgrade-page__header">
        <div>
          <h3 className="upgrade-page__header-title">
            <RocketOutlined />
            项目升级
          </h3>
          <Text type="secondary">最近检查：{status?.checkedAt || '-'}</Text>
        </div>
        <Space wrap>
          <Button type="primary" icon={<SyncOutlined />} loading={checking} onClick={() => loadStatus(true)}>
            检查更新
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadStatus(false)}>
            刷新状态
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && !status}>
        <section className="upgrade-page__status-strip">
          <div className="upgrade-page__status-item">
            <span>当前版本</span>
            <strong>{status?.currentVersion ? `v${status.currentVersion}` : '-'}</strong>
          </div>
          <div className="upgrade-page__status-item">
            <span>线上版本</span>
            <strong>{status?.latestVersion ? `v${status.latestVersion}` : '-'}</strong>
            {status?.latestVersion && (
              <Tag color={status.latestChannel === 'beta' ? 'purple' : 'blue'}>
                {status.latestChannel === 'beta' ? '测试版' : '正式版'}
              </Tag>
            )}
          </div>
          <div className="upgrade-page__status-item">
            <span>升级器</span>
            <strong>{updaterTag.text}</strong>
            <Tag color={updaterTag.color}>{updater?.version ? `v${updater.version}` : '-'}</Tag>
          </div>
          <div className="upgrade-page__status-item">
            <span>可回退版本</span>
            <strong>{rollbackCount}</strong>
          </div>
        </section>

        <div className="upgrade-page__notice">{statusNotice}</div>

        <Card className="upgrade-page__workspace" bordered={false}>
          <Tabs
            defaultActiveKey="updater"
            items={[
              {
                key: 'updater',
                label: <Space><ControlOutlined />升级器</Space>,
                children: updaterPanel
              },
              {
                key: 'rollback',
                label: <Space><DatabaseOutlined />版本回退{rollbackCount > 0 && <Tag>{rollbackCount}</Tag>}</Space>,
                children: rollbackPanel
              },
              {
                key: 'settings',
                label: <Space><SettingOutlined />升级配置{sourceDirty && <span className="upgrade-page__dirty-dot" />}</Space>,
                children: settingsPanel
              }
            ]}
          />
        </Card>
      </Spin>

      <Modal
        title={`确认回退到 v${selectedRollback?.version || '-'}？`}
        open={rollbackConfirmOpen}
        okText="确认回退"
        cancelText="取消"
        okButtonProps={{
          danger: true,
          disabled: !selectedRollback || rollbackConfirmText.trim() !== selectedRollback.version
        }}
        confirmLoading={rollbackSubmitting}
        onOk={handleRollbackConfirm}
        onCancel={() => {
          setRollbackConfirmOpen(false);
          setRollbackConfirmText('');
        }}
      >
        <Alert
          type="warning"
          showIcon
          message="回退会短暂停止服务"
          description="升级器会先备份程序、配置和数据库，再校验并安装目标制品。"
          className="upgrade-page__modal-alert"
        />
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="目标版本">v{selectedRollback?.version || '-'}</Descriptions.Item>
          <Descriptions.Item label="数据库">
            {selectedRollback?.databaseCompatible
              ? '兼容当前结构'
              : `需要回退脚本 ${selectedRollback?.databaseRollback || '（未提供）'}`}
          </Descriptions.Item>
        </Descriptions>
        <Text>请输入目标版本号确认：</Text>
        <Input
          value={rollbackConfirmText}
          placeholder={selectedRollback?.version}
          onChange={(event) => setRollbackConfirmText(event.target.value)}
          className="upgrade-page__confirm-input"
        />
      </Modal>

      <Modal
        title={<Space><DownloadOutlined />安装 / 修复升级器</Space>}
        open={installOpen}
        width={680}
        footer={
          <Space>
            <Button onClick={() => setInstallOpen(false)}>关闭</Button>
            <Button icon={<ReloadOutlined />} loading={logsLoading} onClick={loadUpdaterLogs}>刷新日志</Button>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              loading={loading}
              onClick={() => {
                Promise.all([loadStatus(false), loadUpdaterLogs()])
                  .then(() => message.success('已重新检测'))
                  .catch(() => undefined);
              }}
            >
              重新检测
            </Button>
          </Space>
        }
        onCancel={() => setInstallOpen(false)}
      >
        <Alert
          type="info"
          showIcon
          message="在服务器发布包的 deploy 目录执行修复命令"
          className="upgrade-page__modal-alert"
        />
        <Paragraph code copyable className="upgrade-page__command">
          sudo bash aid.sh setup-updater
        </Paragraph>
        <div className="upgrade-page__log-header">
          <FileTextOutlined />
          <Text strong>升级器运行日志</Text>
          {updaterLogs?.logFile && <Text type="secondary">{updaterLogs.logFile}</Text>}
        </div>
        <pre className="upgrade-page__log">
          {logsLoading
            ? '日志加载中...'
            : updaterLogs?.lines?.length
              ? updaterLogs.lines.join('\n')
              : (updaterLogs?.message || '暂无升级器日志')}
        </pre>
      </Modal>
    </div>
  );
}
