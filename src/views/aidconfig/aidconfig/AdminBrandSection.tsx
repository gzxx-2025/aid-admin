import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Space, message } from 'antd';
import { PictureOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';

import { listAidconfig, updateAidconfig, addAidconfig } from '@/api/aidconfig/aidconfig';
import ImageUpload from '@/components/ImageUpload';

const CATEGORY = 'admin_brand';
const KEY_LOGIN = 'login_logo_url';
const KEY_SIDEBAR = 'sidebar_logo_url';
const KEY_FAVICON = 'favicon_url';

/** 与系统统一 OSS 上传保持一致（按 aid_config oss.uploadMode 动态分发 local/oss/cos） */
const UPLOAD_ACTION = (import.meta.env.VITE_APP_BASE_API || '') + '/api/user/oss/upload';

interface CfgItem {
  id?: number;
  configName: string;
  configValue: string;
}

/**
 * 后台品牌图片配置：登录 Logo / 左上角 Logo / 浏览器页签图标。
 * 写入 aid_config(category=admin_brand)，上传走媒体中心统一 /api/user/oss/upload。
 */
export default function AdminBrandSection() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loginLogo, setLoginLogo] = useState('');
  const [sidebarLogo, setSidebarLogo] = useState('');
  const [favicon, setFavicon] = useState('');
  const [items, setItems] = useState<Record<string, CfgItem>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await listAidconfig({ pageNum: 1, pageSize: 1000, category: CATEGORY });
      const rows: any[] = (res.rows || res.data || []).filter((r: any) => r.category === CATEGORY);
      const map: Record<string, CfgItem> = {};
      rows.forEach((r) => {
        map[r.configName] = { id: r.id, configName: r.configName, configValue: r.configValue || '' };
      });
      setItems(map);
      setLoginLogo(map[KEY_LOGIN]?.configValue || '');
      setSidebarLogo(map[KEY_SIDEBAR]?.configValue || '');
      setFavicon(map[KEY_FAVICON]?.configValue || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 持久化单个配置项（存在则更新，否则新增） */
  const persist = async (name: string, value: string, dict: string, order: number) => {
    const it = items[name];
    if (it?.id) {
      await updateAidconfig({ id: it.id, configValue: value });
    } else {
      await addAidconfig({
        category: CATEGORY,
        configName: name,
        configValue: value,
        configDict: dict,
        delFlag: '0',
        orderNum: order
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist(KEY_LOGIN, loginLogo || '', '登录页品牌Logo地址', 1);
      await persist(KEY_SIDEBAR, sidebarLogo || '', '后台左上角Logo地址', 2);
      await persist(KEY_FAVICON, favicon || '', '浏览器页签图标地址', 3);
      message.success('已保存，刷新页面后生效');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 880 }}>
      <Card
        bordered={false}
        className="page-card"
        title={
          <Space>
            <PictureOutlined style={{ color: '#6366f1' }} />
            后台品牌图片
          </Space>
        }
        extra={
          <Space>
            <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
              刷新
            </Button>
            <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="配置登录页 Logo、后台左上角 Logo、浏览器页签图标"
          description="图片走媒体中心统一上传。未配置时使用系统内置默认图；保存后刷新页面即可看到效果。"
        />

        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)', fontWeight: 500 }}>登录页 Logo</div>
          <ImageUpload
            value={loginLogo}
            onChange={(v) => setLoginLogo(v)}
            action={UPLOAD_ACTION}
            name="files"
            maxCount={1}
            maxSize={5}
            accept="image/*"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)', fontWeight: 500 }}>左上角 Logo</div>
          <ImageUpload
            value={sidebarLogo}
            onChange={(v) => setSidebarLogo(v)}
            action={UPLOAD_ACTION}
            name="files"
            maxCount={1}
            maxSize={5}
            accept="image/*"
          />
        </div>

        <div>
          <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)', fontWeight: 500 }}>页签图标 (Favicon)</div>
          <ImageUpload
            value={favicon}
            onChange={(v) => setFavicon(v)}
            action={UPLOAD_ACTION}
            name="files"
            maxCount={1}
            maxSize={2}
            accept="image/*,.ico"
          />
        </div>
      </Card>
    </div>
  );
}
