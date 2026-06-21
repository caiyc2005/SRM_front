/**
 * mock/orderData.js
 *
 * 模拟数据 — 后续替换为真实 API 时，只需删掉这个文件，
 * 改为从后端接口获取数据即可。
 *
 * 字段名与后端数据库模型保持一致。
 */

import { generateOrderNo } from '@/utils/orderUtils'

// ==================== 供应商 ====================
export const DEFAULT_SUPPLIERS = [
  { supplierID:'S005', supplierCode:'SUP-005', supplierName:'宏盛钢材有限公司', },
  { supplierID: '1', supplierCode: 'HZ001', supplierName: '杭州电子科技有限公司' },
  { supplierID: '2', supplierCode: 'SZ002', supplierName: '深圳五金制品厂' },
  { supplierID: '3', supplierCode: 'SH003', supplierName: '上海塑胶材料有限公司' }
]

// ==================== 物料 ====================
export const DEFAULT_MATERIALS = [
  {materialID:'M001', materialCode:'MAT-007', materialName:'不锈钢板', spec:'304 2B 1.0mm', unit:'平方米', isDel: false,memo: '冷轧不锈钢'},
  { materialID: 'M0011', materialCode: 'MC-001', materialName: '贴片电阻', spec: '10KΩ ±1% 0603', unit: '个', isDel: false, memo: '通用贴片电阻' },
  { materialID: 'M002', materialCode: 'MC-002', materialName: '电解电容', spec: '100μF 16V', unit: '个', isDel: false, memo: '铝电解电容' },
  { materialID: 'M003', materialCode: 'MC-003', materialName: 'LED灯珠', spec: '5050 RGB', unit: '个', isDel: false, memo: '全彩LED' },
  { materialID: 'M004', materialCode: 'MC-004', materialName: '排针', spec: '2×20P 2.54mm', unit: '个', isDel: false, memo: '直插排针' },
  { materialID: 'M005', materialCode: 'MC-005', materialName: '杜邦线', spec: '28AWG 10cm 母对母', unit: '根', isDel: false, memo: '面包板连接线' },
  { materialID: 'M006', materialCode: 'MC-006', materialName: 'PCB板', spec: 'FR-4 5×5cm 双面', unit: '片', isDel: false, memo: '打样测试用PCB' },
  { materialID: 'M007', materialCode: 'MC-007', materialName: '热缩管', spec: 'φ3mm 黑色 1米', unit: '根', isDel: false, memo: '绝缘热缩管' },
  { materialID: 'M008', materialCode: 'MC-008', materialName: '晶振', spec: '8MHz HC-49S', unit: '个', isDel: false, memo: '无源晶振' },
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
      const unitPrice = Number((Math.random() * 50 + 10).toFixed(2))
      const qty = Math.floor(Math.random() * 50) + 10
      const amount = Number((unitPrice * qty).toFixed(2))
      totalAmount += amount
      materials.push({
        index: j,
        materialCode: `M${1000 + i * 10 + j}`,
        materialName: `物料${j}`,
        spec: '标准规格',
        qty: qty,
        unitPrice: unitPrice,
        amount: amount
      })
    }

    const day = String(i % 30 + 1).padStart(2, '0')
    const createDate = `2024-06-${day}`

    data.push({
      orderID: String(i),
      orderCode: generateOrderNo(createDate),
      supplierID: String(i % 3 + 1),
      supplierName: suppliers[i % 3].supplierName,
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
