import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
  useNavigate,
  Outlet
} from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

import { getToken } from '@/utils/auth';
import { getAdminEntryStatus, verifyAdminEntry } from '@/api/aid/adminEntry';
import { useUserStore } from '@/store/useUserStore';
import { usePermissionStore } from '@/store/usePermissionStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAdminBrandStore } from '@/store/useAdminBrandStore';
import { isPathMatch } from '@/utils/validate';

import MainLayout from '@/layouts/MainLayout';
import {
  LoginPage,
  RegisterPage,
  NotFoundPage,
  UnauthorizedPage,
  RedirectPage,
  DashboardPage,
  ProfilePage
} from './constants';
import LoadingFallback from './components/LoadingFallback';
import DynamicRouteRenderer from './components/DynamicRouteRenderer';

NProgress.configure({ showSpinner: false });

const JobLogPage = lazy(() => import('@/views/monitor/job/log'));

const WHITE_LIST = ['/login', '/register', '/404', '/401'];

function isWhite(path: string) {
  return WHITE_LIST.some((p) => isPathMatch(p, path));
}

/** 缓存入口启用状态（一次性拉取；失败按未启用，避免误锁死登录入口） */
let _entryEnabled: boolean | null = null;
let _entryPromise: Promise<boolean> | null = null;
function ensureEntryEnabled(): Promise<boolean> {
  if (_entryEnabled !== null) return Promise.resolve(_entryEnabled);
  if (!_entryPromise) {
    _entryPromise = getAdminEntryStatus()
      .then((r: any) => {
        _entryEnabled = !!(r?.enabled ?? r?.data?.enabled);
        return _entryEnabled;
      })
      .catch(() => {
        _entryEnabled = false;
        return false;
      });
  }
  return _entryPromise;
}

/**
 * 根守卫：
 *  - 无 token 且不在白名单 → 跳转 /login
 *  - 有 token 访问 /login → 跳转 /
 *  - 有 token 首次进入 → 拉取用户信息 + 生成动态路由
 */
function RootGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const setTitle = useSettingsStore((s) => s.setTitle);
  const siteName = useAdminBrandStore((s) => s.resolvedSiteName);
  const brandLoaded = useAdminBrandStore((s) => s.loaded);
  const loadBrand = useAdminBrandStore((s) => s.load);

  const token = useUserStore((s) => s.token);
  const roles = useUserStore((s) => s.roles);
  const fetchInfo = useUserStore((s) => s.fetchInfo);
  const logoutUser = useUserStore((s) => s.logout);
  const generateRoutes = usePermissionStore((s) => s.generateRoutes);
  const routesLoaded = usePermissionStore((s) => s.loaded);

  // 未登录时先进入"门禁校验中"状态，避免在校验前闪出登录页
  const [gateChecking, setGateChecking] = useState(!getToken());
  // 启用随机入口且访问码校验通过时，直接在 /<访问码> 地址渲染登录页（不跳转 /login）
  const [secretLogin, setSecretLogin] = useState(false);

  useEffect(() => {
    if (!brandLoaded) loadBrand();
  }, [brandLoaded, loadBrand]);

  useEffect(() => {
    NProgress.start();
    const path = location.pathname;
    const hasToken = !!getToken();

    if (!hasToken) {
      (async () => {
        try {
          const enabled = await ensureEntryEnabled();
          // 未启用随机入口：保持原有行为
          if (!enabled) {
            setSecretLogin(false);
            if (!isWhite(path)) {
              navigate(`/login?redirect=${encodeURIComponent(path + location.search)}`, { replace: true });
            }
            setGateChecking(false);
            return;
          }
          // 启用随机入口：登录页只在 /<访问码> 地址本身渲染；/login 与根路径一律挡到 404
          if (path === '/404' || path === '/401' || path === '/register' || path.startsWith('/redirect')) {
            setSecretLogin(false);
            setGateChecking(false);
            return;
          }
          if (path === '/login') {
            setSecretLogin(false);
            navigate('/404', { replace: true });
            return;
          }
          const seg = path.replace(/^\/+/, '').split('/')[0];
          if (!seg) {
            setSecretLogin(false);
            navigate('/404', { replace: true });
            return;
          }
          const res: any = await verifyAdminEntry(seg);
          if (res?.valid ?? res?.data?.valid) {
            // 校验通过：记下访问码（供 /login 请求头携带），并在当前 /<访问码> 地址直接渲染登录页，
            // 不跳转 /login，避免留下可复用入口
            try {
              sessionStorage.setItem('adminEntryCode', seg);
            } catch {
              /* ignore storage error */
            }
            setSecretLogin(true);
            setGateChecking(false);
          } else {
            setSecretLogin(false);
            navigate('/404', { replace: true });
          }
        } finally {
          NProgress.done();
        }
      })();
      return;
    }

    // 已登录
    setSecretLogin(false);
    setGateChecking(false);
    if (path === '/login') {
      navigate('/', { replace: true });
      NProgress.done();
      return;
    }

    if (isWhite(path)) {
      NProgress.done();
      return;
    }

    (async () => {
      try {
        if (roles.length === 0) {
          await fetchInfo();
          await generateRoutes();
        } else if (!routesLoaded) {
          await generateRoutes();
        }
      } catch (e) {
        await logoutUser();
        navigate('/login', { replace: true });
      } finally {
        NProgress.done();
      }
    })();

    return () => {
      NProgress.done();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 平台名称来自后台专用品牌接口，不能复用 C 端公开配置接口
  useEffect(() => {
    const title = `${siteName} 管理系统`;
    document.title = title;
    setTitle(title);
  }, [setTitle, siteName]);

  if (gateChecking) {
    return <LoadingFallback />;
  }

  // 启用随机入口且访问码校验通过：在 /<访问码> 地址直接渲染登录页（仅未登录时）
  if (secretLogin && !getToken()) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Outlet />
    </Suspense>
  );
}

// 路由 basename 跟随构建时的部署上下文路径（生产 /admin/，开发 /）
const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootGuard />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: '404', element: <NotFoundPage /> },
      { path: '401', element: <UnauthorizedPage /> },
      { path: 'redirect/*', element: <RedirectPage /> },
      {
        path: '',
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/index" replace /> },
          {
            path: 'index',
            element: <DashboardPage />,
            handle: { title: '首页', icon: 'dashboard', affix: true, name: 'Index' }
          },
          {
            path: 'user/profile',
            element: <ProfilePage />,
            handle: { title: '个人中心', icon: 'user', name: 'Profile' }
          },
          {
            path: 'monitor/job-log/index/:jobId',
            element: <JobLogPage />,
            handle: { title: '调度日志', name: 'JobLog' }
          },
          // 动态路由占位：支持无限层级的后端路由
          { path: '*', element: <DynamicRouteRenderer /> }
        ]
      }
    ]
  }
], { basename: routerBasename });

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
