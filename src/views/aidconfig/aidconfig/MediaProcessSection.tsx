import React, { useEffect, useState } from 'react';
import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  message
} from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import PageCard from '@/components/PageCard';
import { getMediaProcessConfig, saveMediaProcessConfig } from '@/api/aidconfig/aidconfig';

/**
 * 媒体处理（腾讯云 MPS 视频合成）- 内嵌配置区块。
 *
 * 作为「配置信息」(/manager/aidconfig) 页面的内嵌区块统一管理，接口在 /aidconfig/mps/config，
 * 沿用 aidconfig:aidconfig:edit 权限。地域/分辨率/编码做成下拉，分辨率单价做成表单（不写 JSON）。
 */

/** 腾讯云地域选项 */
const REGION_OPTIONS = [
  { label: '广州 ap-guangzhou', value: 'ap-guangzhou' },
  { label: '上海 ap-shanghai', value: 'ap-shanghai' },
  { label: '北京 ap-beijing', value: 'ap-beijing' },
  { label: '南京 ap-nanjing', value: 'ap-nanjing' },
  { label: '成都 ap-chengdu', value: 'ap-chengdu' },
  { label: '重庆 ap-chongqing', value: 'ap-chongqing' },
  { label: '中国香港 ap-hongkong', value: 'ap-hongkong' },
  { label: '新加坡 ap-singapore', value: 'ap-singapore' },
  { label: '东京 ap-tokyo', value: 'ap-tokyo' }
];

/** 输出分辨率档选项 */
const RESOLUTION_OPTIONS = [
  { label: '标清 SD（短边 ≤ 480p）', value: 'SD' },
  { label: '高清 HD（短边 ≤ 720p）', value: 'HD' },
  { label: '全高清 FHD（短边 ≤ 1080p）', value: 'FHD' },
  { label: '2K（短边 ≤ 1440p）', value: '2K' },
  { label: '4K（短边 ≤ 2160p）', value: '4K' }
];

/** 编码选项 */
const CODEC_OPTIONS = [
  { label: 'H.264（兼容性最好，推荐）', value: 'H.264' },
  { label: 'H.265（更高压缩率）', value: 'H.265' },
  { label: 'AV1（最高压缩率）', value: 'AV1' }
];

/** 分辨率档 → 单价表单字段名 */
const TIER_FIELDS: Array<{ tier: string; field: string; label: string }> = [
  { tier: 'SD', field: 'priceSD', label: '标清 SD' },
  { tier: 'HD', field: 'priceHD', label: '高清 HD' },
  { tier: 'FHD', field: 'priceFHD', label: '全高清 FHD' },
  { tier: '2K', field: 'price2K', label: '2K' },
  { tier: '4K', field: 'price4K', label: '4K' }
];

/** 把任意值转布尔（兼容字符串 "true"/"false"） */
function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.trim().toLowerCase() === 'true';
  return Boolean(v);
}

