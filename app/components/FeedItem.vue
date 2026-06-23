<script setup>
import { computed } from "vue";
import ArticleCard from "./ArticleCard.vue";
import VideoCard from "./VideoCard.vue";
import PodcastCard from "./PodcastCard.vue";
import TweetCard from "./TweetCard.vue";

const props = defineProps({ item: { type: Object, required: true } });
defineEmits(["save", "open"]);

const map = {
  article: ArticleCard,
  video: VideoCard,
  podcast: PodcastCard,
  tweet: TweetCard,
};
const comp = computed(() => map[props.item.type]);
</script>

<template>
  <component
    :is="comp"
    :item="item"
    @save="$emit('save')"
    @open="$emit('open')"
  />
</template>
