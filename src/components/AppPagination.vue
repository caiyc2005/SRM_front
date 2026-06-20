<script setup>
/**
 * AppPagination.vue — 通用分页组件
 *
 * 接收页面查询对象和总记录数，双向绑定页码和每页条数。
 * query 必须是 reactive 对象，含 pageNum、pageSize 属性。
 */

defineProps({
  total: { type: Number, required: true },
  query: { type: Object, required: true }
})

const emit = defineEmits(['change'])
</script>

<template>
  <div class="pagination">
    <el-pagination
      v-model:current-page="query.pageNum"
      v-model:page-size="query.pageSize"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      @current-change="emit('change')"
      @size-change="emit('change')"
    />
  </div>
</template>

<style scoped>
.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
