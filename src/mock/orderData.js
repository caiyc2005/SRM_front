/**
 * mock/orderData.js
 *
 * 模拟数据 — 后续替换为真实 API 时，只需删掉这个文件，
 * 改为从后端接口获取数据即可。
 */

import { generateOrderNo } from '@/utils/orderUtils'

// ==================== 供应商 ====================
export const DEFAULT_SUPPLIERS = [
  { id: 1, code: 'HZ001', name: '杭州电子科技有限公司' },
  { id: 2, code: 'SZ002', name: '深圳五金制品厂' },
  { id: 3, code: 'SH003', name: '上海塑胶材料有限公司' }
]

// ==================== 共享订单实例（模拟数据库） ====================
let _sharedOrders = null

// ==================== 初始化模拟订单 ====================
export function initMockOrders(suppliers) {
  // 首次创建后后续页面共享同一份数据
  if (_sharedOrders && _sharedOrders.length > 0) {
    return _sharedOrders
  }

  const data = []
  for (let i = 1; i <= 50; i++) {
    const materials = []
    let totalAmount = 0
    const materialNum = Math.floor(Math.random() * 3) + 1

    for (let j = 1; j <= materialNum; j++) {
      const price = (Math.random() * 50 + 10).toFixed(2)
      const qty = Math.floor(Math.random() * 50) + 10
      const amount = (price * qty).toFixed(2)
      totalAmount += Number(amount)
      materials.push({
        index: j,
        materialCode: `M${1000 + i * 10 + j}`,
        materialName: `物料${j}`,
        spec: '标准规格',
        quantity: qty,
        price: price,
        amount: amount
      })
    }

    const day = String(i % 30 + 1).padStart(2, '0')
    const createDate = `2024-06-${day}`

    data.push({
      id: i,
      orderNo: generateOrderNo(createDate),
      supplierId: i % 3 + 1,
      supplierName: suppliers[i % 3].name,
      status: String(i % 6),
      materialCount: materialNum,
      totalAmount: totalAmount.toFixed(2),
      deliveryDate: `2024-07-${String(i % 20 + 10).padStart(2, '0')}`,
      createTime: `${createDate} 10:00:00`,
      materials: materials,
      deliveryNo: ''
    })
  }

  _sharedOrders = data
  return data
}

// ==================== 送货单流水号 ====================
export const deliverySeq = { value: 1 }
