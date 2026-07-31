import React, { useState } from 'react';
import { Button, Input, Modal, Select, Space, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { COMMON_PROVIDERS, commonParamNamesByType } from './constants';
import { buildParamMappingJsonObject, parseParamMappingJsonToRows } from './helpers';
import type { ParamMapping } from './types';

interface Props {
  modelType?: string;
  rows: ParamMapping[];
  onChange: (rows: ParamMapping[]) => void;
}

export default function ParamMappingEditor({ modelType, rows, onChange }: Props) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const paramNames = commonParamNamesByType(modelType);
  const addRow = () => onChange([...rows, { paramName: '', provider: '', providerParamName: '' }]);
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const update = (idx: number, patch: Partial<ParamMapping>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const openPaste = () => { setPasteText(JSON.stringify(buildParamMappingJsonObject(rows), null, 2)); setPasteOpen(true); };
  const applyPaste = () => {
    try { JSON.parse(pasteText || '{}'); } catch (e: any) { message.error('JSON 不合法'); return; }
    onChange(parseParamMappingJsonToRows(pasteText));
    setPasteOpen(false);
    message.success('已应用');
  };

  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={addRow}>添加映射</Button>
        <Button size="small" icon={<EditOutlined />} onClick={openPaste}>粘贴 JSON</Button>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>统一参数 → 厂商参数</span>
      </Space>
      {rows.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', background: '#fafbfc', borderRadius: 8 }}>暂无映射</div>
      ) : rows.map((row, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <Select size="small" style={{ width: 160 }} placeholder="参数名" value={row.paramName || undefined} onChange={(v) => update(idx, { paramName: v })} options={paramNames.map((v) => ({ label: v, value: v }))} showSearch allowClear />
          <span style={{ color: '#94a3b8' }}>→</span>
          <Select size="small" style={{ width: 130 }} placeholder="厂商" value={row.provider || undefined} onChange={(v) => update(idx, { provider: v })} options={COMMON_PROVIDERS.map((v) => ({ label: v, value: v }))} showSearch allowClear />
          <Input size="small" style={{ flex: 1 }} placeholder="厂商参数名" value={row.providerParamName} onChange={(e) => update(idx, { providerParamName: e.target.value })} />
          <Button size="small" danger type="link" icon={<DeleteOutlined />} onClick={() => removeRow(idx)} />
        </div>
      ))}
      {rows.length > 0 && <pre style={{ background: '#f5f7fa', padding: 8, borderRadius: 6, fontSize: 11, maxHeight: 120, overflow: 'auto', marginTop: 8 }}>{JSON.stringify(buildParamMappingJsonObject(rows), null, 2)}</pre>}
      <Modal title="粘贴 paramMappingJson" open={pasteOpen} onCancel={() => setPasteOpen(false)} onOk={applyPaste} width={520}>
        <Input.TextArea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8} />
      </Modal>
    </div>
  );
}
