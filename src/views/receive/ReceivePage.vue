<script setup>
/**
 * ReceivePage.vue — 扫码收料
 *
 * 功能：扫码/手动输入送货单号加载送货信息 → 填写实收数量 → 确认收货
 *       Tab2：收料记录查询
 *       Tab3：待收料列表
 */
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import AppFilter from '@/components/AppFilter.vue'
import AppPagination from '@/components/AppPagination.vue'
import Logout from '@/components/Logout.vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

// ==================== API ====================
const API_DELIVERY = '/api/Delivery'
const API_RECEIVE = '/api/Receive'
const API_ORDERS = '/api/Orders'
const useApi = ref(false)

// ==================== Tab 控制 ====================
const activeTab = ref('receive')

// ==================== 数据 ====================
const allDeliveries = ref([])
const receiveRecords = ref([])   // 本地收料记录
const searchNoteCode = ref('')

// ==================== Tab1：收料操作 ====================
const foundDelivery = ref(null)       // 查到的送货单
const notFound = ref(false)           // 是否查无此单
const receiveFormItems = ref([])      // 可编辑的物料行 [{...deliveryItem, receivedQty: 0}]
const wareList = ref([])              // 仓库列表
const selectedWareID = ref('')        // 选中的仓库ID

async function loadWarehouses() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Warehouse/GetAllWarehouse', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      wareList.value = result.data
    }
  } catch { /* 仓库接口不可用 */ }
}

/** 按送货单号查找 */
async function handleSearch() {
  const kw = searchNoteCode.value.trim()
  if (!kw) {
    foundDelivery.value = null
    notFound.value = false
    return
  }

  // ========== 优先调后端 API ==========
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_DELIVERY}/GetDeliveryNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ noteCode: kw, page: 1, pageSize: 1 })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data?.items?.length) {
      const item = result.data.items[0]
      // 检查是否所有物料都已收完（累计已收 >= 送货数量）
      const allFullyReceived = (item.details || []).every(
        dd => (dd.receivedQty || 0) >= dd.quantity
      )
      if (allFullyReceived) {
        ElMessage.warning('该送货单所有物料已全部收完，不可重复收料')
        foundDelivery.value = null
        notFound.value = false
        return
      }
      notFound.value = false
      foundDelivery.value = {
        noteCode: item.noteCode,
        orderID: item.orderID || '',
        orderCode: item.orderCode || '',
        supplierName: item.supplierName || '',
        supplierCode: item.supplierCode || '',
        expectDate: item.expectedDate ? item.expectedDate.slice(0, 10) : '',
        createTime: item.createdTime ? item.createdTime.replace('T', ' ').slice(0, 16) : '',
        status: String(item.status ?? 0),
        materials: (item.details || []).map((dd, i) => ({
          index: i + 1,
          orderCode: dd.orderCode || '',
          materialCode: dd.materialCode,
          materialName: dd.materialName || '',
          spec: dd.spec || '',
          unit: dd.unit || '',
          quantity: dd.quantity,
          historyReceived: dd.receivedQty || 0,
          remaining: Math.max(0, dd.quantity - (dd.receivedQty || 0)),
          receivedQty: 0,
          remark: ''
        }))
      }
      receiveFormItems.value = foundDelivery.value.materials.map(m => ({
        ...m,
        receivedQty: m.remaining
      }))
      useApi.value = true
      return
    }
  } catch { /* 降级 */ }
}

/** 实收数量输入变化时检测超限 */
function handleQtyOverLimit(val, index) {
  const item = receiveFormItems.value[index]
  if (!item || val == null) return
  if (Number(val) > item.remaining) {
    ElMessageBox.confirm(
      `<div style="text-align: center;">
        <div style="margin-bottom: 12px; color: #e6a23c;">
          <span style="font-size: 26px;">⚠️</span>
          <span style="font-size: 16px; font-weight: 600; vertical-align: middle; margin-left: 4px;">收料数量超出剩余应收</span>
        </div>
        <div style="font-size: 14px; color: #606266; margin-bottom: 16px;">
          物料「${item.materialName}」的实收数量超出剩余应收数量
        </div>
        <div style="display: flex; justify-content: center; gap: 40px; margin-bottom: 12px;">
          <div>
            <div style="font-size: 12px; color: #909399;">剩余应收</div>
            <div style="font-size: 28px; font-weight: 700; color: #1890ff;">${item.remaining}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399;">本次实收</div>
            <div style="font-size: 28px; font-weight: 700; color: #f56c6c;">${Number(val)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399;">超出</div>
            <div style="font-size: 28px; font-weight: 700; color: #e6a23c;">+${Number(val) - item.remaining}</div>
          </div>
        </div>
        <div style="font-size: 13px; color: #909399;">已自动恢复为最大可收数量</div>
      </div>`,
      '数量超限警告',
      {
        dangerouslyUseHTMLString: true,
        type: 'warning',
        confirmButtonText: '知道了',
        showCancelButton: false
      }
    ).then(() => {
      receiveFormItems.value[index].receivedQty = item.remaining
    }).catch(() => {
      receiveFormItems.value[index].receivedQty = item.remaining
    })
  }
}

