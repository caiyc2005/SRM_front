/**
 * mock/index.js — 空占位
 *
 * 后端连通后，所有页面降级到此处的空值。
 * 数据完全由 API 提供时，删除整个 mock 目录即可。
 */

export const DEFAULT_SUPPLIERS = []
export const DEFAULT_MATERIALS = []
export function initMockOrders() { return [] }
export const deliverySeq = { value: 1 }
export const MOCK_USERS = []
export const MOCK_ROLES = []
export const MOCK_USER_ROLES = []
