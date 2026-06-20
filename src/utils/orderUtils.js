/**
 * 订单状态常量与工具函数
 */

// 状态文本映射
export const STATUS_MAP = {
  '0': '待确认',
  '1': '已确认',
  '2': '待发货',
  '3': '已发货',
  '4': '已收货',
  '5': '已完成'
}

// 状态标签颜色映射
export const STATUS_TAG_MAP = {
  '0': 'info',
  '1': 'primary',
  '2': 'warning',
  '3': 'warning',
  '4': 'success',
  '5': 'success'
}

/**
 * 获取订单状态文本
 */
export function getStatusText(status) {
  return STATUS_MAP[status] || '未知'
}

/**
 * 获取订单状态标签颜色
 */
export function getStatusTag(status) {
  return STATUS_TAG_MAP[status] || 'info'
}

// ==================== 订单编号自增序列 ====================
let _orderSeq = 0
let _orderDate = ''

/**
 * 生成订单编号
 * 格式: PO + yyyyMMdd + 3位流水号
 * @param {string} [dateStr] - 日期字符串，格式 yyyy-MM-dd 或 yyyyMMdd，留空则取当天
 */
export function generateOrderNo(dateStr) {
  if (!dateStr) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    dateStr = `${y}${m}${d}`
  } else {
    dateStr = dateStr.replace(/-/g, '')
  }
  if (dateStr !== _orderDate) {
    _orderDate = dateStr
    _orderSeq = 0
  }
  _orderSeq++
  return `PO${dateStr}${String(_orderSeq).padStart(3, '0')}`
}

/**
 * 生成送货单号
 * 格式: DSH + 日期(yyyyMMdd) + 3位流水号
 */
export function generateDeliveryNo(seq) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  const seqStr = String(seq).padStart(3, '0')
  return `DSH${dateStr}${seqStr}`
}

/**
 * 生成当前时间格式化字符串
 */
export function formatNow() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}
