<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppSidebar from '@/components/AppSidebar.vue'
import Logout from '@/components/Logout.vue'

// ==================== API ====================
const API_ORDERS = '/api/Orders'
const router = useRouter()

// ==================== 加载供应商和物料 ====================
const supplierList = ref([])
const materialList = ref([])
const loading = ref(false)

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

async function loadMaterials() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/Materials/GetAll', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    const text = await res.text()
    const result = text ? JSON.parse(text) : {}
    if (result.success && result.data?.length) {
      materialList.value = result.data
    }
  } catch { /* API 不可用，物料列表为空 */ }
}

// ==================== 表单数据 ====================
const form = reactive({
  supplierID: '',
  materials: [{ materialID: '', qty: 1, unitPrice: 0 }],
  remark: ''
})

function getMaterialSpec(materialID) {
  if (!materialID) return ''
  const mat = materialList.value.find(m => (m.materialID || m.materialCode) === materialID)
  return mat ? (mat.spec || '') : ''
}
function getMaterialUnit(materialID) {
  if (!materialID) return ''
  const mat = materialList.value.find(m => (m.materialID || m.materialCode) === materialID)
  return mat ? (mat.unit || '') : ''
}
function computedAmount(row) {
  return (row.qty * row.unitPrice).toFixed(2)
}

function addMaterial() {
  form.materials.push({ materialID: '', qty: 1, unitPrice: 0 })
}
function removeMaterial(index) {
  if (form.materials.length <= 1) {
    ElMessage.warning('至少保留一行物料信息')
    return
  }
  form.materials.splice(index, 1)
}

// ==================== 提交 ====================
async function submitForm() {
  if (!form.supplierID) {
    ElMessage.warning('请选择供应商')
    return
  }

  const validMaterials = form.materials.filter(
    item => item.materialID && item.qty > 0 && item.unitPrice > 0
  )
  if (validMaterials.length === 0) {
    ElMessage.warning('请完善至少一行有效物料信息')
    return
  }

  const supplier = supplierList.value.find(s => s.supplierID === form.supplierID)

  // ========== 物料去重 + 价格一致性校验 ==========
  const materialMap = new Map()
  const priceConflicts = []

  for (const item of validMaterials) {
    const key = item.materialID
    if (materialMap.has(key)) {
      const existing = materialMap.get(key)
      if (Number(existing.unitPrice) !== Number(item.unitPrice)) {
        const mat = materialList.value.find(m => (m.materialID || m.materialCode) === key)
        const name = mat?.materialName || key
        let conflict = priceConflicts.find(c => c.materialID === key)
        if (!conflict) {
          conflict = { materialID: key, materialName: name, prices: [Number(existing.unitPrice)] }
          priceConflicts.push(conflict)
        }
        if (!conflict.prices.includes(Number(item.unitPrice))) {
          conflict.prices.push(Number(item.unitPrice))
        }
      } else {
        existing.qty += item.qty
      }
    } else {
      materialMap.set(key, { ...item })
    }
  }

  if (priceConflicts.length > 0) {
    let msg = '以下物料存在重复添加且单价不一致，请重新录入：<br><br>'
    for (const c of priceConflicts) {
      msg += `【${c.materialName}】单价：${c.prices.join('、')}<br>`
    }
    await ElMessageBox.alert(msg, '物料单价冲突', {
      dangerouslyUseHTMLString: true,
      type: 'warning',
      confirmButtonText: '知道了'
    })
    return
  }

  const merged = Array.from(materialMap.values())

  const orderData = {
    SupplierID: String(form.supplierID),
    SupplierName: supplier ? supplier.supplierName : '',
    Materials: merged.map(item => ({
      MaterialID: item.materialID,
      Qty: item.qty,
      UnitPrice: Number(item.unitPrice.toFixed(2))
    })),
    Memo: form.remark || ''
  }

  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_ORDERS}/CreateOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify(orderData)
    })
    const text = await res.text()
    let result
    try { result = text ? JSON.parse(text) : {} } catch { result = {} }

    if (result.success) {
      ElMessage.success('采购订单创建成功')
      loading.value = false
      router.push('/order/query')
      return
    }
    ElMessage.warning(result.message || '创建失败')
  } catch {
    ElMessage.error('创建失败，后端不可用')
  }
  loading.value = false
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadSuppliers()
  loadMaterials()
})
</script>

<template>
  <div class="layout">
    <AppSidebar />

    <div class="main">
      <div class="header">
        <h3>创建采购订单</h3>
        <Logout />
      </div>

      <div class="content">
        <el-card shadow="never">
          <el-form :model="form" label-width="100px">
            <el-form-item label="供应商" required>
              <el-select
                v-model="form.supplierID"
                filterable
                placeholder="请输入供应商编号或名称搜索"
                style="width: 100%"
              >
                <el-option
                  v-for="item in supplierList"
                  :key="item.supplierID"
                  :label="`${item.supplierName} (${item.supplierCode})`"
                  :value="item.supplierID"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="物料明细" required>
              <div style="margin-bottom: 10px;">
                <el-button size="small" @click="addMaterial">+ 新增物料</el-button>
                <span style="color: #909399; font-size: 12px; margin-left: 8px;">
                  选择物料后自动带入规格和单位，数量和单价需大于0
                </span>
              </div>
              <el-table :data="form.materials" border size="small" style="width: 100%">
                <el-table-column label="物料" min-width="180">
                  <template #default="scope">
                    <el-select
                      v-model="scope.row.materialID"
                      filterable
                      placeholder="搜索并选择物料"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="m in materialList"
                        :key="m.materialID || m.materialCode"
                        :label="`${m.materialCode} - ${m.materialName}`"
                        :value="m.materialID || m.materialCode"
                      />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="规格" width="130" align="center">
                  <template #default="scope">
                    {{ getMaterialSpec(scope.row.materialID) }}
                  </template>
                </el-table-column>
                <el-table-column label="数量" width="120">
                  <template #default="scope">
                    <el-input-number
                      v-model="scope.row.qty"
                      :min="0.01"
                      :step="0.01"
                      :precision="2"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="单位" width="70" align="center">
                  <template #default="scope">
                    {{ getMaterialUnit(scope.row.materialID) }}
                  </template>
                </el-table-column>
                <el-table-column label="单价(元)" width="110">
                  <template #default="scope">
                    <el-input-number
                      v-model="scope.row.unitPrice"
                      :min="0.01"
                      :precision="2"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="金额(元)" width="100" align="right">
                  <template #default="scope">
                    ¥{{ computedAmount(scope.row) }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="70" align="center">
                  <template #default="scope">
                    <el-button
                      type="danger"
                      link
                      size="small"
                      @click="removeMaterial(scope.$index)"
                    >
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-form-item>

            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                rows="2"
                placeholder="选填"
              />
            </el-form-item>

            <el-form-item>
              <div class="form-actions">
                <el-button @click="router.push('/order/query')">取消</el-button>
                <el-button type="primary" :loading="loading" @click="submitForm">确认创建</el-button>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 60px; background: #fff; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; }
.content { padding: 20px; flex: 1; overflow-y: auto; background: #f0f2f5; }
.form-actions { display: flex; gap: 12px; margin-top: 10px; }
</style>
