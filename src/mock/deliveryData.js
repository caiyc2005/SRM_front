/**
 * mock/deliveryData.js
 *
 * 送货单模拟数据 — 后续替换为真实 API 后删除。
 */


// 如果需要再恢复



// import { DEFAULT_SUPPLIERS } from './orderData.js'

// const UNITS = ['个', '件', '套', 'KG', '米']

// export function initMockDeliveries() {
//   const data = []
//   for (let i = 1; i <= 35; i++) {
//     const supplierIndex = i % 3
//     const supplier = DEFAULT_SUPPLIERS[supplierIndex]
//     const materials = []
//     const materialNum = Math.floor(Math.random() * 3) + 1

//     for (let j = 1; j <= materialNum; j++) {
//       materials.push({
//         index: j,
//         materialCode: `M${1000 + i * 10 + j}`,
//         materialName: `物料${j}-${['电阻', '电容', '芯片', '螺丝', '外壳'][j % 5]}`,
//         spec: `规格-${j}*${i}`,
//         unit: UNITS[j % 5],
//         quantity: Math.floor(Math.random() * 500) + 50,
//         remark: j === 1 ? '常规配送' : ''
//       })
//     }

//     const isReceived = i % 3 === 0
//     const day = String(Math.floor((i - 1) / 10) + 1).padStart(2, '0')
//     const seq = String(i).padStart(3, '0')
//     data.push({
//       id: i,
//       deliveryNo: `S202406${day}${seq}`,
//       orderNo: `PO2024${String(i).padStart(4, '0')}`,
//       supplierId: supplier.id,
//       supplierCode: supplier.code,
//       supplierName: supplier.name,
//       status: isReceived ? '1' : '0',
//       materialCount: materialNum,
//       expectDate: `2024-07-${String(i % 20 + 10).padStart(2, '0')}`,
//       createTime: `2024-06-${String(i % 30).padStart(2, '0')} 09:${String(i % 60).padStart(2, '0')}:00`,
//       receiveTime: isReceived ? `2024-06-${String(i % 30 + 1).padStart(2, '0')} 14:30:00` : '',
//       operator: isReceived ? '仓管员李' : '',
//       materials
//     })
//   }
//   return data
// }

/* API 连通后，降级到此空函数 */
export function initMockDeliveries() { return [] }
