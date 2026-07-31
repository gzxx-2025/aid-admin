import React, { useState } from 'react';
import { Tabs } from 'antd';
import { TagsOutlined, SettingOutlined } from '@ant-design/icons';

import DictManager from './DictManager';
import ConfigPage from '@/views/system/config';

/**
 * 字典与参数（需求4）：合并「字典管理」与「参数配置」为同一页面的两个 Tab。
 * - 字典管理：主从联动、内联增删改（已优化，无需页面跳转）；
 * - 参数配置：复用原系统参数配置页。
 */
export default function DictAndConfigPage() {
  const [active, setActive] = useState('dict');

  return (
    <div className="crud-page" style={{ padding: 16 }}>
      <Tabs
        activeKey={active}
        onChange={setActive}
        items={[
          {
            key: 'dict',
            label: <span><TagsOutlined /> 字典管理</span>,
            children: <DictManager />
          },
          {
            key: 'config',
            label: <span><SettingOutlined /> 参数配置</span>,
            children: <ConfigPage />
          }
        ]}
      />
    </div>
  );
}
