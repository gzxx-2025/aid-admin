import { useUserStore } from '@/store/useUserStore';

const ALL_PERM = '*:*:*';
const SUPER_ADMIN = 'admin';

/** 权限校验 hook */
export function useAuth() {
  const permissions = useUserStore((s) => s.permissions);
  const roles = useUserStore((s) => s.roles);

  const isSuperAdmin = () => roles.includes(SUPER_ADMIN);

  const hasPermi = (permission: string) => {
    if (!permission) return false;
    return permissions.some((p) => p === ALL_PERM || p === permission);
  };

  const hasPermiOr = (list: string[]) => list.some((p) => hasPermi(p));
  const hasPermiAnd = (list: string[]) => list.every((p) => hasPermi(p));

  const hasRole = (role: string) => {
    if (!role) return false;
    // 不再将 admin 视为通配符，精确匹配角色
    return roles.includes(role);
  };
  const hasRoleOr = (list: string[]) => list.some((r) => hasRole(r));
  const hasRoleAnd = (list: string[]) => list.every((r) => hasRole(r));

  return { hasPermi, hasPermiOr, hasPermiAnd, hasRole, hasRoleOr, hasRoleAnd, isSuperAdmin };
}

/** 非 hook 形式（用于路由守卫等） */
export function checkPermi(permission: string[] | string) {
  const permissions = useUserStore.getState().permissions;
  const arr = Array.isArray(permission) ? permission : [permission];
  return arr.some((p) => permissions.some((x) => x === ALL_PERM || x === p));
}

export function checkRole(role: string[] | string) {
  const roles = useUserStore.getState().roles;
  const arr = Array.isArray(role) ? role : [role];
  // 精确匹配角色，不再将 admin 视为通配符
  return arr.some((r) => roles.includes(r));
}
