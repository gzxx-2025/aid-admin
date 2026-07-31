import React, { useEffect } from 'react';
import { Button, Popover, Space, Spin, Typography } from 'antd';
import {
  CheckCircleFilled,
  CloudDownloadOutlined,
  GithubOutlined,
  LinkOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { useUpgradeStore } from '@/store/useUpgradeStore';

interface Props {
  collapsed: boolean;
}

/** 品牌区单一版本入口，详情在悬停或点击时显示；状态与升级页共享，任一处检查更新全局联动。 */
export default function SidebarVersionPanel({ collapsed }: Props) {
  const status = useUpgradeStore((state) => state.status);
  const checking = useUpgradeStore((state) => state.checking);
  const loadStatus = useUpgradeStore((state) => state.loadStatus);
  const navigate = useNavigate();

  useEffect(() => {
    // 已有共享快照（如从升级页返回）时不重复请求
    if (!useUpgradeStore.getState().status) {
      loadStatus(false).catch(() => undefined);
    }
  }, [loadStatus]);

  if (collapsed || !status) return null;

  const version = status.currentVersion ? `v${status.currentVersion}` : '-';
  const content = (
    <div className="version-popover">
      <div className="version-popover__header">
        <span>当前版本</span>
        <Button
          type="text"
          size="small"
          aria-label="检查更新"
          icon={<SyncOutlined spin={checking} />}
          onClick={() => loadStatus(true).catch(() => undefined)}
        />
      </div>
      <div className="version-popover__body">
        <div className="version-popover__number">
          {version}
          {!status.hasUpdate && !status.checkError && <CheckCircleFilled className="version-popover__ok" />}
        </div>
        <Typography.Text type="secondary">
          {status.hasUpdate
            ? `最新版本：v${status.latestVersion}${status.latestChannel === 'beta' ? '（测试版）' : ''}`
            : status.checkError
              ? '无法获取线上版本，请检查更新源配置与网络'
              : '已是最新版本'}
        </Typography.Text>
        {status.hasUpdate && (
          <div className="version-popover__update">
            <CloudDownloadOutlined />
            <div>
              <strong>有新版本可用</strong>
              <br />
              <span>v{status.latestVersion}{status.latestChannel === 'beta' ? '（测试版）' : ''}</span>
            </div>
          </div>
        )}
        <div className="version-popover__actions">
          <Button type="primary" icon={<CloudDownloadOutlined />} onClick={() => navigate('/system/upgrade')}>
            {status.hasUpdate ? '立即更新' : '版本管理'}
          </Button>
          {!!status.rollbackReleases?.length && (
            <Button onClick={() => navigate('/system/upgrade')}>
              版本回退（{status.rollbackReleases.length}）
            </Button>
          )}
        </div>
        <Space className="version-popover__links" wrap>
          {status.giteeReleaseUrl && (
            <a href={status.giteeReleaseUrl} target="_blank" rel="noreferrer">
              <LinkOutlined /> Gitee 发布
            </a>
          )}
          {status.githubReleaseUrl && (
            <a href={status.githubReleaseUrl} target="_blank" rel="noreferrer">
              <GithubOutlined /> GitHub 发布
            </a>
          )}
          {status.docsUrl && (
            <a href={status.docsUrl} target="_blank" rel="noreferrer">
              <LinkOutlined /> 使用教程
            </a>
          )}
        </Space>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      // focus 触发会导致点击弹层内容时触发器失焦、弹层提前关闭，内部按钮全部失效
      trigger={['hover', 'click']}
      placement="bottomLeft"
      overlayClassName="sidebar-version-popover"
    >
      <button className={`sidebar-version-trigger ${status.hasUpdate ? 'is-update' : 'is-current'}`} type="button">
        {checking ? <Spin size="small" /> : version}
        {status.hasUpdate && <span>升级</span>}
      </button>
    </Popover>
  );
}
