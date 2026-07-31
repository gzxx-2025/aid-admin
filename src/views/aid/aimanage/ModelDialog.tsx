import React, { useEffect, useState } from 'react';
import { Col, Form, Input, InputNumber, Modal, Row, Select, Switch, message } from 'antd';
import { MODEL_TYPE_OPTIONS, GENERATE_MODE_OPTIONS, BILLING_MODE_OPTIONS, METER_TYPE_OPTIONS, IMAGE_REFINE_OPTIONS, ENABLE_STATUS_OPTIONS } from '@/utils/enums';
import { inferMeterType, makeEmptyCapabilityModel, TEXT_PROTOCOL_OPTIONS } from './constants';
import { buildBillingRuleJson, buildCapabilityJsonObject, buildParamMappingJsonObject, mergeMaxConcurrency, parseBillingRuleJson, parseCapabilityJsonToModel, parseMaxConcurrency, parseParamMappingJsonToRows } from './helpers';
import SkuEditor from './SkuEditor';
import CapabilityEditor from './CapabilityEditor';
import ParamMappingEditor from './ParamMappingEditor';
import JsonObjectEditor, { KvPreset } from './JsonObjectEditor';
import type { CapabilityModel, Model, ParamMapping, PreviewResult, Provider, SkuEditData } from './types';
import { billingPreview } from '@/api/aid/aimanage';

interface Props {
  open: boolean;
  title: string;
  provider: Provider | null;
  data?: Partial<Model>;
  onCancel: () => void;
  onOk: (values: Model) => Promise<void>;
}

/** 模型级 extra_body 常用预设 */
const MODEL_EXTRA_BODY_PRESETS: KvPreset[] = [
  { key: 'temperature', value: 0.7, label: 'temperature', tooltip: '采样温度，0~2' },
  { key: 'max_tokens', value: 4096, label: 'max_tokens', tooltip: '最大输出 token 数' },
  { key: 'top_p', value: 0.95, label: 'top_p', tooltip: '核采样阈值' },
  { key: 'seed', value: 42, label: 'seed', tooltip: '随机种子' }
];

/**
 * 单一数据源：modelForm 作为所有字段的权威状态
 * antd Form 仅用于校验；通过 onValuesChange 把值同步回 modelForm
 */
