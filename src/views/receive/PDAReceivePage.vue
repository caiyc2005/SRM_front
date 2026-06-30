<script setup>
/**
 * PDAReceivePage.vue — PDA 收料（手持终端专用）
 *
 * 功能：扫码/手动输入送货单号加载送货信息 → 填写实收数量 → 确认收货
 * 样式参考移动端卡片式布局，API 与收料操作一致
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

// ==================== API ====================
const API_DELIVERY = '/api/Delivery'
const API_RECEIVE = '/api/Receive'
const API_ORDERS = '/api/Orders'

// ==================== 数据 ====================
const searchNoteCode = ref('')
const foundDelivery = ref(null)
const notFound = ref(false)
const searchResults = ref([])       // 多条搜索结果
const showSearchResults = ref(false)
const receiveFormItems = ref([])
const wareList = ref([])
const selectedWareID = ref('')
const fieldErrors = ref({})
const submitting = ref(false)
const submitted = ref(false)
const userName = ref('')

// 待收订单
const pendingOrders = ref([])
const loadingPending = ref(false)

// 收料记录
const receiveRecords = ref([])
const loadingRecords = ref(false)
const showRecords = ref(false)

const filteredRecords = computed(() => {
  const kw = searchNoteCode.value.trim().toLowerCase()
  if (!kw) return receiveRecords.value
  return receiveRecords.value.filter(r =>
    r.noteCode.toLowerCase().includes(kw) ||
    r.recordCode.toLowerCase().includes(kw) ||
    r.orderCode.toLowerCase().includes(kw) ||
    r.supplierName.toLowerCase().includes(kw)
  )
})

// ==================== 计算属性 ====================
const totalPlanQty = computed(() =>
  receiveFormItems.value.reduce((s, i) => s + i.quantity, 0)
)
const totalHistoryQty = computed(() =>
  receiveFormItems.value.reduce((s, i) => s + (i.historyReceived || 0), 0)
)
const totalReceivedQty = computed(() =>
  receiveFormItems.value.reduce((s, i) => s + Number(i.receivedQty || 0), 0)
)
const totalRemainQty = computed(() =>
  receiveFormItems.value.reduce((s, i) => s + i.remaining, 0) - totalReceivedQty.value
)

const canSubmit = computed(() =>
  receiveFormItems.value.length > 0 && !submitting.value && !submitted.value
)

const activeWarehouses = computed(() =>
  wareList.value.filter(w => !(w.isDel ?? w.IsDel))
)

// ==================== 仓库加载 ====================
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

// ==================== 待收订单列表 ====================
async function loadPendingOrders() {
  loadingPending.value = true
  try {
    const token = localStorage.getItem('token')
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }

    // 拉取待收料列表
    const res = await fetch(`${API_DELIVERY}/GetDeliveryNoteNotIn`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page: 1, pageSize: 200 })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data?.items?.length) {
      pendingOrders.value = result.data.items
        .filter(item => {
          // 已收货的不在待收列表显示
          if (String(item.status ?? 0) === '2') return false
          // 过滤掉已全部收完的（无明细时保留，视为可收料）
          const hasDetails = item.details && item.details.length > 0
          if (!hasDetails) return true
          const allReceived = item.details.every(
            dd => (dd.receivedQty || 0) >= dd.quantity
          )
          return !allReceived
        })
        .map(item => ({
          noteCode: item.noteCode,
          orderCode: item.orderCode || '',
          supplierName: item.supplierName || '',
          materialCount: item.details?.length || 0,
          status: String(item.status ?? 0)
        }))
    }
  } catch { /* 降级 */ }
  loadingPending.value = false
}

function selectPendingOrder(order) {
  if (searchTimer) clearTimeout(searchTimer)
  searchNoteCode.value = order.noteCode
  handleSearch()
}

// ==================== 收料记录 ====================
async function loadReceiveRecords() {
  loadingRecords.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_RECEIVE}/GetReceivesList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ page: 1, pageSize: 20 })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data) {
      receiveRecords.value = (result.data.items || []).map(r => ({
        recordCode: r.receiveCode || '',
        noteCode: r.noteCode || '',
        orderCode: r.orderCode || '',
        supplierName: r.supplierName || '',
        operator: r.receiveUserName || '',
        receiveDate: r.receiveDate ? r.receiveDate.replace('T', ' ').slice(0, 16) : '',
        totalPlanQty: (r.details || []).reduce((s, d) => s + (d.planQty || 0), 0),
        totalReceivedQty: (r.details || []).reduce((s, d) => s + (d.receivedQty || 0), 0),
        totalDiffQty: (r.details || []).reduce((s, d) => s + (d.diffQty || 0), 0)
      }))
    }
  } catch { /* 降级 */ }
  loadingRecords.value = false
}