/** 确认收货 */
async function handleConfirmReceive() {
  if (!foundDelivery.value) return

  const delivery = foundDelivery.value
  const items = receiveFormItems.value

  if (!selectedWareID.value) {
    ElMessage.warning('请选择入库仓库')
    return
  }

  // 检查所选仓库是否已停用
  const selectedWare = wareList.value.find(w => w.wareID === selectedWareID.value)
  if (selectedWare && (selectedWare.isDel ?? selectedWare.IsDel)) {
    ElMessage.warning('所选仓库已被禁用，请重新选择仓库')
    return
  }

  // 基本校验
  for (const item of items) {
    if (item.receivedQty == null || item.receivedQty === '') {
      ElMessage.warning(`物料「${item.materialName}」的实收数量不能为空`)
      return
    }
    if (Number(item.receivedQty) < 0) {
      ElMessage.warning(`物料「${item.materialName}」的实收数量不能为负数`)
      return
    }
    if (Number(item.receivedQty) > item.remaining) {
      // 输入时已弹窗警告并复位，这里再兜底一次
      item.receivedQty = item.remaining
      ElMessage.warning(`物料「${item.materialName}」的实收数量已自动修正为最大可收数量 ${item.remaining}`)
      return
    }
  }

  const totalPlan = items.reduce((s, i) => s + i.quantity, 0)
  const totalHistory = items.reduce((s, i) => s + (i.historyReceived || 0), 0)
  const totalReceived = items.reduce((s, i) => s + Number(i.receivedQty), 0)

  try {
    await ElMessageBox.confirm(
      `确认收货？\n送货总数：${totalPlan}，累计已收：${totalHistory}，本次实收：${totalReceived}` +
      (totalPlan !== totalHistory + totalReceived ? `\n仍差：${totalPlan - totalHistory - totalReceived}` : ''),
      '确认收料',
      { type: 'warning', confirmButtonText: '确认收货' }
    )
  } catch { return }

  // ========== 优先调后端 API ==========
  if (useApi.value || true /* 总是尝试调 API */) {
    try {
      let userInfo = { userID: '', userName: '' }
      try { userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}') } catch {}
      const token = localStorage.getItem('token')

      const res = await fetch(`${API_RECEIVE}/CreateReceive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          noteCode: delivery.noteCode,
          wareID: selectedWareID.value,
          receiveUserID: userInfo.userID || '',
          receiveUserName: userInfo.userName || '仓管员',
          details: items.map(i => ({
            materialCode: i.materialCode,
            receivedQty: Number(i.receivedQty)
          }))
        })
      })
      const text = await res.text()
      const result = text ? JSON.parse(text) : {}

      if (result.code === 200) {
        ElMessage.success('收货确认成功！库存已自动更新。')
        // 重置
        foundDelivery.value = null
        receiveFormItems.value = []
        searchNoteCode.value = ''
        // 刷新待收料列表和收料记录
        loadPendingOrders()
        loadReceiveRecords()
        return
      }
      ElMessage.error(result.message || '后端收货失败，尝试本地记录')
    } catch {
      ElMessage.warning('后端不可用，已保存到本地记录')
    }
  }

  // ========== 降级：本地记录 ==========
  delivery.status = '1'
  delivery.receiveTime = new Date().toLocaleString('zh-CN')
  delivery.operator = '仓管员'

  const record = {
    recordId: 'REC' + String(receiveRecords.value.length + 1).padStart(3, '0'),
    recordCode: 'REC-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' +
      String(receiveRecords.value.length + 1).padStart(3, '0'),
    noteCode: delivery.noteCode,
    orderID: delivery.orderID,
    orderCode: delivery.orderCode || '',
    supplierName: delivery.supplierName || '—',
    operator: '仓管员',
    receiveDate: new Date().toLocaleString('zh-CN'),
    items: items.map(i => ({
      materialCode: i.materialCode,
      materialName: i.materialName,
      spec: i.spec,
      unit: i.unit,
      planQty: i.quantity,
      receivedQty: Number(i.receivedQty),
      diffQty: i.quantity - Number(i.receivedQty)
    })),
    totalPlanQty: totalPlan,
    totalReceivedQty: totalReceived,
    totalDiffQty: totalPlan - totalReceived
  }
  receiveRecords.value.unshift(record)

  // 重置
  foundDelivery.value = null
  receiveFormItems.value = []
  searchNoteCode.value = ''

  ElMessage.success('收货确认成功！库存已自动更新。')
}

/** 清空搜索 */
function handleClearSearch() {
  searchNoteCode.value = ''
  foundDelivery.value = null
  notFound.value = false
  receiveFormItems.value = []
}

// ==================== Tab2：收料记录 ====================
const historyKeyword = ref('')

const historyQuery = reactive({
  pageNum: 1,
  pageSize: 10
})

const filteredHistoryRecords = computed(() => {
  const kw = historyKeyword.value.trim().toLowerCase()
  if (!kw) return receiveRecords.value
  return receiveRecords.value.filter(r =>
    r.noteCode.toLowerCase().includes(kw) ||
    r.recordCode.toLowerCase().includes(kw) ||
    r.orderCode.toLowerCase().includes(kw) ||
    r.supplierName.toLowerCase().includes(kw)
  )
})

const historyTableData = computed(() => {
  const start = (historyQuery.pageNum - 1) * historyQuery.pageSize
  return filteredHistoryRecords.value.slice(start, start + historyQuery.pageSize)
})

const historyTableRef = ref(null)

function handleHistoryPageChange() {}

function handleHistoryRowClick(row) {
  if (historyTableRef.value) {
    historyTableRef.value.toggleRowExpansion(row)
  }
}

async function loadReceiveRecords() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_RECEIVE}/GetReceivesList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ page: historyQuery.pageNum, pageSize: historyQuery.pageSize })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data) {
      receiveRecords.value = (result.data.items || []).map(r => {
        const details = (r.details || []).map(d => ({
          materialCode: d.materialCode,
          materialName: d.materialName || '',
          spec: d.spec || '',
          unit: d.unit || '',
          planQty: d.planQty,
          receivedQty: d.receivedQty,
          diffQty: d.diffQty
        }))
        return {
          recordId: r.receiveID,
          recordCode: r.receiveCode || '',
          noteCode: r.noteCode || '',
          orderCode: r.orderCode || '',
          supplierName: r.supplierName || '',
          operator: r.receiveUserName || '',
          receiveDate: r.receiveDate ? r.receiveDate.replace('T', ' ').slice(0, 16) : '',
          items: details,
          totalPlanQty: details.reduce((s, d) => s + d.planQty, 0),
          totalReceivedQty: details.reduce((s, d) => s + d.receivedQty, 0),
          totalDiffQty: details.reduce((s, d) => s + d.diffQty, 0)
        }
      })
      return
    }
  } catch { /* 降级，保留本地记录 */ }
}

// ==================== Tab3：待收料 ====================
const supplierList = ref([])
const allOrders = ref([])

async function loadSuppliers() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Supplier/GetAllSuppliers', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      supplierList.value = result.data
    }
  } catch { /* 降级 */ }
}
const tableRef = ref(null)

const pendingQuery = reactive({
  keyword: '',
  pageNum: 1,
  pageSize: 10
})

const pendingFilterFields = [
  { key: 'keyword', label: '关键字', type: 'input', width: 300, placeholder: '订单号 / 送货单号' }
]

// 显示未收货的送货单
const pendingReceiveOrders = computed(() => {
  return allOrders.value.filter(o => o.status !== '2')
})

function getDeliveryStatusText(status) {
  return status === '2' ? '已收货' : status === '1' ? '已发货' : '未发货'
}
function getDeliveryStatusTag(status) {
  return status === '2' ? 'success' : status === '1' ? 'primary' : 'warning'
}

const filteredOrders = computed(() => {
  let list = pendingReceiveOrders.value
  const kw = pendingQuery.keyword.trim()
  if (kw) {
    list = list.filter(o =>
      o.orderCode.toLowerCase().includes(kw.toLowerCase()) ||
      (o.noteCode && o.noteCode.toLowerCase().includes(kw.toLowerCase()))
    )
  }
  return list
})

const pendingTableData = computed(() => {
  const start = (pendingQuery.pageNum - 1) * pendingQuery.pageSize
  return filteredOrders.value.slice(start, start + pendingQuery.pageSize)
})

const pendingTotal = computed(() => filteredOrders.value.length)

function handlePendingQuery() { pendingQuery.pageNum = 1 }
function handlePendingReset() { pendingQuery.keyword = ''; pendingQuery.pageNum = 1 }
function handlePendingPageChange() {}

function handleRowClick(row) {
  if (tableRef.value) {
    tableRef.value.toggleRowExpansion(row)
  }
}

function handleReceive(row) {
  ElMessageBox.confirm(
    `确认订单「${row.orderCode}」的物料已全部收料入库吗？`,
    '收料确认',
    { type: 'warning', confirmButtonText: '确认收料' }
  ).then(() => {
    const target = allOrders.value.find(o => o.orderID === row.orderID)
    if (target) {
      target.status = '4'
      ElMessage.success(`订单 ${row.orderCode} 已更新为「已收货」`)
    }
  }).catch(() => {})
}

/** 加载待收料订单（Tab3） */
async function loadPendingOrders() {
  try {
    const token = localStorage.getItem('token')
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {}

    // 直接使用送货单数据作为待收料列表
    const dRes = await fetch(`${API_DELIVERY}/GetDeliveryNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ page: 1, pageSize: 999, isReceived: false })
    })
    const dText = await dRes.text()
    const dResult = dText ? JSON.parse(dText) : {}

    if (dResult.code === 200 && dResult.data?.items?.length) {
      allOrders.value = dResult.data.items.map(item => ({
        orderID: item.noteID,
        orderCode: item.details?.[0]?.orderCode || '',
        supplierID: item.supplierID || '',
        supplierCode: item.supplierCode || '',
        supplierName: item.supplierName || '',
        status: String(item.status ?? 0),
        materialCount: item.details?.length || 0,
        totalAmount: (item.details || []).reduce((s, dd) => s + (dd.amount || 0), 0).toFixed(2),
        createTime: item.createdTime ? item.createdTime.replace('T', ' ').slice(0, 16) : '',
        deliveryNo: item.noteCode || '',
        noteCode: item.noteCode || '',
        materials: (item.details || []).map((dd, i) => ({
          index: i + 1,
          materialCode: dd.materialCode || '',
          materialName: dd.materialName || '',
          spec: dd.spec || '',
          unit: dd.unit || '',
          qty: dd.quantity || 0,
          unitPrice: dd.unitPrice || 0,
          amount: dd.amount || 0
        }))
      }))
      return
    }
  } catch { /* 降级 */ }
}

