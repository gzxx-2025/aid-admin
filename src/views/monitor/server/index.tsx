import React, { useState } from 'react';
import { Tabs } from 'antd';
import { CloudServerOutlined, DatabaseOutlined, ControlOutlined } from '@ant-design/icons';

import ServerPanel from './ServerPanel';
import CacheOverviewPanel from './CacheOverviewPanel';
import CacheManagePanel from './CacheManagePanel';

/**
 * 服务与缓存监控（需求12：合并 服务监控 / 缓存监控 / 缓存列表）
 * 通过 Tab 切换，缓存管理为重点优化项。
 */
export default function ServerAndCachePage() {
  const [active, setActive] = useState('server');

  return (
    <div className="crud-page" style={{ padding: 16 }}>
      <Tabs
        activeKey={active}
        onChange={setActive}
        destroyInactiveTabPane
        items={[
          {
            key: 'server',
            label: <span><CloudServerOutlined /> 服务监控</span>,
            children: <ServerPanel />
          },
          {
            key: 'cacheOverview',
            label: <span><DatabaseOutlined /> 缓存概览</span>,
            children: <CacheOverviewPanel />
          },
          {
            key: 'cacheManage',
            label: <span><ControlOutlined /> 缓存管理</span>,
            children: <CacheManagePanel />
          }
        ]}
      />
    </div>
  );
}
