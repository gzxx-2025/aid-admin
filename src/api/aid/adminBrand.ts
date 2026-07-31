import request from '@/utils/request';

export interface AdminBrandConfig {
  loginLogoUrl?: string;
  sidebarLogoUrl?: string;
  faviconUrl?: string;
}

/** 匿名拉取后台品牌图片配置（登录页 / 侧栏 / 页签图标） */
export function getAdminBrandPublic() {
  return request({
    url: '/aid/adminBrand/public',
    method: 'get',
    headers: { isToken: false, repeatSubmit: false } as any
  });
}