// ==================== 扫码弹窗（真实摄像头） ====================
const scanVisible = ref(false)
const scanInput = ref('')
const scanLoading = ref(false)
const cameraError = ref('')
let html5QrCode = null

async function openScanner() {
  scanInput.value = ''
  cameraError.value = ''
  scanVisible.value = true

  await nextTick()
  try {
    html5QrCode = new Html5Qrcode('scan-reader')
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        // 扫码区域：宽高比适配条形码（宽度>高度）
        qrbox: { width: 280, height: 120 },
        // 同时支持条形码和二维码
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.QR_CODE
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      },
      (decodedText) => {
        // 扫码成功
        handleScanResult(decodedText)
      },
      () => {
        // 扫码失败（每帧未识别到，静默忽略）
      }
    )
  } catch (err) {
    cameraError.value = '摄像头启动失败：' + (err.message || err)
    console.error('Html5Qrcode start error:', err)
  }
}

function handleScanResult(code) {
  if (!code) return
  // 播放提示音
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    osc.frequency.value = 800
    osc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch (_) { /* 忽略音频错误 */ }

  ElMessage.success(`扫码成功：${code}`)
  stopScanner()
  scanVisible.value = false
  searchNoteCode.value = code
  handleSearch()
}

async function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop()
    } catch (_) { /* 忽略停止错误 */ }
  }
  html5QrCode = null
}