export default function ModelDialog({ open, title, provider, data, onCancel, onOk }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modelForm, setModelForm] = useState<Model>({} as Model);
  const [cap, setCap] = useState<CapabilityModel>(makeEmptyCapabilityModel());
  const [paramMappings, setParamMappings] = useState<ParamMapping[]>([]);
  const [skuData, setSkuData] = useState<SkuEditData>({ charToTokenRatio: 2, skuList: [] });
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d: Model = {
      modelCode: '', realModelCode: '', modelName: '', modelType: '', generateMode: '',
      costCredits: null, billingMultiplier: 1, apiVersion: '', apiSuffix: '',
      priority: 1, status: '0', remark: '', billingMode: 'FIXED', meterType: '',
      imageRefine: null, supportsTextInput: true, supportsImageInput: false,
      supportsSystemPrompt: true,
      supportsMultiImageInput: false, maxOutputCount: 1, defaultOutputCount: 1,
      supportsAspectRatio: false, supportsSizePreset: false, supportsDuration: false,
      supportsFirstFrame: false, supportsLastFrame: false,
      defaultSizeCode: null, defaultAspectRatio: null, defaultDurationSeconds: null,
      // v2.40：文本模型默认走 OpenAI 兼容协议
      protocol: 'openai-compatible-text',
      extraBody: null,
      ...(data || {})
    };

    // 解析 capability / paramMapping
    setCap(parseCapabilityJsonToModel(d.capabilityJson));
    setParamMappings(parseParamMappingJsonToRows(d.paramMappingJson));

    // 解析 SKU billing
    if (d.billingMode === 'SKU' && d.billingRuleJson) {
      const parsed = parseBillingRuleJson(d.billingRuleJson);
      setSkuData(parsed.skuEditData);
      if (parsed.meterType && !d.meterType) d.meterType = parsed.meterType;
    } else {
      setSkuData({ charToTokenRatio: 2, skuList: [] });
    }
    if (!d.meterType) d.meterType = inferMeterType(d.modelType);

    // v2.59：从 scheduleStrategyJson 解析模型并发上限（虚拟字段，提交时合并回 JSON）
    (d as any).maxConcurrency = parseMaxConcurrency(d.scheduleStrategyJson);

    setModelForm(d);
    form.resetFields();
    form.setFieldsValue(d);
    setPreviewResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data]);

  const isTokenBilling = modelForm.meterType === 'TOKEN';
  const modelType = modelForm.modelType || '';

  /** Form 字段（name 绑定的）变化时，同步到 modelForm */
  const handleValuesChange = (changed: any, all: any) => {
    setModelForm((prev) => {
      const next = { ...prev, ...changed };
      // modelType 变化时联动能力开关与默认 meterType
      if ('modelType' in changed) {
        const v = changed.modelType;
        if (!next.meterType) next.meterType = inferMeterType(v);
        if (v === 'text') {
          next.supportsTextInput = true;
          next.supportsSystemPrompt = true;
          next.supportsImageInput = false;
          next.supportsMultiImageInput = false;
          next.supportsAspectRatio = false;
          next.supportsSizePreset = false;
          next.supportsDuration = false;
          next.supportsFirstFrame = false;
          next.supportsLastFrame = false;
        } else if (v === 'image') {
          next.supportsTextInput = true;
          next.supportsImageInput = true;
          next.supportsAspectRatio = true;
          next.supportsSizePreset = true;
          next.supportsDuration = false;
        } else if (v === 'video') {
          next.supportsTextInput = true;
          next.supportsImageInput = true;
          next.supportsAspectRatio = true;
          next.supportsSizePreset = true;
          next.supportsDuration = true;
        }
        // 把联动字段也写回表单
        form.setFieldsValue({
          meterType: next.meterType,
          supportsTextInput: next.supportsTextInput,
          supportsSystemPrompt: next.supportsSystemPrompt,
          supportsImageInput: next.supportsImageInput,
          supportsMultiImageInput: next.supportsMultiImageInput,
          supportsAspectRatio: next.supportsAspectRatio,
          supportsSizePreset: next.supportsSizePreset,
          supportsDuration: next.supportsDuration,
          supportsFirstFrame: next.supportsFirstFrame,
          supportsLastFrame: next.supportsLastFrame
        });
      }
      // 切到 SKU 模式且 skuList 为空时，初始化一条 SKU
      if ('billingMode' in changed && changed.billingMode === 'SKU') {
        if (skuData.skuList.length === 0) {
          const tokenBilling = (next.meterType || inferMeterType(next.modelType)) === 'TOKEN';
          setSkuData({
            charToTokenRatio: skuData.charToTokenRatio || 2,
            skuList: [{
              skuCode: '',
              skuName: '',
              enabled: true,
              priority: 1,
              match: tokenBilling ? { inputTokensMin: 0, inputTokensMax: 32000 } : {},
              price: null,
              inputPricePerMillion: null,
              outputPricePerMillion: null,
              remark: ''
            }]
          });
        }
      }
      return next;
    });
  };

  const handlePreview = async (inputTokens: number, outputTokens: number) => {
    // 合并最新 form 值，避免使用过期 modelForm
    const latest = { ...modelForm, ...form.getFieldsValue(true) };
    const tokenBilling = latest.meterType === 'TOKEN';
    const ruleJson = buildBillingRuleJson(latest, skuData, tokenBilling);
    const testParams: any = tokenBilling
      ? { inputTokens, outputTokens }
      : (skuData.skuList[0]?.match ? { ...skuData.skuList[0].match } : {});
    setPreviewLoading(true);
    try {
      const res: any = await billingPreview({
        billingRuleJson: ruleJson,
        billingMultiplier: latest.billingMultiplier,
        testParams
      });
      setPreviewResult(res.data || {});
    } catch {
      message.error('试算失败，请检查SKU配置');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    // 合并 form 值（name 绑定）+ modelForm（能力开关等 state 绑定的）
    const final: Model = { ...modelForm, ...values, providerId: provider?.id };

    if (final.modelType === 'video' && cap.supportsReferenceAudio === true) {
      const maxCount = Number(cap.maxReferenceAudios || 0);
      const minSeconds = Number(cap.referenceAudioMinDurationSeconds || 0);
      const maxSeconds = Number(cap.referenceAudioMaxDurationSeconds || 0);
      const maxTotalSeconds = Number(cap.referenceAudioMaxTotalDurationSeconds || 0);
      if (cap.supportsAudio !== true || maxCount <= 0 || minSeconds <= 0
        || maxSeconds < minSeconds || maxTotalSeconds < minSeconds
        || cap.referenceAudioFormats.length === 0) {
        message.error('请完善参考音频配置');
        return;
      }
    }

    if (final.billingMode === 'SKU' && skuData.skuList.length === 0) {
      message.error('SKU模式下至少需要配置一条SKU');
      return;
    }

    // v2.40：模型级 extra_body 由 JsonObjectEditor 输出，已是合法 JSON 字符串或 null
    // 这里只做空值兜底
    if (!final.extraBody || !String(final.extraBody).trim()) {
      final.extraBody = null;
    }

    // realModelCode 为空串时提交 null，让后端自动回退 modelCode
    if (!final.realModelCode || !String(final.realModelCode).trim()) {
      final.realModelCode = null as any;
    }

    // 把模型并发上限合并回 scheduleStrategyJson（保留其它已有键，不整体覆盖）
    final.scheduleStrategyJson = mergeMaxConcurrency(
      final.scheduleStrategyJson,
      (final as any).maxConcurrency
    );
    delete (final as any).maxConcurrency;

    setLoading(true);
    try {
      const tokenBilling = final.meterType === 'TOKEN';

      // capabilityJson 序列化
      const capObj = buildCapabilityJsonObject(final, cap);
      const capStr = JSON.stringify(capObj);
      final.capabilityJson = capStr === '{}' ? null : capStr;

      // paramMappingJson 序列化
      const pmStr = JSON.stringify(buildParamMappingJsonObject(paramMappings));
      final.paramMappingJson = pmStr === '{}' ? null : pmStr;

      // billing 规则序列化
      if (final.billingMode === 'SKU') {
        final.billingRuleJson = buildBillingRuleJson(final, skuData, tokenBilling);
        final.billingVersion = (final.billingVersion || 0) + 1;
        final.costCredits = null;
      } else {
        const mt = final.meterType || inferMeterType(final.modelType);
        final.billingRuleJson = JSON.stringify({ mode: 'FIXED', meterType: mt, preHold: true });
      }

      // 计费倍率兜底
      if (!final.billingMultiplier || Number(final.billingMultiplier) < 0.01) {
        final.billingMultiplier = 1;
      }

      await onOk(final);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title={title} onCancel={onCancel} onOk={handleOk} confirmLoading={loading} width={920} destroyOnClose maskClosable={false}>
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange} style={{ marginTop: 8, maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
        <h4 style={{ color: '#4b5563' }}>基本信息</h4>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="modelCode" label="模型代码" rules={[{ required: true }]} tooltip="展示/选择用，全表唯一（如 gpt5.4_a）。后端做唯一校验：重复返回「编码已存在」，为空返回「编码不能空」"><Input placeholder="如: gpt5.4_a（唯一展示码）" /></Form.Item></Col>
          <Col span={12}><Form.Item name="realModelCode" label="真实上游模型名" tooltip="真正发给厂商的模型名，可重复（如 gpt5.4）；为空则自动回退为模型代码。示例：厂商A配 gpt5.4_a→真实名 gpt5.4，厂商B配 gpt5.4_b→真实名 gpt5.4"><Input placeholder="如: gpt5.4（可重复，留空回退模型代码）" maxLength={255} /></Form.Item></Col>
          <Col span={12}><Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}><Input placeholder="如: Seedance" /></Form.Item></Col>
          <Col span={12}><Form.Item name="modelType" label="模型分类" rules={[{ required: true }]}><Select options={MODEL_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} /></Form.Item></Col>
          <Col span={12}><Form.Item name="generateMode" label="生成模式"><Select allowClear options={GENERATE_MODE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} /></Form.Item></Col>
          {modelType === 'image' && <Col span={12}><Form.Item name="imageRefine" label="图片模型类型"><Select allowClear options={IMAGE_REFINE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} /></Form.Item></Col>}
        </Row>

        <h4 style={{ color: '#4b5563' }}>计费配置</h4>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="billingMode" label="计费模式" rules={[{ required: true }]}><Select options={BILLING_MODE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} /></Form.Item></Col>
          {modelForm.billingMode !== 'SKU' && <Col span={8}><Form.Item name="costCredits" label="官方原价（元/次）" tooltip="这里只填写厂商官方原价，最终积分由模型基础倍率和单模型倍率统一换算"><InputNumber min={0} precision={4} controls={false} style={{ width: '100%' }} placeholder="例如 1 元填写 1" /></Form.Item></Col>}
          <Col span={8}><Form.Item name="billingMultiplier" label="单模型倍率" tooltip="最终积分 = 官方原价 × 模型基础倍率 × 单模型倍率"><InputNumber min={0.01} precision={4} step={0.01} controls={false} style={{ width: '100%' }} placeholder="1.00 = 不加价" /></Form.Item></Col>
          <Col span={8}><Form.Item name="meterType" label="计费口径"><Select options={METER_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} /></Form.Item></Col>
        </Row>
        {modelForm.billingMode === 'SKU' && <SkuEditor data={skuData} isTokenBilling={isTokenBilling} meterType={modelForm.meterType || inferMeterType(modelForm.modelType)} onChange={setSkuData} previewResult={previewResult} previewLoading={previewLoading} onPreview={handlePreview} />}

        <h4 style={{ color: '#4b5563' }}>接口配置</h4>
        <Row gutter={16}>
          {modelType === 'text' && (
            <Col span={24}>
              <Form.Item
                name="protocol"
                label="协议"
                tooltip="文本模型协议路由：99% 厂商选第一项即可。Gemini 字段名异构，单独走 gemini-text"
                rules={[{ required: true, message: '请选择协议' }]}
              >
                <Select
                  // 选中态只显示名称，避免双行 label 把选择框撑高/溢出
                  options={TEXT_PROTOCOL_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                    desc: o.desc
                  }))}
                  optionRender={(option) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{(option.data as any).label}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{(option.data as any).desc}</div>
                    </div>
                  )}
                />
              </Form.Item>
            </Col>
          )}
          <Col span={12}><Form.Item name="apiVersion" label="API版本"><Input placeholder="特定路由后缀(选填)" /></Form.Item></Col>
          <Col span={12}><Form.Item name="apiSuffix" label="网关后缀"><Input placeholder="如 /v1/chat/completions" /></Form.Item></Col>
          {modelType === 'text' && (
            <Col span={24}>
              <Form.Item
                name="extraBody"
                label="模型级请求体附加参数（覆盖厂商级）"
                tooltip="与厂商级 extra_body 合并，同 key 覆盖。一般留空，沿用厂商级配置。"
              >
                <JsonObjectEditor
                  presets={MODEL_EXTRA_BODY_PRESETS}
                  emptyText="未配置模型级覆盖参数（沿用厂商级）"
                />
              </Form.Item>
            </Col>
          )}
        </Row>

        <h4 style={{ color: '#4b5563' }}>模型能力配置</h4>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="supportsTextInput" label="文本输入" valuePropName="checked"><Switch /></Form.Item></Col>
          {modelType === 'text' && <Col span={8}><Form.Item name="supportsSystemPrompt" label="系统提示词分离" valuePropName="checked" tooltip="开启后智能体提示词走 system role，动态入参走 user role；关闭则合并为单条消息"><Switch /></Form.Item></Col>}
          {modelType !== 'text' && <Col span={8}><Form.Item name="supportsImageInput" label="图片输入" valuePropName="checked"><Switch /></Form.Item></Col>}
          {modelType !== 'text' && <Col span={8}><Form.Item name="supportsMultiImageInput" label="多图输入" valuePropName="checked"><Switch /></Form.Item></Col>}
        </Row>
        {modelType !== 'text' && (
          <Row gutter={16}>
            <Col span={8}><Form.Item name="maxOutputCount" label="最大输出数量"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="defaultOutputCount" label="默认输出数量"><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="supportsAspectRatio" label="支持比例" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        )}
        {modelType !== 'text' && (
          <Row gutter={16}>
            <Col span={8}><Form.Item name="supportsSizePreset" label="支持规格" valuePropName="checked"><Switch /></Form.Item></Col>
            {modelType === 'video' && <Col span={8}><Form.Item name="supportsDuration" label="支持时长" valuePropName="checked"><Switch /></Form.Item></Col>}
          </Row>
        )}
        {modelType === 'video' && (
          <Row gutter={16}>
            <Col span={8}><Form.Item name="supportsFirstFrame" label="支持首帧图" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={8}><Form.Item name="supportsLastFrame" label="支持尾帧图" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        )}
        {modelType !== 'text' && (
          <Row gutter={16}>
            <Col span={8}><Form.Item name="defaultSizeCode" label="默认规格"><Select options={cap.sizeOptions.map((o) => ({ label: o, value: o }))} allowClear placeholder={cap.sizeOptions.length ? '选择' : '请先在下方勾选'} /></Form.Item></Col>
            <Col span={8}><Form.Item name="defaultAspectRatio" label="默认比例"><Select options={cap.aspectRatioOptions.map((o) => ({ label: o, value: o }))} allowClear placeholder={cap.aspectRatioOptions.length ? '选择' : '请先在下方勾选'} /></Form.Item></Col>
            {modelType === 'video' && <Col span={8}><Form.Item name="defaultDurationSeconds" label="默认时长(秒)"><Select options={cap.durationOptions.map((o) => ({ label: o + ' 秒', value: o }))} allowClear placeholder={cap.durationOptions.length ? '选择' : '请先在下方勾选'} /></Form.Item></Col>}
          </Row>
        )}

        <h4 style={{ color: '#4b5563' }}>capabilityJson 图形化配置</h4>
        <CapabilityEditor modelType={modelType} form={modelForm} cap={cap} onCapChange={setCap} onFormChange={(p) => { setModelForm((m) => ({ ...m, ...p })); form.setFieldsValue(p); }} />

        <h4 style={{ color: '#4b5563' }}>paramMappingJson</h4>
        <ParamMappingEditor modelType={modelType} rows={paramMappings} onChange={setParamMappings} />

        <h4 style={{ color: '#4b5563' }}>调度配置</h4>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="maxConcurrency"
              label="模型并发上限"
              tooltip="该模型同时在途的上游请求数上限（厂商限制，如视频模型建议填 1）。留空 = 不限（仅受所属供应商上限约束）。保存时校验不得超过供应商与全局上限，写入 schedule_strategy_json 的 maxConcurrency 键，不影响其它调度策略字段。"
            >
              <InputNumber
                min={1}
                max={1000}
                controls={false}
                style={{ width: '100%' }}
                placeholder="留空=不限制"
              />
            </Form.Item>
          </Col>
        </Row>

        <h4 style={{ color: '#4b5563' }}>其他信息</h4>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="priority" label="优先级"><InputNumber min={1} max={999} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="status" label="状态"><Select options={ENABLE_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} /></Form.Item></Col>
          <Col span={24}><Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  );
}
