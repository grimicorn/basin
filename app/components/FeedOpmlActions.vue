<script setup>
const props = defineProps({
  importing: { type: Boolean, default: false },
  exporting: { type: Boolean, default: false },
  importSummary: { type: Object, default: null },
});

const emit = defineEmits(["import-file", "export"]);

const opmlFileInput = ref(null);

function openOpmlFilePicker() {
  opmlFileInput.value?.click();
}

function onOpmlFileSelected(fileChangeEvent) {
  const file = fileChangeEvent.target.files?.[0];
  fileChangeEvent.target.value = "";
  if (!file) {
    return;
  }
  emit("import-file", file);
}

const skippedTitles = computed(
  () =>
    props.importSummary?.skipped
      .map((skippedFeed) => skippedFeed.title ?? skippedFeed.url)
      .join(", ") ?? "",
);
</script>

<template>
  <div class="opml-actions">
    <input
      ref="opmlFileInput"
      type="file"
      accept=".opml,.xml,text/x-opml,text/xml"
      class="opml-file-input"
      hidden
      @change="onOpmlFileSelected"
    />
    <button class="btn" :disabled="importing" @click="openOpmlFilePicker">
      <RIcon name="upload" :size="16" />
      {{ importing ? "Importing…" : "Import OPML" }}
    </button>
    <button class="btn" :disabled="exporting" @click="emit('export')">
      <RIcon name="download" :size="16" />
      {{ exporting ? "Exporting…" : "Export OPML" }}
    </button>
    <p v-if="importSummary" class="desc opml-summary">
      Imported {{ importSummary.importedCount }} feed{{
        importSummary.importedCount === 1 ? "" : "s"
      }}<template v-if="importSummary.skipped.length">
        , skipped {{ importSummary.skipped.length }}:
        {{ skippedTitles }} </template
      ><template v-if="importSummary.truncatedCount">
        , {{ importSummary.truncatedCount }} not attempted — file exceeded the
        import limit
      </template>
    </p>
  </div>
</template>