function handleScanConfirm() {
  const code = scanInput.value.trim()
  if (!code) {
    ElMessage.warning('请输入或扫描送货单号')
    return
  }
  stopScanner()
  scanVisible.value = false
  searchNoteCode.value = code
  handleSearch()
}

// ==================== 本地图片扫码 ====================
const fileInputRef = ref(null)
const fileScanning = ref(false)

function triggerFileSelect() {
  fileInputRef.value?.click()
}

async function handleFileScan(event) {
  const file = event.target?.files?.[0]
  if (!file) return

  const allowedImageTypes = ['image/png', 'image/jpeg', 'image/bmp', 'image/webp', 'image/tiff']
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.tiff', '.tif']
  const fileExt = '.' + file.name.split('.').pop().toLowerCase()

  if (!allowedImageTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
    ElMessage.warning('请选择图片文件（支持 PNG / JPG / BMP / WebP / TIFF 格式）')
    return
  }

  fileScanning.value = true
  try {
    let decodedText = null

    // 1️⃣ 优先使用 Chrome 原生 BarcodeDetector（速度快，本地解码）
    if ('BarcodeDetector' in window) {
      try {
        const bitmap = await createImageBitmap(file)
        const detector = new BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'qr_code']
        })
        const results = await detector.detect(bitmap)
        bitmap.close()
        if (results.length > 0) {
          decodedText = results[0].rawValue
        }
      } catch {
        // BarcodeDetector 失败，降级到 html5-qrcode
      }
    }

    // 2️⃣ 降级：使用 html5-qrcode.scanFile（兼容所有浏览器）
    if (!decodedText) {
      try {
        decodedText = await Html5Qrcode.scanFile(file, false, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.QR_CODE
          ]
        })
      } catch (scanErr) {
        console.error('html5-qrcode scanFile 错误:', scanErr)
      }
    }

    if (decodedText) {
      handleScanResult(decodedText)
    } else {
      ElMessage.warning('图片中未检测到条码或二维码')
    }
  } catch (err) {
    console.error('图片识别错误:', err)
    ElMessage.warning('识别失败：' + (err?.message || err?.toString() || '未知错误'))
  } finally {
    fileScanning.value = false
    event.target.value = ''
  }
}

