import React, { useMemo, useState } from 'react';
import { Button, Checkbox, Input, InputNumber, Modal, Space, Switch, Tooltip, message } from 'antd';
import { PlusOutlined, RedoOutlined, EditOutlined } from '@ant-design/icons';
import type { CapabilityModel, Model } from './types';
import { PRESET_SIZE, PRESET_ASPECT, PRESET_DURATION, makeEmptyCapabilityModel } from './constants';
import { buildCapabilityJsonObject, parseCapabilityJsonToModel } from './helpers';

interface Props {
  modelType: string;
  form: Model;
  cap: CapabilityModel;
  onCapChange: (c: CapabilityModel) => void;
  onFormChange: (patch: Partial<Model>) => void;
}

export default function CapabilityEditor({ modelType, form, cap, onCapChange, onFormChange }: Props) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newAspect, setNewAspect] = useState('');
  const [newDuration, setNewDuration] = useState(5);

  const presetSizes = PRESET_SIZE[modelType] || [];
  const presetAspects = PRESET_ASPECT[modelType] || [];
  const sizeChoices = useMemo(() => {
    const all = [...presetSizes];
    cap.sizeOptions.forEach((v) => { if (!all.includes(v)) all.push(v); });
    return all;
  }, [cap.sizeOptions, presetSizes]);
  const aspectChoices = useMemo(() => {
    const all = [...presetAspects];
    cap.aspectRatioOptions.forEach((v) => { if (!all.includes(v)) all.push(v); });
    return all;
  }, [cap.aspectRatioOptions, presetAspects]);
  const durationChoices = useMemo(() => {
    const all = [...PRESET_DURATION];
    cap.durationOptions.forEach((v) => { if (!all.includes(v)) all.push(v); });
    return all.sort((a, b) => a - b);
  }, [cap.durationOptions]);

  if (modelType === 'text') {
    return <div style={{ color: '#94a3b8', padding: 12 }}>文本模型不涉及比例/规格/时长</div>;
  }

  const updateCap = (patch: Partial<CapabilityModel>) => onCapChange({ ...cap, ...patch });
  const updateScene = (scene: string, patch: any) => {
    onCapChange({ ...cap, sceneRules: { ...cap.sceneRules, [scene]: { ...(cap.sceneRules as any)[scene], ...patch } } });
  };

  const resetDefaults = () => {
    const fresh = makeEmptyCapabilityModel();
    if (modelType === 'image') {
      fresh.sizeOptions = [...presetSizes];
      fresh.aspectRatioOptions = [...presetAspects];
    } else if (modelType === 'video') {
      fresh.sizeOptions = [...(PRESET_SIZE.video || [])];
      fresh.aspectRatioOptions = [...(PRESET_ASPECT.video || [])];
      fresh.durationOptions = [...PRESET_DURATION];
    }
    onCapChange(fresh);
    message.success('已重置为推荐默认');
  };

  const addCustomSize = () => {
    const v = newSize.trim();
    if (!v) return;
    if (!cap.sizeOptions.includes(v)) updateCap({ sizeOptions: [...cap.sizeOptions, v] });
    setNewSize('');
  };
  const addCustomAspect = () => {
    const v = newAspect.trim();
    if (!v || !/^\d+\s*:\s*\d+$/.test(v)) { message.error('格式应为 宽:高'); return; }
    const norm = v.replace(/\s+/g, '');
    if (!cap.aspectRatioOptions.includes(norm)) updateCap({ aspectRatioOptions: [...cap.aspectRatioOptions, norm] });
    setNewAspect('');
  };
  const addCustomDuration = () => {
    if (!newDuration || newDuration <= 0) return;
    if (!cap.durationOptions.includes(newDuration)) {
      updateCap({ durationOptions: [...cap.durationOptions, newDuration].sort((a, b) => a - b) });
    }
  };

  const openPaste = () => {
    setPasteText(JSON.stringify(buildCapabilityJsonObject(form, cap), null, 2));
    setPasteOpen(true);
  };
  const applyPaste = () => {
    try { JSON.parse(pasteText); } catch (e: any) { message.error('JSON 不合法: ' + e.message); return; }
    onCapChange(parseCapabilityJsonToModel(pasteText));
    setPasteOpen(false);
    message.success('已应用');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button size="small" icon={<RedoOutlined />} onClick={resetDefaults}>重置为推荐默认</Button>
        <Button size="small" icon={<EditOutlined />} onClick={openPaste}>粘贴 JSON 应用</Button>
      </div>

      {/* 规格 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>规格选项 sizeOptions</div>
        <Checkbox.Group value={cap.sizeOptions} onChange={(v) => updateCap({ sizeOptions: v as string[] })}>
          {sizeChoices.map((o) => <Checkbox key={o} value={o}>{o}</Checkbox>)}
        </Checkbox.Group>
        <Space size={4} style={{ marginTop: 4 }}>
          <Input size="small" style={{ width: 120 }} placeholder="自定义规格" value={newSize} onChange={(e) => setNewSize(e.target.value)} onPressEnter={addCustomSize} />
          <Button size="small" icon={<PlusOutlined />} onClick={addCustomSize}>新增</Button>
        </Space>
      </div>

      {/* 比例 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>比例选项 aspectRatioOptions</div>
        <Checkbox.Group value={cap.aspectRatioOptions} onChange={(v) => updateCap({ aspectRatioOptions: v as string[] })}>
          {aspectChoices.map((o) => <Checkbox key={o} value={o}>{o}</Checkbox>)}
        </Checkbox.Group>
        <Space size={4} style={{ marginTop: 4 }}>
          <Input size="small" style={{ width: 120 }} placeholder="如 5:4" value={newAspect} onChange={(e) => setNewAspect(e.target.value)} onPressEnter={addCustomAspect} />
          <Button size="small" icon={<PlusOutlined />} onClick={addCustomAspect}>新增</Button>
        </Space>
      </div>

      {/* 时长（仅 video） */}
      {modelType === 'video' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>时长选项 durationOptions</div>
          <Checkbox.Group value={cap.durationOptions} onChange={(v) => updateCap({ durationOptions: (v as number[]).sort((a, b) => a - b) })}>
            {durationChoices.map((o) => <Checkbox key={o} value={o}>{o} 秒</Checkbox>)}
          </Checkbox.Group>
          <Space size={4} style={{ marginTop: 4 }}>
            <InputNumber size="small" style={{ width: 80 }} min={1} max={600} value={newDuration} onChange={(v) => setNewDuration(v || 5)} />
            <Button size="small" icon={<PlusOutlined />} onClick={addCustomDuration}>新增</Button>
          </Space>
        </div>
      )}

      {modelType === 'video' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>参考音频输入 supportsReferenceAudio</div>
          <Space size={12} align="center" wrap>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              支持传入参考音频
              <Switch
                size="small"
                style={{ marginLeft: 6 }}
                checked={cap.supportsReferenceAudio === true}
                onChange={(v) => updateCap(v ? {
                  supportsReferenceAudio: true,
                  supportsAudio: true,
                  maxReferenceAudios: cap.maxReferenceAudios || 3,
                  referenceAudioMinDurationSeconds: cap.referenceAudioMinDurationSeconds || 2,
                  referenceAudioMaxDurationSeconds: cap.referenceAudioMaxDurationSeconds || 15,
                  referenceAudioMaxTotalDurationSeconds: cap.referenceAudioMaxTotalDurationSeconds || 15,
                  referenceAudioFormats: cap.referenceAudioFormats.length ? cap.referenceAudioFormats : ['wav', 'mp3']
                } : { supportsReferenceAudio: false })}
              />
            </span>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Space size={8} wrap>
              <span>最多数量</span>
              <InputNumber size="small" min={1} max={20} precision={0} disabled={!cap.supportsReferenceAudio}
                value={cap.maxReferenceAudios ?? undefined}
                onChange={(v) => updateCap({ maxReferenceAudios: v == null ? null : Math.trunc(Number(v)) })} />
              <span>单段最短</span>
              <InputNumber size="small" min={1} max={600} precision={0} addonAfter="秒" disabled={!cap.supportsReferenceAudio}
                value={cap.referenceAudioMinDurationSeconds ?? undefined}
                onChange={(v) => updateCap({ referenceAudioMinDurationSeconds: v == null ? null : Math.trunc(Number(v)) })} />
              <span>单段最长</span>
              <InputNumber size="small" min={1} max={600} precision={0} addonAfter="秒" disabled={!cap.supportsReferenceAudio}
                value={cap.referenceAudioMaxDurationSeconds ?? undefined}
                onChange={(v) => updateCap({ referenceAudioMaxDurationSeconds: v == null ? null : Math.trunc(Number(v)) })} />
              <span>总时长上限</span>
              <InputNumber size="small" min={1} max={1800} precision={0} addonAfter="秒" disabled={!cap.supportsReferenceAudio}
                value={cap.referenceAudioMaxTotalDurationSeconds ?? undefined}
                onChange={(v) => updateCap({ referenceAudioMaxTotalDurationSeconds: v == null ? null : Math.trunc(Number(v)) })} />
            </Space>
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ marginRight: 8 }}>支持格式</span>
            <Checkbox.Group
              disabled={!cap.supportsReferenceAudio}
              options={[{ label: 'WAV', value: 'wav' }, { label: 'MP3', value: 'mp3' }]}
              value={cap.referenceAudioFormats}
              onChange={(v) => updateCap({ referenceAudioFormats: v as string[] })}
            />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, maxWidth: 660, lineHeight: 1.6 }}>
            该能力与音画同出独立配置，但提交参考音频时必须同时开启生成声音。Seedance 2.0 官方限制为最多 3 段、单段 2-15 秒、总时长不超过 15 秒、格式 WAV/MP3。
          </div>
        </div>
      )}

      {/* 单次最多参考图张数 maxReferenceImages（image / video 通用，四态语义） */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>单次最多参考图张数 maxReferenceImages</div>
        <Space size={8} align="center">
          <InputNumber
            size="small"
            style={{ width: 120 }}
            min={-1}
            max={64}
            precision={0}
            placeholder="留空=默认"
            value={cap.maxReferenceImages ?? undefined}
            onChange={(v) => {
              if (v == null) {
                updateCap({ maxReferenceImages: null });
                return;
              }
              const n = Math.trunc(Number(v));
              updateCap({ maxReferenceImages: Number.isFinite(n) && n >= -1 ? n : null });
            }}
          />
          <span style={{ fontSize: 12, color: '#94a3b8', maxWidth: 520, lineHeight: 1.6 }}>
            四态：<b>留空</b>=不设上限，回退厂商默认；<b>-1</b>=无限；<b>0</b>=禁止参考图（该模型暂不支持图生图，将来开放改为 N 即可）；<b>N</b>=上限 N 张。
            <br />
            各厂商官方上限参考：即梦4.0=10 / 4.6=4 / ultra=1 / Vidu=7 / Agnes图=1 / Agnes视频=2。超量时系统保留前 N 张并记 warn 日志，不报错。
          </span>
        </Space>
      </div>

      {/* 最少参考图张数 minReferenceImages（image / video 通用，缺图前置拦截） */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>最少参考图张数 minReferenceImages</div>
        <Space size={8} align="center">
          <InputNumber
            size="small"
            style={{ width: 120 }}
            min={0}
            max={64}
            precision={0}
            placeholder="留空=不要求"
            value={cap.minReferenceImages ?? undefined}
            onChange={(v) => {
              if (v == null) {
                updateCap({ minReferenceImages: null });
                return;
              }
              const n = Math.trunc(Number(v));
              updateCap({ minReferenceImages: Number.isFinite(n) && n >= 0 ? n : null });
            }}
          />
          <span style={{ fontSize: 12, color: '#94a3b8', maxWidth: 520, lineHeight: 1.6 }}>
            <b>留空 / 0</b>=不要求带图（纯文生可用）；<b>N≥1</b>=必须至少带 N 张输入图，缺图请求在建任务/扣费前被拦截（提示「至少传N张图」），避免到上游才失败空转一轮冻结-退款。
            <br />
            配置参考：图生图 / 图生视频 / 参考图生视频=1；首尾帧=2（首帧+尾帧）；多帧=2（首帧+至少1个关键帧）。
          </span>
        </Space>
      </div>

      {/* 音画同出：仅 video；运营按官方文档勾选后，C 端才展示「生成声音」开关 */}
      {modelType === 'video' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>音画同出 supportsAudio</div>
          <Space size={12} align="center" wrap>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              支持用户选择生成声音
              <Switch
                size="small"
                style={{ marginLeft: 6 }}
                checked={cap.supportsAudio === true}
                onChange={(v) => updateCap({ supportsAudio: v })}
              />
            </span>
          </Space>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, maxWidth: 560, lineHeight: 1.6 }}>
            按官方文档配置：Seedance 2.0 / Fast / Mini（<code>generate_audio</code>）、Vidu Q3 系列（<code>audio</code>）等可开。
            开启后写入 <code>capability.supportsAudio=true</code>，C 端模型列表透出该能力，前端展示「生成声音」开关且<strong>默认开启</strong>
            （接口另返 <code>capability.defaultGenerateAudio=true</code>）；关闭或不支持时禁止选择，后端也会拒绝 <code>generateAudio=true</code>。
            <br />
            固定无声、或文档未声明音频能力的模型请保持关闭，不要猜测开启。
          </div>
        </div>
      )}

      {/* Base64 传图：凡涉及图片传入的模型（图生图 / 图生视频 / 首尾帧 / 参考生视频）均可配置 */}
      {(modelType === 'image' || modelType === 'video') && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>Base64 传图</div>
          <Space size={12} align="center" wrap>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              官方支持 Base64 传图
              <Switch
                size="small"
                style={{ marginLeft: 6 }}
                checked={cap.supportsBase64Image === true}
                onChange={(v) => updateCap({ supportsBase64Image: v, base64ImageEnabled: v ? cap.base64ImageEnabled : false })}
              />
            </span>
            <Tooltip title={cap.supportsBase64Image ? '' : '该接口只允许 URL 传图（先按官方文档确认支持后，打开左侧「官方支持」再启用）'}>
              <span style={{ fontSize: 12, color: cap.supportsBase64Image ? '#64748b' : '#cbd5e1' }}>
                启用 Base64 传图
                <Switch
                  size="small"
                  style={{ marginLeft: 6 }}
                  disabled={cap.supportsBase64Image !== true}
                  checked={cap.base64ImageEnabled === true}
                  onChange={(v) => updateCap({ base64ImageEnabled: v })}
                />
              </span>
            </Tooltip>
          </Space>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, maxWidth: 560, lineHeight: 1.6 }}>
            两个开关都关 = 该模型走 URL 传图（默认）。<b>官方支持</b>按模型文档勾选（这是接口事实，不是随意开）：支持时右侧「启用」才可点；不支持时「启用」灰置并提示「只允许 URL 传图」。
            <br />
            打开<b>启用</b>后，系统把参考图下载转 Base64 内联下发，用于上游网关无法回源业务 CDN（如 gpt-image-2 拉不到内网图 404）的场景。当前仅 gpt-image-2、Agnes 图片系已接入 Base64 内联。
          </div>
        </div>
      )}

      {/* 场景规则 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>场景规则 sceneRules</div>
        {modelType === 'image' && (
          <>
            <div style={{ marginBottom: 4 }}><span style={{ fontSize: 12, color: '#64748b' }}>文生图 textToImage：</span>
              <Checkbox checked={cap.sceneRules.textToImage.supportsAspectRatio} onChange={(e) => updateScene('textToImage', { supportsAspectRatio: e.target.checked })}>比例</Checkbox>
              <Checkbox checked={cap.sceneRules.textToImage.supportsSizePreset} onChange={(e) => updateScene('textToImage', { supportsSizePreset: e.target.checked })}>规格</Checkbox>
            </div>
            <div><span style={{ fontSize: 12, color: '#64748b' }}>图生图 imageToImage：</span>
              <Checkbox checked={cap.sceneRules.imageToImage.supportsAspectRatio} onChange={(e) => updateScene('imageToImage', { supportsAspectRatio: e.target.checked })}>比例</Checkbox>
              <Checkbox checked={cap.sceneRules.imageToImage.supportsSizePreset} onChange={(e) => updateScene('imageToImage', { supportsSizePreset: e.target.checked })}>规格</Checkbox>
              <Checkbox checked={cap.sceneRules.imageToImage.aspectRatioFollowInput} onChange={(e) => updateScene('imageToImage', { aspectRatioFollowInput: e.target.checked })}>比例跟随输入</Checkbox>
            </div>
          </>
        )}
        {modelType === 'video' && (
          <>
            <div style={{ marginBottom: 4 }}><span style={{ fontSize: 12, color: '#64748b' }}>文生视频 textToVideo：</span>
              <Checkbox checked={cap.sceneRules.textToVideo.supportsAspectRatio} onChange={(e) => updateScene('textToVideo', { supportsAspectRatio: e.target.checked })}>比例</Checkbox>
              <Checkbox checked={cap.sceneRules.textToVideo.supportsSizePreset} onChange={(e) => updateScene('textToVideo', { supportsSizePreset: e.target.checked })}>规格</Checkbox>
              <Checkbox checked={cap.sceneRules.textToVideo.supportsDuration} onChange={(e) => updateScene('textToVideo', { supportsDuration: e.target.checked })}>时长</Checkbox>
            </div>
            <div><span style={{ fontSize: 12, color: '#64748b' }}>图生视频 imageToVideo：</span>
              <Checkbox checked={cap.sceneRules.imageToVideo.supportsAspectRatio} onChange={(e) => updateScene('imageToVideo', { supportsAspectRatio: e.target.checked })}>比例</Checkbox>
              <Checkbox checked={cap.sceneRules.imageToVideo.supportsSizePreset} onChange={(e) => updateScene('imageToVideo', { supportsSizePreset: e.target.checked })}>规格</Checkbox>
              <Checkbox checked={cap.sceneRules.imageToVideo.supportsDuration} onChange={(e) => updateScene('imageToVideo', { supportsDuration: e.target.checked })}>时长</Checkbox>
              <Checkbox checked={cap.sceneRules.imageToVideo.aspectRatioFollowInput} onChange={(e) => updateScene('imageToVideo', { aspectRatioFollowInput: e.target.checked })}>比例跟随输入</Checkbox>
            </div>
          </>
        )}
      </div>

      {/* JSON 预览 */}
      <pre style={{ background: '#f5f7fa', padding: 12, borderRadius: 8, fontSize: 11, maxHeight: 160, overflow: 'auto' }}>
        {JSON.stringify(buildCapabilityJsonObject(form, cap), null, 2)}
      </pre>

      <Modal title="粘贴 capabilityJson 应用" open={pasteOpen} onCancel={() => setPasteOpen(false)} onOk={applyPaste} width={520}>
        <Input.TextArea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={10} />
      </Modal>
    </div>
  );
}
