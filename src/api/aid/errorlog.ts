import { request } from '@/utils/request'

export interface ErrorLog {
  id: number
  taskId?: string
  providerCode?: string
  modelCode?: string
  httpStatus?: number
  rawMessage?: string
  matchedRuleId?: number | null
  matchedErrorCode?: string
  occurrenceCount?: number
  sampleHash?: string
  firstSeen?: string
  lastSeen?: string
}

export interface ErrorLogQueryParams {
  pageNum?: number
  pageSize?: number
  providerCode?: string
  /** true=只看未识别 */
  onlyUnmatched?: boolean
}

export function listErrorLog(params: ErrorLogQueryParams) {
  return request({ url: '/aid/errorlog/list', method: 'get', params })
}

export function getErrorLog(id: number) {
  return request<ErrorLog>({ url: `/aid/errorlog/${id}`, method: 'get' })
}