function toggleRecords() {
  showRecords.value = !showRecords.value
  if (showRecords.value && receiveRecords.value.length === 0) {
    loadReceiveRecords()
  }
}

// ==================== 搜索送货单 ====================
async function handleSearch() {
  const kw = searchNoteCode.value.trim()
  if (!kw) {
    foundDelivery.value = null
    notFound.value = false
    searchResults.value = []
    showSearchResults.value = false
    receiveFormItems.value = []
    fieldErrors.value = {}
    submitted.value = false
    return
  }

  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_DELIVERY}/GetDeliveryNote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ noteCode: kw, page: 1, pageSize: 20 })
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}

    if (result.code === 200 && result.data?.items?.length) {
      const items = result.data.items

      // 多条结果 → 显示列表让用户选择
      if (items.length > 1) {
        searchResults.value = items.map(item => ({
          noteCode: item.noteCode,
          orderCode: item.orderCode || item.details?.[0]?.orderCode || '',
          supplierName: item.supplierName || '',
          status: String(item.status ?? 0),
          materialCount: item.details?.length || 0
        }))
        showSearchResults.value = true
        foundDelivery.value = null
        notFound.value = false
        receiveFormItems.value = []
        return
      }

      // 仅一条 → 直接显示详情
      const item = items[0]
      // 如果没有明细数据，不拦截（可能后端未返回明细）
      // 只有确认每条都已收完才提示重复收料
      const hasDetails = item.details && item.details.length > 0
      const allFullyReceived = hasDetails && item.details.every(
        dd => (dd.receivedQty || 0) >= dd.quantity
      )
      if (allFullyReceived) {
        ElMessage.warning('该送货单所有物料已全部收完，不可重复收料')
        foundDelivery.value = null
        notFound.value = false
        searchResults.value = []
        showSearchResults.value = false
        receiveFormItems.value = []
        submitted.value = false
        return
      }
      notFound.value = false
      showSearchResults.value = false
      searchResults.value = []
      submitted.value = false
      fieldErrors.value = {}
      foundDelivery.value = {
        noteCode: item.noteCode,
        orderID: item.orderID || '',
        orderCode: item.orderCode || item.details?.[0]?.orderCode || '',
        supplierName: item.supplierName || '',
        supplierCode: item.supplierCode || '',
        expectDate: item.expectedDate ? item.expectedDate.slice(0, 10) : '',
        createTime: item.createdTime ? item.createdTime.replace('T', ' ').slice(0, 16) : '',
        status: String(item.status ?? 0),
        materials: (item.details || []).map((dd, i) => ({
          index: i + 1,
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
      return
    }
    notFound.value = true
    foundDelivery.value = null
    searchResults.value = []
    showSearchResults.value = false
    receiveFormItems.value = []
  } catch { /* 降级 */ }
}

/** 从搜索结果列表中选择一条，加载详情 */
function selectSearchResult(item) {
  if (searchTimer) clearTimeout(searchTimer)
  searchNoteCode.value = item.noteCode
  showSearchResults.value = false
  searchResults.value = []
  handleSearch()
}

function handleClearSearch() {
  searchNoteCode.value = ''
  foundDelivery.value = null
  notFound.value = false
  searchResults.value = []
  showSearchResults.value = false
  receiveFormItems.value = []
  fieldErrors.value = {}
  submitted.value = false
}

// ==================== 数量超限警告弹窗 ====================
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

// ==================== 数量更新 ====================
function updateQty(index, value) {
  const item = receiveFormItems.value[index]
  if (!item) return
  const numVal = Number(value) || 0

  // 检测超限 → 弹窗警告并复位
  if (numVal > item.remaining) {
    handleQtyOverLimit(numVal, index)
    return
  }

  receiveFormItems.value[index].receivedQty = numVal
  const materialCode = item.materialCode
  if (fieldErrors.value[materialCode]) {
    const newErrors = { ...fieldErrors.value }
    delete newErrors[materialCode]
    fieldErrors.value = newErrors
  }
}

// ==================== 校验 ====================
function validateDetails() {
  const errors = {}

  if (!selectedWareID.value) {
    ElMessage.warning('请选择入库仓库')
    return false
  }

  const selectedWare = activeWarehouses.value.find(w => w.wareID === selectedWareID.value)
  if (selectedWare && (selectedWare.isDel ?? selectedWare.IsDel)) {
    ElMessage.warning('所选仓库已被禁用，请重新选择仓库')
    return false
  }

  receiveFormItems.value.forEach((item) => {
    const qty = Number(item.receivedQty)
    if (item.receivedQty == null || item.receivedQty === '') {
      errors[item.materialCode] = '实收数量不能为空'
    } else if (qty < 0) {
      errors[item.materialCode] = '实收数量不能为负数'
    } else if (qty > item.remaining) {
      errors[item.materialCode] = `不能超过剩余应收 ${item.remaining}`
    }
  })

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

// ==================== 确认收货 ====================
async function handleSubmit() {
  if (submitting.value || submitted.value) return
  if (!foundDelivery.value || !validateDetails()) return

  const delivery = foundDelivery.value
  const items = receiveFormItems.value

  // 如果送货单状态为"未发货"（status=0），需额外二次确认
  if (delivery.status === '0') {
    try {
      await ElMessageBox.confirm(
        `该送货单【${delivery.noteCode}】当前状态为「未发货」，确认要直接收料吗？\n` +
        `建议先联系供应商确认发货情况。`,
        '未发货收料确认',
        {
          type: 'warning',
          confirmButtonText: '仍要收料',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--danger'
        }
      )
    } catch { return }
  }

  try {
    await ElMessageBox.confirm(
      `确认收货？\n送货总数：${totalPlanQty.value}，累计已收：${totalHistoryQty.value}，本次实收：${totalReceivedQty.value}` +
      (totalRemainQty.value !== 0 ? `\n仍差：${totalRemainQty.value}` : ''),
      '确认收料',
      { type: 'warning', confirmButtonText: '确认收货' }
    )
  } catch { return }

  submitting.value = true
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
      ElMessage.success('收货确认成功！')
      handleClearSearch()
      loadPendingOrders()
      return
    }
    ElMessageBox.alert(result.message || '收货失败', '收料失败', {
      type: 'error',
      confirmButtonText: '知道了'
    })
  } catch {
    ElMessage.error('后端接口不可用，收货失败')
  } finally {
    submitting.value = false
  }
}

// ==================== 扫码弹窗 ====================
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
        qrbox: { width: 280, height: 120 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.QR_CODE
        ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      },
      (decodedText) => { handleScanResult(decodedText) },
      () => {}
    )
  } catch (err) {
    cameraError.value = '摄像头启动失败：' + (err.message || err)
  }
}

