import { request } from '@/utils/request'

// 查询项目提取资产列表
export function listAidcomicasset(query) {
  return request({
    url: '/aid/aidcomicasset/list',
    method: 'get',
    params: query
  })
}

// 查询项目提取资产详细
export function getAidcomicasset(id) {
  return request({
    url: '/aid/aidcomicasset/' + id,
    method: 'get'
  })
}

// 新增项目提取资产
export function addAidcomicasset(data) {
  return request({
    url: '/aid/aidcomicasset',
    method: 'post',
    data: data
  })
}

// 修改项目提取资产
export function updateAidcomicasset(data) {
  return request({
    url: '/aid/aidcomicasset',
    method: 'put',
    data: data
  })
}

// 删除项目提取资产
export function delAidcomicasset(id) {
  return request({
    url: '/aid/aidcomicasset/' + id,
    method: 'delete'
  })
}
