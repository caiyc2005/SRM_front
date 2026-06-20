/**
 * mock/userData.js
 *
 * 模拟用户数据 — 登录验证用。
 * 后续接入后端后，改为调用 /api/login 接口验证。
 */

export const MOCK_USERS = [
  {
    id: 'USR001',
    userCode: 'admin',
    userName: 'admin',
    password: 'password',
    roles: ['仓管员']
  },
  {
    id: 'USR002',
    userCode: 'buyer',
    userName: '采购员',
    password: 'password',
    roles: ['采购员']
  },
  {
    id: 'USR003',
    userCode: 'supplier',
    userName: '供应商',
    password: 'password',
    roles: ['供应商']
  }
]
