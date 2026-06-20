<script setup>
import { ref } from 'vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
  supplierList: { type: Array, required: true },
  formData: { type: Object, required: true }
})

const emit = defineEmits(['update:visible', 'addMaterial', 'removeMaterial', 'submit'])

// 供应商筛选（支持编码和名称模糊搜索）
const filteredSuppliers = ref([...props.supplierList])

function filterSupplier(query) {
  if (!query) {
    filteredSuppliers.value = [...props.supplierList]
    return
  }
  const q = query.toLowerCase()
  filteredSuppliers.value = props.supplierList.filter(
    s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  )
}

function computedAmount(row) {
  return (row.quantity * row.price).toFixed(2)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="创建采购订单"
    width="750px"
    :close-on-click-modal="false"
    @update:model-value="val => emit('update:visible', val)"
  >
    <el-form :model="formData" label-width="100px">
      <el-form-item label="供应商" required>
        <el-select
          v-model="formData.supplierId"
          filterable
          :filter-method="filterSupplier"
          placeholder="请输入供应商编号或名称搜索"
          style="width: 100%"
        >
          <el-option
            v-for="item in filteredSuppliers"
            :key="item.id"
            :label="`${item.name} (${item.code})`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="物料明细" required>
        <div style="margin-bottom: 10px;">
          <el-button size="small" @click="emit('addMaterial')">+ 新增物料</el-button>
          <span style="color: #909399; font-size: 12px; margin-left: 8px;">
            请填写完整物料信息，数量和单价需大于0
          </span>
        </div>
        <el-table :data="formData.materials" border size="small" style="width: 100%">
          <el-table-column label="物料编码" prop="materialCode">
            <template #default="scope">
              <el-input v-model="scope.row.materialCode" size="small" placeholder="请输入" />
            </template>
          </el-table-column>
          <el-table-column label="物料名称" prop="materialName">
            <template #default="scope">
              <el-input v-model="scope.row.materialName" size="small" placeholder="请输入" />
            </template>
          </el-table-column>
          <el-table-column label="数量" prop="quantity" width="90">
            <template #default="scope">
              <el-input-number
                v-model="scope.row.quantity"
                :min="1"
                size="small"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价(元)" prop="price" width="110">
            <template #default="scope">
              <el-input-number
                v-model="scope.row.price"
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
                @click="emit('removeMaterial', scope.$index)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form-item>

      <el-form-item label="预计交货日期">
        <el-date-picker
          v-model="formData.deliveryDate"
          type="date"
          placeholder="选择交货日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="备注">
        <el-input
          v-model="formData.remark"
          type="textarea"
          rows="2"
          placeholder="选填"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="emit('submit')">确认创建</el-button>
    </template>
  </el-dialog>
</template>