function handleScanResult(code) {
  if (!code) return
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
    try { await html5QrCode.stop() } catch (_) {}
  }
  html5QrCode = null
}

function handleScanConfirm() {
  const code = scanInput.value.trim()
  if (!code) { ElMessage.warning('请输入或扫描送货单号'); return }
  stopScanner()
  scanVisible.value = false
  searchNoteCode.value = code
  handleSearch()
}

const fileInputRef = ref(null)
const fileScanning = ref(false)

function triggerFileSelect() { fileInputRef.value?.click() }

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

    if ('BarcodeDetector' in window) {
      try {
        const bitmap = await createImageBitmap(file)
        const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'qr_code'] })
        const results = await detector.detect(bitmap)
        bitmap.close()
        if (results.length > 0) decodedText = results[0].rawValue
      } catch { /* 降级 */ }
    }

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
      } catch (_) {}
    }

    if (decodedText) {
      handleScanResult(decodedText)
    } else {
      ElMessage.warning('图片中未检测到条码或二维码')
    }
  } catch (err) {
    ElMessage.warning('识别失败：' + (err?.message || '未知错误'))
  } finally {
    fileScanning.value = false
    event.target.value = ''
  }
}

function handleScanDialogClose() {
  stopScanner()
  scanVisible.value = false
}

onBeforeUnmount(() => {
  stopScanner()
  if (searchTimer) clearTimeout(searchTimer)
})

