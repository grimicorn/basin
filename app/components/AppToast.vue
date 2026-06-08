<script setup>
const { toast } = useToast();
</script>

<template>
  <Transition name="toast">
    <div v-if="toast.show" class="toast">
      <RIcon name="check" :size="15" /> {{ toast.msg }}
    </div>
  </Transition>
</template>

<style>
.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 9500;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  background: var(--ink);
  color: var(--bg);
  padding: 11px 16px;
  border-radius: 11px;
  box-shadow: var(--shadow-lg);
}
.toast .ricon {
  color: var(--accent);
}
.toast-enter-active,
.toast-leave-active {
  transition: transform 0.25s var(--ease);
}
.toast-enter-from,
.toast-leave-to {
  transform: translate(-50%, 16px);
}
</style>
