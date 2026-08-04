import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
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
  applyDeploymentConfig,
  DeploymentConfig,
  DeploymentConfigSaveParams,
  getDeploymentConfig,
  getUpdaterLogs,
  getUpgradeSource,
  rollbackDeploymentConfig,
  rollbackSystem,
  saveUpgradeSource,
  startUpdaterUpgrade,
  startUpgrade,
  validateDeploymentConfig,
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
  ROLLBACK: '版本回退',
  CONFIG_VALIDATE: '配置校验',
  CONFIG_APPLY: '配置应用',
  CONFIG_ROLLBACK: '配置恢复'
};

const deploymentToForm = (config: DeploymentConfig): DeploymentConfigSaveParams => {
  const value = config.values || {};
  return {
    configPath: config.configPath,
    httpPort: value.HTTP_PORT,
    adminPort: value.ADMIN_PORT,
    backendPort: value.BACKEND_PORT,
    dataRoot: value.DATA_ROOT || config.allowedConfigRoot.replace(/[\\/]config[\\/]?$/, ''),
    mysqlPort: value.MYSQL_PORT,
    dbHost: value.DB_HOST,
    dbPort: value.DB_PORT,
    dbName: value.DB_NAME,
    dbUsername: value.DB_USERNAME,
    redisHost: value.REDIS_HOST,
    redisPort: value.REDIS_PORT,
    redisUsername: value.REDIS_USERNAME,
    redisDatabase: value.REDIS_DATABASE,
    redisPassword: undefined,
    clearRedisPassword: false,
    javaOpts: value.JAVA_OPTS,
    dependencyInstallMode: value.DEPENDENCY_INSTALL_MODE || 'auto',
    dependencyRegion: value.DEPENDENCY_REGION || 'auto',
    composeProfiles: value.COMPOSE_PROFILES,
    rocketmqEnabled: value.ROCKETMQ_ENABLED,
    rocketmqNameserver: value.ROCKETMQ_NAMESERVER,
    rocketmqFlushDiskType: value.ROCKETMQ_FLUSH_DISK_TYPE || 'ASYNC_FLUSH',
    rocketmqAccessKey: undefined,
    rocketmqSecretKey: undefined,
    clearRocketmqCredentials: false,
    httpsEnabled: value.HTTPS_ENABLED || 'false',
    httpsPort: value.HTTPS_PORT,
    httpsPublicDomain: value.HTTPS_PUBLIC_DOMAIN,
    httpsAdminDomain: value.HTTPS_ADMIN_DOMAIN,
    httpsCertPath: value.HTTPS_CERT_PATH,
    httpsKeyPath: value.HTTPS_KEY_PATH,
    mysqlBufferPool: value.MYSQL_BUFFER_POOL,
    mysqlMaxConnections: value.MYSQL_MAX_CONNECTIONS,
    redisMaxmemory: value.REDIS_MAXMEMORY,
    redisMaxmemoryPolicy: value.REDIS_MAXMEMORY_POLICY,
    webNodeOptions: value.WEB_NODE_OPTIONS,
    mqNamesrvJavaOpts: value.MQ_NAMESRV_JAVA_OPTS,
    mqBrokerJavaOpts: value.MQ_BROKER_JAVA_OPTS
  };
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
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(true);
  const [deploymentSaving, setDeploymentSaving] = useState(false);
  const [deploymentDirty, setDeploymentDirty] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<string>();
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollbackConfirmText, setRollbackConfirmText] = useState('');
  const [rollbackSubmitting, setRollbackSubmitting] = useState(false);
  const [taskPolling, setTaskPolling] = useState(false);
  const pollingBaseline = useRef('');
  const pollingTaskSeen = useRef(false);
  const [sourceForm] = Form.useForm<UpgradeSourceSetting>();
  const [deploymentForm] = Form.useForm<DeploymentConfigSaveParams>();
  const composeProfiles = Form.useWatch('composeProfiles', deploymentForm) || '';
  const usesInternalMysql = deploymentConfig?.mode === 'docker'
    && composeProfiles.split(',').some((item) => item.trim() === 'mysql');
  const usesInternalRocketmq = deploymentConfig?.mode === 'docker'
    && composeProfiles.split(',').some((item) => item.trim() === 'mq');

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

  const loadDeployment = useCallback(async () => {
    setDeploymentLoading(true);
    try {
      const res = await getDeploymentConfig();
      const next = res.data || null;
      setDeploymentConfig(next);
      if (next) deploymentForm.setFieldsValue(deploymentToForm(next));
      setDeploymentDirty(false);
    } catch {
      setDeploymentConfig(null);
    } finally {
      setDeploymentLoading(false);
    }
  }, [deploymentForm]);

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
    loadDeployment();
  }, [loadDeployment, loadSource, loadStatus]);

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
          loadDeployment().catch(() => undefined);
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
  }, [loadDeployment, loadStatusShared, taskPolling]);

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

  const handleValidateDeployment = async () => {
    const values = await deploymentForm.validateFields();
    setDeploymentSaving(true);
    try {
      const res: any = await validateDeploymentConfig(values);
      message.success(res?.msg || '配置校验任务已受理');
      beginTaskPolling();
    } finally {
      setDeploymentSaving(false);
    }
  };

  const handleApplyDeployment = async () => {
    const values = await deploymentForm.validateFields();
    Modal.confirm({
      title: '应用配置并重启服务？',
      icon: <ExclamationCircleOutlined />,
      content: '升级器会先备份旧配置，再校验、原子写入并重启。健康检查失败将自动恢复旧配置。',
      okText: '应用并重启',
      cancelText: '取消',
      onOk: async () => {
        setDeploymentSaving(true);
        try {
          const res: any = await applyDeploymentConfig(values);
          message.success(res?.msg || '配置应用任务已受理');
          setDeploymentDirty(false);
          beginTaskPolling();
        } finally {
          setDeploymentSaving(false);
        }
      }
    });
  };

  const handleRollbackDeployment = () => {
    Modal.confirm({
      title: '恢复上一份部署配置？',
      icon: <ExclamationCircleOutlined />,
      content: '恢复后服务会重新启动。仅恢复最近一次通过后台应用配置前的备份。',
      okText: '恢复并重启',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const res: any = await rollbackDeploymentConfig();
        message.success(res?.msg || '配置恢复任务已受理');
        beginTaskPolling();
      }
    });
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
    if (status.hasUpdate && updater?.hasUpdate) {
      return (
        <Alert
          type="warning"
          showIcon
          message="请先升级升级器"
          description={`系统 v${status.latestVersion || '-'} 与升级器 v${updater.latestVersion || '-'} 均有更新。为保证SQL、备份和回滚协议兼容，必须先完成升级器更新。`}
          action={<Button type="primary" onClick={handleUpgradeUpdater}>先升级升级器</Button>}
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
              disabled={!updater?.ready || updater?.hasUpdate}
              title={updater?.hasUpdate ? '必须先升级升级器' : updater?.ready ? undefined : '需先安装并启动升级器'}
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

  const deploymentPanel = (
    <div className="upgrade-page__tab-panel">
      <div className="upgrade-page__section-toolbar">
        <Space>
          <Text strong>运行配置</Text>
          {deploymentConfig && <Tag color="blue">{deploymentConfig.mode === 'docker' ? 'Docker' : 'systemd'}</Tag>}
          {deploymentDirty && <Tag color="gold">有未应用修改</Tag>}
        </Space>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={deploymentLoading} onClick={loadDeployment}>重新加载</Button>
          <Button disabled={!deploymentConfig} loading={deploymentSaving} onClick={handleValidateDeployment}>校验配置</Button>
          <Button danger disabled={!deploymentConfig} onClick={handleRollbackDeployment}>恢复上次配置</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            disabled={!deploymentConfig || !deploymentDirty}
            loading={deploymentSaving}
            onClick={handleApplyDeployment}
          >
            应用并重启
          </Button>
        </Space>
      </div>

      {!deploymentLoading && !deploymentConfig && (
        <Alert
          type="warning"
          showIcon
          message="运行配置不可用"
          description="请先把升级器更新到支持配置管理的版本，并确认升级器正在运行。"
        />
      )}

      {deploymentConfig && (
        <Alert
          type="info"
          showIcon
          message={`当前生效文件：${deploymentConfig.configPath}`}
          description={`自定义文件只能放在 ${deploymentConfig.allowedConfigRoot}；密钥不会回显，输入框留空表示保持不变。`}
          className="upgrade-page__modal-alert"
        />
      )}

      <Spin spinning={deploymentLoading}>
        <Form
          form={deploymentForm}
          layout="vertical"
          disabled={!deploymentConfig || deploymentLoading}
          onValuesChange={() => setDeploymentDirty(true)}
        >
          <Form.Item
            name="configPath"
            label="配置文件路径"
            rules={[{ required: true, message: '请输入配置文件路径' }]}
            extra={`默认：${deploymentConfig?.defaultConfigPath || '-'}；仅允许 .env/.conf，升级器会校验目录与软链接。`}
          >
            <Input />
          </Form.Item>

          <Row gutter={20}>
            <Col xs={24} md={8}><Form.Item name="httpPort" label="用户端口" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="adminPort" label="后台管理端口" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="backendPort" label="后端端口" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>

          <Row gutter={20}>
            <Col xs={24} md={12}>
              <Form.Item
                name="dependencyInstallMode"
                label="依赖处理方式"
                extra={deploymentConfig?.mode === 'docker'
                  ? '自动模式会拉取缺失镜像，已有且摘要匹配的镜像直接跳过；Docker Engine 必须预先安装。'
                  : '自动模式下载固定版本工具链；系统服务仍由发行版包管理器安装。'}
              >
                <Select
                  options={[
                    { label: '自动安装或拉取（推荐）', value: 'auto' },
                    { label: '仅检查并提示', value: 'manual' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="dependencyRegion"
                label="依赖下载线路"
                extra="自动按服务器公网出口判断；首选源失败会切换另一条线路。"
              >
                <Select
                  options={[
                    { label: '自动判断（推荐）', value: 'auto' },
                    { label: '国内镜像优先', value: 'cn' },
                    { label: '官方地址优先', value: 'global' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={20}>
            <Col xs={24} md={12}>
              <Form.Item name="dataRoot" label="数据根目录" extra="运行后禁止直接迁移；证书目录也受此路径约束。">
                <Input disabled />
              </Form.Item>
            </Col>
            {deploymentConfig?.mode === 'docker' && (
              <Col xs={24} md={12}>
                <Form.Item
                  name="composeProfiles"
                  label="Docker 组件 Profiles"
                  extra="可选 mysql、redis、mq、https。移除 mysql 即使用外部 MySQL，内置数据库容器不会启动。"
                >
                  <Input placeholder="mysql,redis" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Alert
            type="info"
            showIcon
            message={deploymentConfig?.mode === 'docker' ? 'Docker 内置 HTTPS' : 'Nginx HTTPS'}
            description={deploymentConfig?.mode === 'docker'
              ? '在 Compose Profiles 中加入 https 后生效。'
              : '选择启用后，重启服务会重新生成并校验 Nginx 站点配置。'}
            className="upgrade-page__modal-alert"
          />
          {deploymentConfig?.mode === 'systemd' && (
            <Form.Item name="httpsEnabled" label="启用 HTTPS">
              <Radio.Group options={[{ label: '关闭', value: 'false' }, { label: '启用', value: 'true' }]} />
            </Form.Item>
          )}
          <Row gutter={20}>
            <Col xs={24} md={8}><Form.Item name="httpsPort" label="HTTPS端口"><Input placeholder="443" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="httpsPublicDomain" label="用户端HTTPS域名"><Input placeholder="www.example.com" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="httpsAdminDomain" label="管理端HTTPS域名"><Input placeholder="admin.example.com" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="httpsCertPath" label="完整证书路径" extra="必须位于 DATA_ROOT/config/ssl，禁止软链接。"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="httpsKeyPath" label="证书私钥路径" extra="必须位于 DATA_ROOT/config/ssl，禁止软链接。"><Input /></Form.Item></Col>
          </Row>

          {deploymentConfig?.mode === 'docker' && (
            <Alert
              type={usesInternalMysql ? 'warning' : 'info'}
              showIcon
              message={usesInternalMysql ? '当前使用内置 MySQL 5.7' : '当前使用外部 MySQL 5.7'}
              description={usesInternalMysql
                ? '数据库地址固定为 mysql:3306；已有容器的库名和账号密码不能通过修改配置直接轮换。'
                : '保存前会校验外部数据库连接与版本；验证成功后不会启动 aid-mysql，旧容器会被移除但数据目录保留。Docker 宿主机数据库可填写 host.docker.internal。'}
              className="upgrade-page__modal-alert"
            />
          )}
          <Row gutter={20}>
            <Col xs={24} md={8}>
              <Form.Item name="dbHost" label="数据库地址" rules={[{ required: true }]}>
                <Input disabled={Boolean(usesInternalMysql)} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="dbPort" label="数据库端口" rules={[{ required: true }]}>
                <Input disabled={Boolean(usesInternalMysql)} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}><Form.Item name="dbName" label="数据库名称" rules={[{ required: true }]}><Input disabled={Boolean(usesInternalMysql)} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="dbUsername" label="数据库账号" rules={[{ required: true }]}><Input disabled={Boolean(usesInternalMysql)} /></Form.Item></Col>
            {!usesInternalMysql && (
              <Col xs={24} md={8}>
                <Form.Item name="dbPassword" label="数据库密码">
                  <Input.Password autoComplete="new-password" placeholder={deploymentConfig?.configuredSecrets.includes('DB_PASSWORD') ? '已配置，留空保持不变' : '请输入数据库密码'} />
                </Form.Item>
              </Col>
            )}
          </Row>

          {usesInternalMysql && (
            <Row gutter={20}>
              <Col xs={24} md={12}>
                <Form.Item name="mysqlPort" label="内置 MySQL 宿主机端口"><Input /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="mysqlRootPassword" label="内置 MySQL root 密码" extra="留空保持当前密钥；仅用于升级器备份、恢复与增量 SQL。">
                  <Input.Password autoComplete="new-password" placeholder={deploymentConfig?.configuredSecrets.includes('MYSQL_ROOT_PASSWORD') ? '已配置，留空保持不变' : '首次启用内置 MySQL 时必须填写'} />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={20}>
            <Col xs={24} md={6}><Form.Item name="redisHost" label="Redis地址" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="redisPort" label="Redis端口" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={5}><Form.Item name="redisUsername" label="Redis ACL用户名"><Input placeholder="传统模式留空" /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="redisDatabase" label="Redis库"><Input placeholder="0" /></Form.Item></Col>
            <Col xs={24} md={5}>
              <Form.Item name="redisPassword" label="Redis密码">
                <Input.Password autoComplete="new-password" placeholder={deploymentConfig?.configuredSecrets.includes('REDIS_PASSWORD') ? '已配置，留空保持不变' : '无密码可留空'} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="clearRedisPassword" valuePropName="checked">
            <Checkbox>清空当前 Redis 密码（仅用于外部 Redis 确认无密码认证时）</Checkbox>
          </Form.Item>

          <Row gutter={20}>
            <Col xs={24} md={12}>
              <Form.Item name="tokenSecret" label="JWT密钥" extra="留空保持当前密钥；更换后已有登录状态会失效。">
                <Input.Password autoComplete="new-password" placeholder={deploymentConfig?.configuredSecrets.includes('TOKEN_SECRET') ? '已配置，留空保持不变' : '请输入强随机密钥'} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}><Form.Item name="javaOpts" label="JVM参数"><Input placeholder="-Xms1g -Xmx2g" /></Form.Item></Col>
          </Row>

          <Row gutter={20}>
            <Col xs={24} md={8}>
              <Form.Item name="rocketmqEnabled" label="启用RocketMQ">
                <Radio.Group options={[{ label: '关闭', value: 'false' }, { label: '启用', value: 'true' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}><Form.Item name="rocketmqNameserver" label="RocketMQ NameServer"><Input /></Form.Item></Col>
            {usesInternalRocketmq && (
              <Col xs={24} md={12}>
                <Form.Item
                  name="rocketmqFlushDiskType"
                  label="RocketMQ Broker刷盘"
                  extra="异步刷盘性能优先，同步刷盘持久性优先。业务投递始终等待Broker确认。"
                >
                  <Select options={[
                    { label: '异步刷盘（推荐）', value: 'ASYNC_FLUSH' },
                    { label: '同步刷盘', value: 'SYNC_FLUSH' }
                  ]} />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={12}>
              <Form.Item name="rocketmqAccessKey" label="RocketMQ AccessKey">
                <Input.Password autoComplete="new-password" placeholder={deploymentConfig?.configuredSecrets.includes('ROCKETMQ_ACCESS_KEY') ? '已配置，留空保持不变' : '未启用ACL可留空'} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="rocketmqSecretKey" label="RocketMQ SecretKey">
                <Input.Password autoComplete="new-password" placeholder={deploymentConfig?.configuredSecrets.includes('ROCKETMQ_SECRET_KEY') ? '已配置，留空保持不变' : '未启用ACL可留空'} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="clearRocketmqCredentials" valuePropName="checked">
            <Checkbox>清空当前 RocketMQ ACL 凭证（AccessKey 与 SecretKey 同时清空）</Checkbox>
          </Form.Item>

          {deploymentConfig?.mode === 'docker' && (
            <Collapse
              ghost
              items={[{
                key: 'docker-tuning',
                label: 'Docker组件与资源调优',
                children: (
                  <>
                    <Row gutter={20}>
                      <Col xs={24} md={12}><Form.Item name="mysqlBufferPool" label="MySQL缓冲池"><Input placeholder="2G" /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="mysqlMaxConnections" label="MySQL最大连接数"><Input placeholder="500" /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="redisMaxmemory" label="Redis内存上限"><Input placeholder="1gb" /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="redisMaxmemoryPolicy" label="Redis淘汰策略"><Input placeholder="noeviction" /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="webNodeOptions" label="Web Node参数"><Input /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="mqNamesrvJavaOpts" label="MQ NameServer JVM"><Input /></Form.Item></Col>
                      <Col xs={24} md={12}><Form.Item name="mqBrokerJavaOpts" label="MQ Broker JVM"><Input /></Form.Item></Col>
                    </Row>
                  </>
                )
              }]}
            />
          )}
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
              },
              {
                key: 'deployment',
                label: <Space><SettingOutlined />运行配置{deploymentDirty && <span className="upgrade-page__dirty-dot" />}</Space>,
                children: deploymentPanel
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
