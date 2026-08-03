import { create } from 'zustand';

import { getAdminBrandPublic, AdminBrandConfig } from '@/api/aid/adminBrand';
import defaultLogo from '@/assets/logo/logo.png';

interface AdminBrandState extends AdminBrandConfig {
  loaded: boolean;
  loading: boolean;
  /** 登录页实际展示的 Logo（配置优先，否则内置默认） */
  resolvedLoginLogo: string;
  /** 侧栏实际展示的 Logo */
  resolvedSidebarLogo: string;
  load: () => Promise<void>;
}

const DEFAULT_FAVICON = '/favicon.ico';

/** 动态替换浏览器页签图标 */
function applyFavicon(url?: string) {
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url || DEFAULT_FAVICON;
}

/**
 * 平台品牌图片全局状态：登录页、侧栏共用平台 LOGO，并统一维护 favicon。
 * 未登录也可拉取（匿名接口），失败时回退内置默认图。
 */
export const useAdminBrandStore = create<AdminBrandState>((set, get) => ({
  platformLogoUrl: undefined,
  faviconUrl: undefined,
  loaded: false,
  loading: false,
  resolvedLoginLogo: defaultLogo,
  resolvedSidebarLogo: defaultLogo,

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res: any = await getAdminBrandPublic();
      const data: AdminBrandConfig = res?.data || {};
      const platformLogo = data.platformLogoUrl || defaultLogo;
      applyFavicon(data.faviconUrl);
      set({
        platformLogoUrl: data.platformLogoUrl,
        faviconUrl: data.faviconUrl,
        resolvedLoginLogo: platformLogo,
        resolvedSidebarLogo: platformLogo,
        loaded: true,
        loading: false
      });
    } catch {
      applyFavicon();
      set({
        platformLogoUrl: undefined,
        faviconUrl: undefined,
        resolvedLoginLogo: defaultLogo,
        resolvedSidebarLogo: defaultLogo,
        loaded: true,
        loading: false
      });
    }
  }
}));