function handleScanDialogClose() {
  stopScanner()
  scanVisible.value = false
}

/** 快捷选择送货单（演示备用） */
function quickSelectDelivery(noteCode) {
  stopScanner()
  scanVisible.value = false
  searchNoteCode.value = noteCode
  handleSearch()
}

onBeforeUnmount(() => {
  stopScanner()
})

// ==================== 生命周期 ====================
onMounted(() => {
  loadSuppliers()
  loadReceiveRecords()
  loadPendingOrders()
  loadWarehouses()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>收料入库</h3>
        <Logout />
      </div>

      <div class="content">
        <el-card shadow="never">
          <el-tabs v-model="activeTab">
            <!-- ==================== Tab1：收料操作 ==================== -->
            <el-tab-pane label="收料操作" name="receive">
              <!-- 搜索栏 -->
              <div class="search-card">
                <div class="search-row">
                  <el-input
                    v-model="searchNoteCode"
                    placeholder="扫描二维码或手动输入送货单号"
                    clearable
                    size="large"
                    @clear="handleClearSearch"
                    @keyup.enter="handleSearch"
                  >
                    <template #prefix>
                      <el-icon><Search /></el-icon>
                    </template>
                    <template #suffix>
                      <el-button
                        class="scan-btn-inner"
                        circle
                        @click.stop="openScanner"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 7V3h4"/>
                          <path d="M17 3h4v4"/>
                          <path d="M21 17v4h-4"/>
                          <path d="M7 21H3v-4"/>
                          <line x1="8" y1="12" x2="16" y2="12" stroke-width="2.5"/>
                        </svg>
                      </el-button>
                    </template>
                    <template #append>
                      <el-button type="primary" @click="handleSearch">
                        <el-icon><Search /></el-icon>
                        查询
                      </el-button>
                    </template>
                  </el-input>
                </div>
                <div class="search-hint">
                  <el-icon><InfoFilled /></el-icon>
                  扫描送货单条形码，或手动输入送货单号进行查询 — 点击输入框内
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#909399" stroke-width="2" stroke-linecap="round" style="vertical-align: middle; margin: 0 2px;">
                    <path d="M3 7V3h4"/>
                    <path d="M17 3h4v4"/>
                    <path d="M21 17v4h-4"/>
                    <path d="M7 21H3v-4"/>
                    <line x1="8" y1="12" x2="16" y2="12" stroke-width="2.5"/>
                  </svg>
                  可打开扫码窗口
                </div>
              </div>

              <!-- 未找到 -->
              <el-empty v-if="notFound" description="未找到该送货单，请检查单号是否正确" />

              <!-- 送货单详情 + 收料表单 -->
              <div v-if="foundDelivery" class="receive-detail">
                <el-descriptions :column="3" border size="small" title="送货单信息">
                  <el-descriptions-item label="送货单号">
                    <b style="color: #1890ff">{{ foundDelivery.noteCode }}</b>
                  </el-descriptions-item>
                  <el-descriptions-item label="供应商">
                    {{ foundDelivery.supplierName }}
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ foundDelivery.createTime }}
                  </el-descriptions-item>
                </el-descriptions>

                <div style="margin: 16px 0; display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 14px; font-weight: 500;">入库仓库：</span>
                  <el-select
                    v-model="selectedWareID"
                    placeholder="请选择入库仓库"
                    style="width: 250px"
                  >
                    <el-option
                      v-for="w in wareList.filter(w => !(w.isDel ?? w.IsDel))"
                      :key="w.wareID"
                      :label="`${w.wareCode} - ${w.name}`"
                      :value="w.wareID"
                    />
                  </el-select>
                </div>

                <div class="section-title">物料明细 — 请核对实物并填写实际收货数量</div>

                <el-table :data="receiveFormItems" stripe border style="width: 100%">
                  <el-table-column type="index" label="序号" width="60" align="center" />
                  <el-table-column prop="orderCode" label="采购单号" width="160" align="center" />
                  <el-table-column prop="materialCode" label="物料编码" width="130" align="center" />
                  <el-table-column prop="materialName" label="物料名称" min-width="140" />
                  <el-table-column prop="spec" label="规格" width="110" align="center" />
                  <el-table-column prop="unit" label="单位" width="70" align="center" />
                  <el-table-column label="送货数量" width="90" align="center">
                    <template #default="{ row }">
                      <b>{{ row.quantity }}</b>
                    </template>
                  </el-table-column>
                  <el-table-column label="已收数量" width="90" align="center">
                    <template #default="{ row }">
                      <span style="color: #666">{{ row.historyReceived }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="剩余应收" width="90" align="center">
                    <template #default="{ row }">
                      <b style="color: #1890ff">{{ row.remaining }}</b>
                    </template>
                  </el-table-column>
                  <el-table-column label="本次实收" width="160" align="center">
                    <template #default="{ row, $index }">
                      <el-input-number
                        v-model="receiveFormItems[$index].receivedQty"
                        :min="0"
                        size="small"
                        style="width: 130px"
                        @change="(val) => handleQtyOverLimit(val, $index)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column label="仍差" width="70" align="center">
                    <template #default="{ row }">
                      <el-tag
                        :type="row.remaining - row.receivedQty === 0 ? 'success' : 'warning'"
                        size="small"
                      >
                        {{ row.remaining - row.receivedQty }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="remark" label="备注" min-width="100" />
                </el-table>

                <div class="confirm-bar">
                  <span class="confirm-summary">
                    送货总数：<b>{{ receiveFormItems.reduce((s, i) => s + i.quantity, 0) }}</b>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    累计已收：<b style="color: #67c23a">{{
                      receiveFormItems.reduce((s, i) => s + (i.historyReceived || 0), 0)
                    }}</b>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    本次实收：<b style="color: #1890ff">{{
                      receiveFormItems.reduce((s, i) => s + Number(i.receivedQty || 0), 0)
                    }}</b>
                    &nbsp;&nbsp;|&nbsp;&nbsp;
                    仍差：<b :style="{ color: receiveFormItems.reduce((s, i) => s + i.remaining, 0) -
                      receiveFormItems.reduce((s, i) => s + Number(i.receivedQty || 0), 0) === 0
                      ? '#67c23a' : '#e6a23c' }">{{
                      receiveFormItems.reduce((s, i) => s + i.remaining, 0) -
                      receiveFormItems.reduce((s, i) => s + Number(i.receivedQty || 0), 0)
                    }}</b>
                  </span>
                  <el-button type="primary" size="large" @click="handleConfirmReceive">
                    <el-icon><Check /></el-icon>
                    确认收货
                  </el-button>
                </div>
              </div>

              <el-empty
                v-if="!foundDelivery && !notFound"
                description="请扫描送货单条形码或输入送货单号查询"
              />
            </el-tab-pane>

            <!-- ==================== Tab2：收料记录 ==================== -->
            <el-tab-pane label="收料记录" name="history">
              <div class="history-search">
                <el-input
                  v-model="historyKeyword"
                  placeholder="搜索送货单号 / 收料单号 / 订单号 / 供应商"
                  clearable
                  size="default"
                  style="width: 360px"
                  @input="historyQuery.pageNum = 1"
                  @keyup.enter="historyQuery.pageNum = 1"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
                <el-button type="primary" @click="historyQuery.pageNum = 1">查询</el-button>
                <el-button @click="historyKeyword = ''; historyQuery.pageNum = 1">重置</el-button>
              </div>

              <div class="table-header">
                <span>收料记录列表</span>
                <span>共 {{ filteredHistoryRecords.length }} 条</span>
              </div>

              <el-empty
                v-if="filteredHistoryRecords.length === 0"
                description="暂无收料记录"
              />

              <template v-else>
                <el-table ref="historyTableRef" :data="historyTableData" stripe border style="width: 100%" @row-click="handleHistoryRowClick">
                  <el-table-column type="expand">
                    <template #default="{ row }">
                      <div class="detail-content">
                        <div class="detail-title">收料明细</div>
                        <el-table :data="row.items" size="small" border style="width: 100%">
                          <el-table-column type="index" label="序号" width="60" align="center" />
                          <el-table-column label="采购单号" width="160" align="center">
                            <template #default>
                              {{ row.orderCode }}
                            </template>
                          </el-table-column>
                          <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                          <el-table-column prop="materialName" label="物料名称" min-width="140" />
                          <el-table-column prop="spec" label="规格" width="110" align="center" />
                          <el-table-column prop="unit" label="单位" width="70" align="center" />
                          <el-table-column prop="planQty" label="计划数量" width="100" align="center" />
                          <el-table-column prop="receivedQty" label="实收数量" width="100" align="center" />
                          <el-table-column label="差异" width="80" align="center">
                            <template #default="{ row: r }">
                              <el-tag
                                :type="r.diffQty === 0 ? 'success' : 'warning'"
                                size="small"
                              >
                                {{ r.diffQty }}
                              </el-tag>
                            </template>
                          </el-table-column>
                        </el-table>
                      </div>
                    </template>
                  </el-table-column>

                  <el-table-column prop="recordCode" label="收料单号" width="180" align="center" />
                  <el-table-column prop="noteCode" label="送货单号" width="180" align="center" />
                  <el-table-column prop="supplierName" label="供应商" min-width="160" />
                  <el-table-column prop="totalPlanQty" label="计划总数" width="100" align="center" />
                  <el-table-column prop="totalReceivedQty" label="实收总数" width="100" align="center" />
                  <el-table-column label="差异" width="80" align="center">
                    <template #default="{ row }">
                      <el-tag
                        :type="row.totalDiffQty === 0 ? 'success' : 'warning'"
                        size="small"
                      >
                        {{ row.totalDiffQty }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="operator" label="操作员" width="100" align="center" />
                  <el-table-column prop="receiveDate" label="收料时间" width="170" align="center" />
                </el-table>

                <AppPagination
                  :total="filteredHistoryRecords.length"
                  :query="historyQuery"
                  @change="handleHistoryPageChange"
                />
              </template>
            </el-tab-pane>

            <!-- ==================== Tab3：待收料 ==================== -->
            <el-tab-pane label="待收料" name="pending">
              <AppFilter :fields="pendingFilterFields" :model="pendingQuery" @query="handlePendingQuery" @reset="handlePendingReset" />

              <div class="table-header">
                <span>待收料列表</span>
                <span>共 {{ pendingTotal }} 条</span>
              </div>

              <el-table
                ref="tableRef"
                :data="pendingTableData"
                row-key="orderID"
                stripe
                border
                style="width: 100%"
                @row-click="handleRowClick"
              >
                <el-table-column type="expand">
                  <template #default="{ row }">
                    <div class="detail-content">
                      <div class="detail-info">
                        <div><span>订单编号：</span><b>{{ row.orderCode }}</b></div>
                        <div><span>供应商：</span><b>{{ row.supplierName }}</b></div>
                        <div><span>订单状态：</span><b>{{ getDeliveryStatusText(row.status) }}</b></div>
                        <div><span>总金额：</span><b class="red-price">¥{{ row.totalAmount }}</b></div>
                        <div><span>送货单号：</span><b style="color: #1890ff">{{ row.noteCode || '—' }}</b></div>
                        <div><span>创建时间：</span><b>{{ row.createTime }}</b></div>
                      </div>
                      <el-table :data="row.materials" size="small" border style="width: 100%">
                        <el-table-column prop="index" label="序号" width="60" align="center" />
                        <el-table-column prop="materialCode" label="物料编码" width="120" align="center" />
                        <el-table-column prop="materialName" label="物料名称" width="180" align="center" />
                        <el-table-column prop="spec" label="规格" width="120" align="center" />
                        <el-table-column prop="qty" label="采购数量" align="center" />
                        <el-table-column prop="unit" label="单位" width="70" align="center" />
                        <el-table-column prop="unitPrice" label="单价" align="center" />
                        <el-table-column prop="amount" label="金额" align="center" />
                      </el-table>
                    </div>
                  </template>
                </el-table-column>

                <el-table-column type="index" label="序号" width="60" align="center" />
                <el-table-column prop="noteCode" label="送货单号" min-width="160" align="center">
                  <template #default="{ row }">
                    <span v-if="row.noteCode" style="color: #1890ff;">{{ row.noteCode }}</span>
                    <span v-else style="color: #999;">—</span>
                  </template>
                </el-table-column>
                <el-table-column prop="orderCode" label="订单编号" min-width="150" align="center" />
                <el-table-column prop="supplierName" label="供应商" min-width="160" align="center" />
                <el-table-column prop="materialCount" label="物料种数" align="center" />
                <el-table-column label="订单状态" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getDeliveryStatusTag(row.status)" size="small">{{ getDeliveryStatusText(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <!-- <el-table-column label="操作" width="120" align="center">
                  <template #default="{ row }">
                    <el-button type="success" size="small" @click.stop="handleReceive(row)">确认收料</el-button>
                  </template>
                </el-table-column> -->
              </el-table>

              <AppPagination :total="pendingTotal" :query="pendingQuery" @change="handlePendingPageChange" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>

    <!-- ==================== 扫码窗口（真实摄像头） ==================== -->
    <el-dialog
      :model-value="scanVisible"
      title="扫码收料"
      width="560px"
      :close-on-click-modal="false"
      :before-close="handleScanDialogClose"
      destroy-on-close
    >
      <div class="scan-dialog-body">
        <!-- 摄像头扫码区域 -->
        <div v-if="!cameraError" class="camera-box">
          <div id="scan-reader" class="scan-reader"></div>
        </div>

        <!-- 摄像头错误提示 -->
        <div v-if="cameraError" class="camera-error">
          <el-icon size="40" color="#f56c6c"><WarningFilled /></el-icon>
          <p>{{ cameraError }}</p>
          <p class="error-hint">请检查浏览器是否授予摄像头权限，或使用下方手动输入</p>
        </div>

        <!-- 上传本地图片 -->
         <div class="scan-upload-row">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/bmp,image/webp,image/tiff"
            style="display: none"
            @change="handleFileScan"
          />
          <el-button
            type="primary"
            plain
            size="large"
            :loading="fileScanning"
            @click="triggerFileSelect"
          >
            <el-icon size="20"><FolderOpened /></el-icon>
            识别本地图片
          </el-button>
          <span class="upload-hint">选择含有条码/二维码的截图或照片</span>
        </div> 

        <!-- 手动输入 -->
        <div class="scan-input-row">
          <el-input
            v-model="scanInput"
            placeholder="摄像头不可用时，可手动输入送货单号后按回车"
            size="large"
            clearable
            @keyup.enter="handleScanConfirm"
          >
            <template #prefix>
              <el-icon><Document /></el-icon>
            </template>
          </el-input>
        </div>

        <!-- 快捷选择（备用） -->
        <div class="quick-list">
          <div class="quick-list-title">快捷选择（点击即查）</div>
          <div class="quick-items">
            <el-button
              v-for="d in allDeliveries.slice(0, 8)"
              :key="d.noteCode"
              size="small"
              :type="d.status === '1' ? 'info' : 'primary'"
              :disabled="d.status === '1'"
              plain
              @click="quickSelectDelivery(d.noteCode)"
            >
              {{ d.noteCode }}
              <el-tag :type="d.status === '1' ? 'success' : 'warning'" size="small" style="margin-left: 6px">
                {{ d.status === '1' ? '已收' : '未收' }}
              </el-tag>
            </el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="handleScanDialogClose">关闭</el-button>
        <el-button type="primary" @click="handleScanConfirm" :loading="scanLoading">
          <el-icon><Search /></el-icon>
          确认查询
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header {
  height: 60px; background: #fff; padding: 0 20px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #eee;
}
.content {
  padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5;
}

/* 搜索区域 */
.search-card {
  margin-bottom: 20px;
}
.search-row {
  display: flex; gap: 12px;
}
.search-row .el-input { flex: 1; }
.search-hint {
  margin-top: 10px; font-size: 13px; color: #909399;
  display: flex; align-items: center; gap: 6px;
}

/* 送货单详情 */
.receive-detail {
  margin-top: 16px;
}
.section-title {
  font-size: 15px; font-weight: 600; color: #333;
  margin: 20px 0 12px 0;
  padding-left: 8px; border-left: 3px solid #1890ff;
}

/* 确认栏 */
.confirm-bar {
  margin-top: 20px;
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px;
  background: #f6f8fa; border-radius: 6px;
}
.confirm-summary {
  font-size: 15px;
}
.confirm-summary b {
  font-size: 16px;
}

/* 表格通用 */
.table-header {
  display: flex; justify-content: space-between; align-items: center;
  margin: 16px 0; font-size: 14px;
}
.table-header span:first-child { font-weight: bold; color: #333; }
.table-header span:last-child { color: #999; }

.detail-content {
  padding: 15px; background: #fafafa;
}
.detail-title {
  font-size: 14px; font-weight: 500; margin-bottom: 10px; color: #333;
}
.detail-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 15px;
  font-size: 13px;
}
.detail-info span { color: #666; }
.red-price { color: #f56c6c; font-weight: 500; }

/* 输入框内扫码按钮 */
.scan-btn-inner {
  width: 32px; height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  color: #1890ff;
  font-size: 20px;
  transition: all 0.2s;
}
.scan-btn-inner:hover {
  color: #40a9ff;
  background: rgba(24, 144, 255, 0.08);
  transform: scale(1.1);
}
.scan-btn-inner:active {
  transform: scale(0.95);
}

/* 扫码弹窗 */
.scan-dialog-body {
  display: flex; flex-direction: column; align-items: center; gap: 20px;
}

/* 摄像头区域 */
.camera-box {
  width: 100%;
  max-width: 400px;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.scan-reader {
  width: 100%;
}
/* html5-qrcode 内部元素适配 */
.scan-reader :deep(video) {
  width: 100% !important;
  height: auto !important;
  border-radius: 8px;
}
.scan-reader :deep(#qr-shaded-region) {
  border-width: 50px !important;
}

/* 摄像头错误 */
.camera-error {
  width: 100%; text-align: center; padding: 30px 0; color: #666;
}
.camera-error p { margin-top: 10px; }
.error-hint { font-size: 13px; color: #909399; }

.scan-upload-row {
  width: 100%; display: flex; align-items: center; gap: 12px;
}
.upload-hint {
  font-size: 13px; color: #909399;
}

.scan-input-row {
  width: 100%;
}

/* 快捷选择列表 */
.quick-list {
  width: 100%;
}
.quick-list-title {
  font-size: 13px; color: #909399; margin-bottom: 10px;
}
.quick-items {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.quick-items .el-button {
  font-family: monospace;
}

.history-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