/** 数字解析（失败返回 undefined，避免把 NaN 灌进表单） */
function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export default function MediaProcessSection() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await getMediaProcessConfig();
      const raw = (res?.data || {}) as Record<string, any>;
      // 后端返回均为字符串：布尔/数值/单价 JSON 需各自规整再回填
      const values: Record<string, any> = {
        enabled: toBool(raw.enabled),
        secretId: raw.secretId,
        secretKey: raw.secretKey,
        region: raw.region || 'ap-guangzhou',
        outputBucket: raw.outputBucket,
        outputRegion: raw.outputRegion || 'ap-guangzhou',
        outputDir: raw.outputDir || '/compose_result/',
        callbackUrl: raw.callbackUrl,
        outputResolution: raw.outputResolution || 'FHD',
        codec: raw.codec || 'H.264',
        creditRate: toNum(raw.creditRate) ?? 100,
        profitMultiplier: toNum(raw.profitMultiplier) ?? 1.1
      };
      // 分辨率单价 JSON → 各档单价字段
      try {
        const tiers = raw.pricingTiers ? JSON.parse(raw.pricingTiers) : {};
        TIER_FIELDS.forEach(({ tier, field }) => {
          values[field] = toNum(tiers[tier]);
        });
      } catch {
        /* JSON 损坏时各档留空，由用户重填 */
      }
      form.setFieldsValue(values);
    } catch {
      /* 拦截器已提示 */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    // 各档单价字段 → pricingTiers JSON（仅收集已填写的档）
    const tiers: Record<string, number> = {};
    TIER_FIELDS.forEach(({ tier, field }) => {
      const v = values[field];
      if (v !== undefined && v !== null) tiers[tier] = Number(v);
    });
    const payload: Record<string, any> = {
      enabled: values.enabled,
      secretId: values.secretId,
      secretKey: values.secretKey,
      region: values.region,
      outputBucket: values.outputBucket,
      outputRegion: values.outputRegion,
      outputDir: values.outputDir,
      callbackUrl: values.callbackUrl,
      outputResolution: values.outputResolution,
      codec: values.codec,
      pricingTiers: JSON.stringify(tiers),
      creditRate: values.creditRate,
      profitMultiplier: values.profitMultiplier
    };
    setSaving(true);
    try {
      await saveMediaProcessConfig(payload);
      message.success('保存成功');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <PageCard
        title="媒体处理配置"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              保存配置
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="horizontal"
          labelCol={{ flex: '150px' }}
          wrapperCol={{ flex: 'auto' }}
          labelAlign="right"
          style={{ maxWidth: 760 }}
        >
          <Divider orientation="left" plain>
            基础
          </Divider>
          <Form.Item label="合成功能" name="enabled" valuePropName="checked" extra="关闭后所有视频合成请求将被拒绝">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Divider orientation="left" plain>
            腾讯云凭证
          </Divider>
          <Form.Item label="SecretId" name="secretId">
            <Input placeholder="腾讯云 SecretId" autoComplete="off" allowClear />
          </Form.Item>
          <Form.Item label="SecretKey" name="secretKey" extra="含 **** 表示未修改，留空不清空原值">
            <Input.Password
              placeholder="腾讯云 SecretKey"
              autoComplete="new-password"
              visibilityToggle={false}
            />
          </Form.Item>
          <Form.Item label="接口地域" name="region">
            <Select style={{ maxWidth: 300 }} options={REGION_OPTIONS} showSearch optionFilterProp="label" />
          </Form.Item>

          <Divider orientation="left" plain>
            成片输出
          </Divider>
          <Form.Item
            label="输出存储桶"
            name="outputBucket"
            extra="腾讯云 COS 桶，格式：桶名-APPID，例如 mybucket-1250000000"
          >
            <Input placeholder="成片输出的 COS 存储桶" allowClear />
          </Form.Item>
          <Form.Item label="存储桶地域" name="outputRegion">
            <Select style={{ maxWidth: 300 }} options={REGION_OPTIONS} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="输出目录" name="outputDir" extra="成片在桶内的存放目录，以 / 开头结尾">
            <Input placeholder="/compose_result/" allowClear style={{ maxWidth: 300 }} />
          </Form.Item>
          <Form.Item label="任务回调地址" name="callbackUrl" extra="MPS 合成完成后通知本平台，填 https://你的域名/api/media/callback/mps">
            <Input placeholder="https://your-domain/api/media/callback/mps" allowClear />
          </Form.Item>
          <Form.Item label="输出分辨率" name="outputResolution" extra="决定成片清晰度与计费档位">
            <Select style={{ maxWidth: 300 }} options={RESOLUTION_OPTIONS} />
          </Form.Item>
          <Form.Item label="视频编码" name="codec">
            <Select style={{ maxWidth: 300 }} options={CODEC_OPTIONS} />
          </Form.Item>

          <Divider orientation="left" plain>
            计费
          </Divider>
          <Form.Item label="积分兑换比例" name="creditRate" extra="1 元成本兑换多少积分（用于把云厂商单价换算成用户积分）">
            <InputNumber min={1} max={100000} style={{ width: 220 }} addonBefore="1 元 =" addonAfter="积分" />
          </Form.Item>
          <Form.Item label="利润倍率" name="profitMultiplier" extra="1.0=平价，1.1=加价10%，0.9=九折">
            <InputNumber min={0} max={100} step={0.1} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item label="各档单价" extra="按成片输出时长计费，单位：元/分钟（成本价，会再乘积分兑换比例与利润倍率）">
            <Row gutter={[12, 12]} style={{ maxWidth: 560 }}>
              {TIER_FIELDS.map(({ field, label }) => (
                <Col span={12} key={field}>
                  <Space>
                    <span style={{ display: 'inline-block', width: 84, textAlign: 'right', color: '#475569' }}>
                      {label}
                    </span>
                    <Form.Item name={field} noStyle>
                      <InputNumber min={0} step={0.001} style={{ width: 150 }} addonAfter="元/分钟" />
                    </Form.Item>
                  </Space>
                </Col>
              ))}
            </Row>
          </Form.Item>
        </Form>
      </PageCard>
    </Spin>
  );
}
