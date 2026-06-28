<script setup>
/**
 * AppFilter.vue — 通用筛选组件
 *
 * 通过 fields 配置数组动态渲染筛选字段，支持 input / select 两种类型。
 * 额外按钮通过 slot="buttons" 注入。
 *
 * @example
 * <AppFilter :fields="fields" :model="query" @query="..." @reset="...">
 *   <template #buttons>
 *     <el-button @click="handleExport">导出</el-button>
 *   </template>
 * </AppFilter>
 */

defineProps({
  /** 筛选字段配置 [{ key, label, type, width?, options?, labelKey?, valueKey?, placeholder? }] */
  fields: { type: Array, required: true },
  /** 绑定的查询对象（必须是 reactive，用于双向绑定） */
  model: { type: Object, required: true }
})

const emit = defineEmits(['query', 'reset'])
</script>

<template>
  <div class="card">
    <div class="filter-box">
      <template v-for="field in fields" :key="field.key">
        <!-- 输入框 -->
        <div v-if="field.type === 'input'" class="filter-item">
          <label>{{ field.label }}</label>
          <el-input
            v-model="model[field.key]"
            :placeholder="field.placeholder || '模糊搜索'"
            :style="{ width: (field.width || 220) + 'px' }"
            clearable
          />
        </div>
        <!-- 日期范围 -->
        <div v-else-if="field.type === 'daterange'" class="filter-item">
          <label>{{ field.label }}</label>
          <el-date-picker
            v-model="model[field.key]"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :style="{ width: (field.width || 300) + 'px' }"
            clearable
          />
        </div>
        <!-- 下拉选择 -->
        <div v-else-if="field.type === 'select'" class="filter-item">
          <label>{{ field.label }}</label>
          <el-select
            v-model="model[field.key]"
            :placeholder="field.placeholder || '请选择'"
            :style="{ width: (field.width || 220) + 'px' }"
            clearable
          >
            <el-option
              v-for="opt in field.options"
              :key="opt[field.valueKey || 'value']"
              :label="opt[field.labelKey || 'label']"
              :value="opt[field.valueKey || 'value']"
            />
          </el-select>
        </div>
      </template>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <el-button type="primary" @click="emit('query')">查询</el-button>
        <el-button @click="emit('reset')">重置</el-button>
        <slot name="buttons" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.filter-box {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.filter-item label {
  font-size: 13px;
  color: #666;
}
</style>
