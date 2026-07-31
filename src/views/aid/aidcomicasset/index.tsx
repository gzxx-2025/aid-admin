import React from 'react';
import { Tag } from 'antd';
import CrudPage, { type CrudConfig, type EmbeddedScope, scopedConfig } from '@/components/CrudPage';
import {
  listAidcomicasset, getAidcomicasset, addAidcomicasset, updateAidcomicasset, delAidcomicasset
} from '@/api/aid/aidcomicasset';
import { ASSET_TYPE_OPTIONS, getLabelByValue } from '@/utils/enums';

const config: CrudConfig = {
  title: '项目提取资产',
  permPrefix: 'aid:aidcomicasset',
  rowKey: 'id',
  viewable: true,
  modalWidth: 720,
  api: {
    list: listAidcomicasset,
    get: getAidcomicasset,
    add: addAidcomicasset,
    update: updateAidcomicasset,
    remove: delAidcomicasset,
    exportUrl: '/aid/aidcomicasset/export'
  },
  searchFields: [
    { name: 'assetName', label: '资产名称', type: 'input' },
    { name: 'assetType', label: '资产类型', type: 'select', options: ASSET_TYPE_OPTIONS }
  ],
  columns: [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '资产类型', dataIndex: 'assetType', width: 110, render: (v: string) => <Tag>{getLabelByValue(ASSET_TYPE_OPTIONS, v)}</Tag> },
    { title: '名称', dataIndex: 'assetName', width: 160, ellipsis: true },
    { title: '主图', dataIndex: 'imageUrl', width: 80, render: (v: string) => v ? <img src={v} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} /> : '-' },
    { title: '创建时间', dataIndex: 'createTime', dateFormat: true, width: 160 }
  ],
  formFields: [
    { name: 'assetType', label: '资产类型', type: 'select', options: ASSET_TYPE_OPTIONS, required: true },
    { name: 'assetName', label: '资产名称', required: true, maxLength: 100 },
    { name: 'personalityDesc', label: '性格/特征描述', type: 'textarea', span: 24 },
    { name: 'promptText', label: '提示词', type: 'textarea', span: 24 },
    { name: 'imageUrl', label: '主图', type: 'image', span: 24 },
    { name: 'remark', label: '备注', type: 'textarea', span: 24 }
  ]
};

export default function Page({ scope }: { scope?: EmbeddedScope } = {}) {
  return <CrudPage config={scopedConfig(config, scope)} />;
}
