/**
 * mock/userData.js
 *
 * 模拟用户/角色数据 — 登录验证、用户管理、角色管理。
 * 后端可用时自动切换为 API 数据，后端不可用时降级到此模拟数据。
 */

// ==================== 用户（登录 + 用户管理） ====================
export const MOCK_USERS = [
  { id: 'USR001', userCode: 'admin', userName: 'admin', password: 'password', roles: ['管理员', 'admin'], isDel: false, memo: '系统管理员' },
  { id: 'USR002', userCode: 'buyer', userName: '采购员', password: 'password', roles: ['采购员'], isDel: false, memo: '' },
  { id: 'USR003', userCode: 'supplier', userName: '供应商', password: 'password', roles: ['供应商'], isDel: false, memo: '' },
  { id: 'USR004', userCode: 'manager', userName: '仓库经理', password: 'password', roles: ['仓管员'], isDel: false, memo: '' },
  { id: 'USR005', userCode: 'auditor', userName: '审计员', password: 'password', roles: ['审计员'], isDel: true, memo: '已离职' }
]

// ==================== 角色（角色管理） ====================
export const MOCK_ROLES = [
  { roleID: 'R001', roleName: '仓管员', isDel: false, memo: '仓库日常管理' },
  { roleID: 'R002', roleName: '采购员', isDel: false, memo: '采购订单管理' },
  { roleID: 'R003', roleName: '供应商', isDel: false, memo: '供应商用户' },
  { roleID: 'R004', roleName: '审计员', isDel: true, memo: '已停用' },
  { roleID: 'R005', roleName: '管理员', isDel: false, memo: '系统管理' }
]

// ==================== 用户-角色关联（权限分配） ====================
export const MOCK_USER_ROLES = [
  { id: 'UR001', userID: 'USR001', roleID: 'R001' },
  { id: 'UR002', userID: 'USR001', roleID: 'R005' },
  { id: 'UR003', userID: 'USR002', roleID: 'R002' },
  { id: 'UR004', userID: 'USR003', roleID: 'R003' },
  { id: 'UR005', userID: 'USR004', roleID: 'R001' },
  { id: 'UR006', userID: 'USR005', roleID: 'R004' }
]