// 动态监测输入：用户输入后自动查询（防抖 500ms）
let searchTimer = null
watch(searchNoteCode, (val) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!val.trim()) {
    foundDelivery.value = null
    notFound.value = false
    searchResults.value = []
    showSearchResults.value = false
    receiveFormItems.value = []
    fieldErrors.value = {}
    submitted.value = false
    return
  }
  searchTimer = setTimeout(() => {
    handleSearch()
  }, 500)
})

onMounted(() => {
  loadWarehouses()
  loadPendingOrders()
  try { userName.value = JSON.parse(localStorage.getItem('userInfo') || '{}').userName || '' } catch {}
})
</script>

<template>
  <div class="app-shell">
    <!-- ========== 顶部标题栏 ========== -->
    <header class="app-header">
      <div>
        <p class="app-header__eyebrow">SRM · 仓储管理</p>
        <h1 class="app-header__title">PDA 收料</h1>
      </div>
      <div class="app-header__actions">
        <button class="header-btn" :class="{ 'header-btn--active': showRecords }" @click="toggleRecords">
          {{ showRecords ? '返回收料' : '查看收料记录' }}
        </button>
        <div class="operator-card">
          <span class="operator-card__label">操作员</span>
          <span class="operator-card__name">{{ userName || '—' }}</span>
        </div>
      </div>
    </header>

    <!-- ========== 主内容区域 ========== -->
    <main class="app-main">
      <!-- 搜索栏 -->
      <section class="app-section">
        <div class="search-box">
          <input
            v-model="searchNoteCode"
            type="text"
            class="search-input"
            :placeholder="showRecords ? '搜索收料记录' : '扫描或输入送货单号'"
            @keyup.enter="showRecords ? null : handleSearch()"
          />
          <button class="search-btn" @click="showRecords ? null : handleSearch()">{{ showRecords ? '筛选' : '查询' }}</button>
          <button class="scan-btn" @click="openScanner">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M3 7V3h4"/><path d="M17 3h4v4"/>
              <path d="M21 17v4h-4"/><path d="M7 21H3v-4"/>
              <line x1="8" y1="12" x2="16" y2="12" stroke-width="2.5"/>
            </svg>
          </button>
        </div>
      </section>

      <!-- 提示消息 -->
      <p v-if="notFound" class="message">未找到该送货单，请检查单号是否正确</p>

      <!-- ========== 多条搜索结果 ========== -->
      <section v-if="showSearchResults && searchResults.length > 0" class="app-section">
        <div class="section-title-row">
          <h2 class="section-title">搜索结果</h2>
          <span class="section-count">{{ searchResults.length }} 条</span>
        </div>
        <div class="order-list">
          <div
            v-for="item in searchResults"
            :key="item.noteCode"
            class="detail-card order-card"
            @click="selectSearchResult(item)"
          >
            <div class="detail-card__head">
              <div class="detail-card__title-block">
                <span class="detail-card__name">{{ item.noteCode }}</span>
                <span class="detail-card__code">{{ item.orderCode }}</span>
              </div>
              <span class="detail-card__wait">{{ item.materialCount }} 项</span>
            </div>
            <div class="detail-card__numbers">
              <span>{{ item.supplierName }}</span>
              <span :style="{ color: item.status === '2' ? '#1f7b5b' : item.status === '1' ? '#1890ff' : '#c97a1a' }">
                {{ item.status === '2' ? '已收货' : item.status === '1' ? '已发货' : '未发货' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ========== 收料记录 ========== -->
      <template v-if="showRecords">
      <section class="app-section">
        <div class="section-title-row">
          <h2 class="section-title">收料记录</h2>
          <span class="section-count">{{ filteredRecords.length }} 条</span>
        </div>

        <div v-if="loadingRecords" class="state-card">加载中...</div>

        <div v-else-if="filteredRecords.length === 0" class="state-card">暂无收料记录</div>

        <div v-else class="order-list">
          <div v-for="rec in filteredRecords" :key="rec.recordCode" class="detail-card">
            <div class="detail-card__head">
              <div class="detail-card__title-block">
                <span class="detail-card__name">{{ rec.noteCode }}</span>
                <span class="detail-card__code">{{ rec.recordCode }}</span>
              </div>
              <span class="detail-card__wait">{{ rec.operator }}</span>
            </div>
            <div class="detail-card__numbers">
              <span>计划 {{ rec.totalPlanQty }}</span>
              <span>实收 {{ rec.totalReceivedQty }}</span>
              <span :style="{ color: rec.totalDiffQty === 0 ? '#1f7b5b' : '#c97a1a' }">
                差异 {{ rec.totalDiffQty }}
              </span>
            </div>
            <div class="detail-card__spec">{{ rec.supplierName }} · {{ rec.receiveDate }}</div>
          </div>
        </div>
      </section>
      </template>
      <template v-else>
      <!-- ========== 送货单信息卡片 ========== -->
      <section v-if="foundDelivery" class="app-section">
        <div class="card">
          <div class="card-title">
            送货单信息
            <span class="tag" :class="foundDelivery.status === '2' ? 'tag-green' : foundDelivery.status === '1' ? 'tag-blue' : 'tag-orange'">
              {{ foundDelivery.status === '2' ? '已收货' : foundDelivery.status === '1' ? '已发货' : '未发货' }}
            </span>
          </div>
          <div class="card-body">
            <div class="card-row">
              <span class="card-label">送货单号</span>
              <span class="card-value">{{ foundDelivery.noteCode }}</span>
            </div>
            <div class="card-row">
              <span class="card-label">采购单号</span>
              <span class="card-value">{{ foundDelivery.orderCode }}</span>
            </div>
            <div class="card-row">
              <span class="card-label">供应商</span>
              <span class="card-value">{{ foundDelivery.supplierName }}</span>
            </div>
            <div class="card-row">
              <span class="card-label">预计送达</span>
              <span class="card-value">{{ foundDelivery.expectDate }}</span>
            </div>
            <div class="card-row">
              <span class="card-label">创建时间</span>
              <span class="card-value">{{ foundDelivery.createTime }}</span>
            </div>
          </div>
        </div>

        <!-- 仓库选择 -->
        <div class="warehouse-row">
          <span class="card-label">入库仓库</span>
          <select v-model="selectedWareID" class="warehouse-select">
            <option value="" disabled>请选择仓库</option>
            <option v-for="w in activeWarehouses" :key="w.wareID" :value="w.wareID">
              {{ w.wareCode }} - {{ w.name }}
            </option>
          </select>
        </div>
      </section>

      <!-- ========== 物料明细卡片列表 ========== -->
      <section v-if="receiveFormItems.length > 0" class="app-section app-section--grow">
        <div class="section-title-row">
          <h2 class="section-title">物料明细</h2>
          <span class="section-count">{{ receiveFormItems.length }} 项</span>
        </div>

        <div class="detail-list">
          <div
            v-for="(item, index) in receiveFormItems"
            :key="item.materialCode"
            class="detail-card"
            :class="{ 'detail-card--error': fieldErrors[item.materialCode] }"
          >
            <div class="detail-card__head">
              <div class="detail-card__title-block">
                <span class="detail-card__name">{{ item.materialName }}</span>
                <span class="detail-card__code">{{ item.materialCode }}</span>
              </div>
              <span class="detail-card__wait">应收 {{ item.remaining }}</span>
            </div>

            <div v-if="item.spec" class="detail-card__spec">{{ item.spec }} / {{ item.unit }}</div>

            <div class="detail-card__numbers">
              <span>送货 {{ item.quantity }}</span>
              <span>已收 {{ item.historyReceived }}</span>
            </div>

            <div class="detail-card__form">
              <div class="detail-card__field">
                <label class="detail-card__label">本次实收</label>
                <div class="qty-group">
                  <button
                    class="qty-btn"
                    :disabled="item.receivedQty <= 0 || submitted"
                    @click="updateQty(index, Math.max(0, item.receivedQty - 1))"
                  >−</button>
                  <input
                    type="number"
                    class="detail-card__input qty-center"
                    :value="item.receivedQty"
                    :min="0"
                    :max="item.remaining"
                    :disabled="submitted"
                    @input="updateQty(index, Number($event.target.value) || 0)"
                    @blur="updateQty(index, Number(item.receivedQty) || 0)"
                  />
                  <button
                    class="qty-btn"
                    :disabled="item.receivedQty >= item.remaining || submitted"
                    @click="updateQty(index, Math.min(item.remaining, item.receivedQty + 1))"
                  >+</button>
                </div>
              </div>
            </div>

            <p v-if="fieldErrors[item.materialCode]" class="detail-card__error">{{ fieldErrors[item.materialCode] }}</p>
            <p v-if="submitted" class="field-done">✓ 已收 {{ item.receivedQty }}</p>
          </div>
        </div>
      </section>

      <!-- 待收订单 -->
      <section v-if="!foundDelivery && !notFound && !showSearchResults" class="app-section">
        <div class="section-title-row">
          <h2 class="section-title">待收订单</h2>
          <span v-if="pendingOrders.length" class="section-count">{{ pendingOrders.length }} 单</span>
        </div>

        <div v-if="loadingPending" class="state-card">加载中...</div>

        <div v-else-if="pendingOrders.length === 0" class="state-card">
          扫描送货单条形码或输入送货单号查询
        </div>

        <div v-else class="order-list">
          <div
            v-for="order in pendingOrders"
            :key="order.noteCode"
            class="detail-card order-card"
            @click="selectPendingOrder(order)"
          >
            <div class="detail-card__head">
              <div class="detail-card__title-block">
                <span class="detail-card__name">{{ order.noteCode }}</span>
                <span class="detail-card__code">{{ order.orderCode }}</span>
              </div>
              <span class="detail-card__wait">{{ order.materialCount }} 项</span>
            </div>
            <div class="detail-card__numbers">
              <span>{{ order.supplierName }}</span>
              <span :style="{ color: order.status === '2' ? '#1f7b5b' : order.status === '1' ? '#1890ff' : '#c97a1a' }">
                {{ order.status === '2' ? '已收货' : order.status === '1' ? '已发货' : '未发货' }}
              </span>
            </div>
          </div>
        </div>
      </section>
      </template>

    </main>

    <!-- ========== 底部提交栏 ========== -->
    <footer v-if="receiveFormItems.length > 0" class="app-footer">
      <div class="footer-summary">
        <span>共 <b>{{ receiveFormItems.length }}</b> 项</span>
        <span>本次 <b style="color:#176b57">{{ totalReceivedQty }}</b></span>
        <span>仍差 <b :style="{ color: totalRemainQty === 0 ? '#52c41a' : '#e6a23c' }">{{ totalRemainQty }}</b></span>
      </div>
      <button
        v-if="!submitted"
        class="submit-btn"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : '确认收货' }}
      </button>
      <div v-else class="submit-done">
        ✓ 收货成功
        <button class="reset-btn" @click="handleClearSearch">继续收料</button>
      </div>
    </footer>

    <!-- ========== 扫码弹窗 ========== -->
    <div v-if="scanVisible" class="scan-overlay" @click.self="handleScanDialogClose">
      <div class="scan-dialog">
        <div class="scan-dialog__header">
          <span>扫码收料</span>
          <button class="scan-dialog__close" @click="handleScanDialogClose">✕</button>
        </div>
        <div class="scan-dialog__body">
          <div v-if="!cameraError" class="camera-box">
            <div id="scan-reader" class="scan-reader"></div>
          </div>

          <div v-if="cameraError" class="camera-error">
            <p>{{ cameraError }}</p>
            <p class="error-hint">请检查摄像头权限，或手动输入送货单号</p>
          </div>

          <div class="scan-input-row">
            <input
              v-model="scanInput"
              type="text"
              class="scan-manual-input"
              placeholder="手动输入送货单号"
              @keyup.enter="handleScanConfirm"
            />
            <button class="scan-confirm-btn" @click="handleScanConfirm">确认</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: min(100%, 460px);
  min-height: 100vh;
  margin: 0 auto;
  background: #f8fbfa;
  box-shadow: 0 0 32px rgba(23, 34, 31, 0.1);
  display: flex;
  flex-direction: column;
}

