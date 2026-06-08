/* useToast — tiny global notification. */
import { reactive } from "vue";

const toast = reactive({ show: false, msg: "" });
let timer = null;

export function useToast() {
  function showToast(msg) {
    toast.show = true;
    toast.msg = msg;
    clearTimeout(timer);
    timer = setTimeout(() => {
      toast.show = false;
    }, 2200);
  }
  return { toast, showToast };
}
