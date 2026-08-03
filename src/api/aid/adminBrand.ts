import request from '@/utils/request';

export interface AdminBrandConfig {
  platformLogoUrl?: string;
  faviconUrl?: string;
}

/** 匿名拉取平台品牌图片配置（平台 LOGO / 页签图标） */
export function getAdminBrandPublic() {
  return request({
    url: '/aid/adminBrand/public',
    method: 'get',
    headers: { isToken: false, repeatSubmit: false } as any
  });
}