/* ========== 顶部标题栏 ========== */
.app-header {
  display: grid;
  grid-template-columns: 1fr;
  align-items: flex-start;
  gap: 12px;
  padding: 22px 16px 14px;
  background: #123d34;
  color: #fff;
}

.app-header__eyebrow {
  margin: 0 0 4px;
  color: #a9d8ca;
  font-size: 12px;
  font-weight: 800;
}

.app-header__title {
  margin: 0;
  font-size: 30px;
  line-height: 1.1;
}

.app-header__actions {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.header-btn {
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 9px 11px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  font-family: inherit;
  white-space: nowrap;
}

.header-btn--active {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.operator-card {
  flex: 0 0 auto;
  max-width: 140px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 9px 11px;
  background: rgba(255, 255, 255, 0.08);
}

.operator-card__label {
  display: block;
  color: #a9d8ca;
  font-size: 12px;
}

.operator-card__name {
  display: block;
  margin-top: 2px;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 420px) {
  .app-header {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: flex-end;
  }
}

/* ========== 主内容区 ========== */
.app-main {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}

.app-section {
  padding: 14px 14px 0;
}

.app-section--grow {
  flex: 1;
}

/* ========== 搜索栏 ========== */
.search-box {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  flex: 1;
  min-height: 46px;
  border: 1px solid #cfd9d4;
  border-radius: 8px;
  padding: 0 12px;
  background: #f8fbfa;
  color: #17221f;
  font-size: 16px;
  font-weight: 700;
  outline: none;
}

.search-input:focus {
  border-color: #176b57;
  box-shadow: 0 0 0 3px rgba(23, 107, 87, 0.14);
}

.search-btn {
  min-height: 46px;
  border: 0;
  border-radius: 8px;
  padding: 0 20px;
  background: #176b57;
  color: #fff;
  font-size: 15px;
  font-weight: 900;
  white-space: nowrap;
}

.scan-btn {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #cfd9d4;
  border-radius: 8px;
  background: #fff;
  color: #176b57;
}

/* ========== 消息 ========== */
.message {
  margin: 12px 14px 0;
  border: 1px solid #f0c6bd;
  border-radius: 7px;
  padding: 10px 12px;
  background: #fff1ee;
  color: #a83628;
  font-size: 14px;
  font-weight: 800;
}

/* ========== 通用卡片 ========== */
.card {
  border: 1px solid #d7dfdb;
  border-radius: 8px;
  padding: 14px;
  background: #fff;
}

.card-title {
  font-size: 15px;
  font-weight: 900;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-body {
  display: grid;
  gap: 4px;
}

.card-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.card-label {
  color: #63736d;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.card-value {
  font-size: 13px;
  font-weight: 700;
  color: #17221f;
}

/* ========== 标签 ========== */
.tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 10px;
}

.tag-green {
  background: #f0faf6;
  color: #1f7b5b;
  border: 1px solid #b7e3d4;
}

.tag-blue {
  background: #ecf5ff;
  color: #1890ff;
  border: 1px solid #b3d8ff;
}

.tag-orange {
  background: #fef7f0;
  color: #c97a1a;
  border: 1px solid #fadec6;
}

/* ========== 仓库选择 ========== */
.warehouse-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  border: 1px solid #d7dfdb;
  border-radius: 8px;
  padding: 12px 14px;
  background: #fff;
}

.warehouse-select {
  flex: 1;
  min-height: 40px;
  border: 1px solid #cfd9d4;
  border-radius: 8px;
  padding: 0 10px;
  background: #f8fbfa;
  color: #17221f;
  font-size: 14px;
  font-weight: 700;
  outline: none;
}

/* ========== 区域标题 ========== */
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-title {
  margin: 0;
  color: #17221f;
  font-size: 18px;
}

.section-count {
  min-width: 0;
  max-width: 54%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #63736d;
  font-size: 13px;
  font-weight: 800;
}

/* ========== 待收订单列表 ========== */
.order-list {
  display: grid;
  gap: 10px;
}

.order-card {
  cursor: pointer;
  transition: border-color 0.15s;
}

.order-card:active {
  border-color: #178166;
  background: #f0f8f5;
}

/* ========== 物料卡片 ========== */
.detail-list {
  display: grid;
  gap: 10px;
}

.detail-card {
  border: 1px solid #d7dfdb;
  border-radius: 8px;
  padding: 14px;
  background: #fff;
}

.detail-card--error {
  border-color: #d96b58;
  box-shadow: 0 0 0 3px #fae2dd;
}

.detail-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.detail-card__title-block {
  min-width: 0;
}

.detail-card__name,
.detail-card__code {
  display: block;
}

.detail-card__name {
  color: #17221f;
  font-size: 17px;
}

.detail-card__code,
.detail-card__spec,
.detail-card__numbers {
  color: #63736d;
  font-size: 13px;
}

.detail-card__wait {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 5px 9px;
  background: #e9f3ef;
  color: #176b57;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.detail-card__spec {
  margin-bottom: 10px;
}

.detail-card__numbers {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-card__form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.detail-card__field {
  min-width: 0;
}

.detail-card__label {
  display: block;
  margin-bottom: 6px;
  color: #4e5f59;
  font-size: 12px;
  font-weight: 800;
}

.detail-card__input {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid #c8d3ce;
  border-radius: 6px;
  padding: 0 10px;
  background: #f8fbfa;
  color: #17221f;
  font: inherit;
}

.detail-card__input:focus {
  border-color: #178166;
  outline: 3px solid #d6eee6;
}

.detail-card__error {
  margin: 10px 0 0;
  color: #b44031;
  font-size: 13px;
  font-weight: 800;
}

@media (max-width: 360px) {
  .detail-card__form {
    grid-template-columns: 1fr;
  }
}

/* 数量按钮组（配合卡片内的 input） */
.qty-group {
  display: flex;
  align-items: center;
}

.qty-btn {
  width: 44px;
  min-height: 44px;
  border: 1px solid #c8d3ce;
  background: #f8fbfa;
  font-size: 18px;
  font-weight: 900;
  color: #17221f;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qty-btn:first-child {
  border-radius: 6px 0 0 6px;
}

.qty-btn:last-child {
  border-radius: 0 6px 6px 0;
}

.qty-btn:disabled {
  opacity: 0.4;
}

.qty-btn:not(:disabled):active {
  background: #e8f0ec;
}

.detail-card__input.qty-center {
  width: 72px;
  text-align: center;
  border-left: none;
  border-right: none;
  border-radius: 0;
  -moz-appearance: textfield;
}

.detail-card__input.qty-center::-webkit-inner-spin-button,
.detail-card__input.qty-center::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

.field-done {
  margin: 6px 0 0;
  font-size: 13px;
  color: #1f7b5b;
  font-weight: 900;
}

/* ========== 空状态 ========== */
.state-card {
  border: 1px dashed #c8d3ce;
  border-radius: 8px;
  padding: 20px 14px;
  background: #fff;
  color: #63736d;
  text-align: center;
}

/* ========== 底部提交栏 ========== */
.app-footer {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(100%, 460px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #d7dfdb;
  box-shadow: 0 -2px 12px rgba(23, 34, 31, 0.06);
  z-index: 100;
}

.footer-summary {
  display: flex;
  gap: 14px;
  font-size: 13px;
  font-weight: 700;
}

.submit-btn {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  padding: 0 28px;
  background: #176b57;
  color: #fff;
  font-size: 16px;
  font-weight: 900;
}

.submit-btn:disabled {
  opacity: 0.4;
}

.submit-done {
  font-size: 15px;
  color: #1f7b5b;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 12px;
}

.reset-btn {
  min-height: 36px;
  border: 1px solid #cfd9d4;
  border-radius: 8px;
  padding: 0 16px;
  background: #f8fbfa;
  font-size: 13px;
  font-weight: 900;
  color: #17221f;
}

/* ========== 扫码弹窗 ========== */
.scan-overlay {
  position: fixed;
  inset: 0;
  background: rgba(23, 34, 31, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.scan-dialog {
  width: 92%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.scan-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  font-size: 16px;
  font-weight: 900;
  border-bottom: 1px solid #d7dfdb;
}

.scan-dialog__close {
  width: 30px;
  height: 30px;
  border: 1px solid #d7dfdb;
  border-radius: 8px;
  background: #f8fbfa;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #63736d;
}

.scan-dialog__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.camera-box {
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  min-height: 200px;
}

.scan-reader :deep(video) {
  width: 100% !important;
}

.camera-error {
  text-align: center;
  padding: 20px;
  color: #63736d;
}

.error-hint {
  font-size: 12px;
  color: #63736d;
  margin-top: 6px;
}

.scan-input-row {
  display: flex;
  gap: 8px;
}

.scan-manual-input {
  flex: 1;
  min-height: 44px;
  border: 1px solid #cfd9d4;
  border-radius: 8px;
  padding: 0 12px;
  background: #f8fbfa;
  color: #17221f;
  font-size: 15px;
  font-weight: 700;
  outline: none;
}

.scan-confirm-btn {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  padding: 0 20px;
  background: #176b57;
  color: #fff;
  font-size: 14px;
  font-weight: 900;
  white-space: nowrap;
}
</style>
