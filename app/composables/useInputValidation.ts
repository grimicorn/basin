interface InputValidationProps {
  error?: string;
  success?: boolean | string;
  disabled?: boolean;
  helperText?: string;
}

export function useInputValidation(
  props: InputValidationProps,
  extraClasses: Record<string, boolean> = {},
) {
  const fieldClasses = computed(() => ({
    field: true,
    ...extraClasses,
    "is-success": !!props.success,
    "is-error": !!props.error,
    "is-disabled": props.disabled,
  }));

  const helpState = computed(() => {
    if (props.error) {
      return { text: props.error, type: "error" };
    }
    if (props.success && typeof props.success === "string") {
      return { text: props.success, type: "success" };
    }
    if (props.helperText) {
      return { text: props.helperText, type: "neutral" };
    }
    return null;
  });

  const showValidationIcon = computed(() => !!props.error || !!props.success);

  return { fieldClasses, helpState, showValidationIcon };
}
