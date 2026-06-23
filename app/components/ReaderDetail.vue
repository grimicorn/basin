<script setup>
import { computed } from "vue";

const feedStore = useFeedStore();
const { showToast } = useToast();

const item = computed(() => feedStore.state.activeItem);
</script>

<template>
  <div v-if="item" class="detail-scrim" @click.self="feedStore.closeDetail">
    <div class="detail-sheet">
      <div class="detail-head">
        <SourceTag :item="item" />
        <div class="ml-auto flex items-center gap-0.5">
          <button
            class="icon-btn"
            title="Previous (←)"
            @click="feedStore.detailNav(-1)"
          >
            <RIcon
              name="chevRight"
              :size="16"
              style="transform: rotate(180deg)"
            />
          </button>
          <button
            class="icon-btn"
            title="Next (→)"
            @click="feedStore.detailNav(1)"
          >
            <RIcon name="chevRight" :size="16" />
          </button>
          <span class="bg-border mx-1 h-5 w-px"></span>
          <button
            class="icon-btn"
            :class="{ on: item.saved }"
            :title="item.saved ? 'Saved' : 'Save for later'"
            @click="feedStore.toggleSave(item)"
          >
            <RIcon
              :name="item.saved ? 'bookmarkFill' : 'bookmark'"
              :size="16"
            />
          </button>
          <button
            class="icon-btn"
            title="Open original"
            @click="showToast('Opening original · ' + item.source)"
          >
            <RIcon name="external" :size="16" />
          </button>
          <button
            class="icon-btn"
            title="Close (esc)"
            @click="feedStore.closeDetail"
          >
            <RIcon name="x" :size="18" />
          </button>
        </div>
      </div>

      <div class="detail-body">
        <!-- loading shimmer -->
        <div v-if="feedStore.state.detailLoading" class="p-7 sm:p-9">
          <div class="sk mb-6 h-3.5 w-1/3"></div>
          <div class="sk mb-3 h-7 w-5/6"></div>
          <div class="sk mb-8 h-7 w-2/3"></div>
          <div class="sk mb-3 h-3.5 w-full"></div>
          <div class="sk mb-3 h-3.5 w-full"></div>
          <div class="sk h-3.5 w-4/5"></div>
        </div>

        <template v-else>
          <!-- ARTICLE -->
          <article v-if="item.type === 'article'" class="p-7 sm:p-9">
            <div
              v-if="item.tags"
              class="mb-4 flex flex-wrap items-center gap-2"
            >
              <span v-for="t in item.tags" :key="t" class="chip">#{{ t }}</span>
            </div>
            <h1 class="detail-title mb-4">{{ item.title }}</h1>
            <div
              class="text-muted mb-7 pb-7 text-[12.5px]"
              style="border-bottom: 1px solid var(--border)"
            >
              {{ item.source }} · {{ item.meta }} · {{ item.time }} ago
            </div>
            <div class="detail-prose">
              <p v-for="(p, i) in feedStore.articleBody(item)" :key="i">
                {{ p }}
              </p>
            </div>
            <button
              class="btn mt-8"
              @click="showToast('Opening original · ' + item.source)"
            >
              <RIcon name="external" :size="15" /> Open original
            </button>
          </article>

          <!-- VIDEO -->
          <div v-else-if="item.type === 'video'">
            <div
              class="ph ratio-16x9"
              :data-label="item.thumb"
              style="border-radius: 0"
            >
              <span class="thumb-play" style="width: 64px; height: 64px"
                ><RIcon name="play" :size="28"
              /></span>
              <span class="thumb-dur">{{ item.meta }}</span>
            </div>
            <div class="p-7 sm:p-8">
              <h2 class="detail-title mb-3" style="font-size: 22px">
                {{ item.title }}
              </h2>
              <div
                class="text-muted mb-6 flex flex-wrap items-center gap-2.5 pb-6 text-[12.5px]"
                style="border-bottom: 1px solid var(--border)"
              >
                <span class="src-ic src-video" style="--c: var(--src-video)"
                  ><RIcon name="video" :size="13"
                /></span>
                <b class="text-ink-2 font-medium">{{ item.source }}</b
                ><span>·</span><span>{{ item.views }}</span
                ><span>·</span><span>{{ item.meta }}</span>
              </div>
              <div class="detail-prose">
                <p>{{ feedStore.videoDesc(item) }}</p>
              </div>
              <button
                class="btn btn-primary mt-7"
                @click="showToast('Opening on YouTube')"
              >
                <RIcon name="play" :size="15" /> Watch on YouTube
              </button>
            </div>
          </div>

          <!-- PODCAST -->
          <div v-else-if="item.type === 'podcast'" class="p-7 sm:p-8">
            <div class="mb-6 flex gap-4">
              <div
                class="ph ratio-1x1"
                data-label="cover"
                style="
                  width: 96px;
                  height: 96px;
                  flex: none;
                  color: var(--src-podcast);
                "
              >
                <RIcon name="mic" :size="24" />
              </div>
              <div class="min-w-0 self-center">
                <div class="text-muted mb-1.5 text-[12px]">
                  {{ item.source }}
                </div>
                <h2 class="detail-title" style="font-size: 20px">
                  {{ item.title }}
                </h2>
              </div>
            </div>
            <div
              class="mb-7 rounded-sm p-4"
              style="background: var(--surface-2)"
            >
              <div class="mb-3 flex items-center gap-3">
                <button
                  class="pod-play"
                  style="width: 44px; height: 44px"
                  @click="showToast('Playing · ' + item.source)"
                >
                  <RIcon name="play" :size="18" />
                </button>
                <div class="flex-1">
                  <div class="scrubber">
                    <i
                      :style="{
                        width: ((item.progress || 0) * 100 || 3) + '%',
                      }"
                    ></i>
                  </div>
                </div>
              </div>
              <div
                class="text-muted flex items-center justify-between text-[11px]"
              >
                <span>{{
                  item.progress
                    ? Math.round(item.progress * 64) + ":00"
                    : "0:00"
                }}</span>
                <div class="flex gap-1.5">
                  <span class="kbd">1.0×</span><span class="kbd">+15s</span>
                </div>
                <span>{{ item.meta }}</span>
              </div>
            </div>
            <div class="text-faint mb-3 text-[10px] tracking-[.14em] uppercase">
              Show notes
            </div>
            <div class="detail-prose">
              <p v-for="(p, i) in feedStore.podcastNotes(item)" :key="i">
                {{ p }}
              </p>
            </div>
          </div>

          <!-- TWEET -->
          <div v-else-if="item.type === 'tweet'" class="p-7 sm:p-8">
            <div class="mb-5 flex items-center gap-3">
              <span
                class="avatar src-tweet"
                style="width: 48px; height: 48px; font-size: 16px"
                >{{
                  item.source
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                }}</span
              >
              <div class="min-w-0">
                <b class="text-ink block text-[15px] font-semibold">{{
                  item.source
                }}</b>
                <span class="text-muted text-[13px]">{{ item.handle }}</span>
              </div>
              <span class="src-tweet ml-auto"
                ><RIcon name="chat" :size="20"
              /></span>
            </div>
            <p class="detail-tweet mb-5">{{ item.text }}</p>
            <div
              class="text-muted mb-5 pb-5 text-[12px]"
              style="border-bottom: 1px solid var(--border)"
            >
              {{ item.time }} ago · {{ item.meta.split("·")[0].trim() }} likes ·
              {{ item.meta.split("·")[1].trim() }} reposts
            </div>
            <div class="text-faint mb-3 text-[10px] tracking-[.14em] uppercase">
              Replies
            </div>
            <div class="flex flex-col gap-4">
              <div
                v-for="(r, i) in feedStore.tweetReplies(item)"
                :key="i"
                class="flex gap-3"
              >
                <span
                  class="avatar src-tweet"
                  style="width: 36px; height: 36px; font-size: 11px"
                  >{{ r.who.slice(0, 2).toUpperCase() }}</span
                >
                <div class="min-w-0">
                  <div class="mb-0.5 text-[12.5px]">
                    <b class="text-ink font-semibold">{{ r.who }}</b>
                    <span class="text-muted">{{ r.handle }}</span>
                  </div>
                  <p class="text-ink-2 m-0 text-[14px] leading-snug">
                    {{ r.text }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.detail-scrim {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: color-mix(in oklab, var(--bg) 36%, #00000066);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.detail-sheet {
  width: min(760px, calc(100vw - 28px));
  margin: 7vh 0 5vh;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: popSafe 0.22s var(--ease);
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--border);
  flex: none;
}
.detail-body {
  overflow-y: auto;
}
.detail-prose p {
  margin: 0 0 17px;
  font-size: 16px;
  line-height: 1.7;
  color: var(--ink-2);
  text-wrap: pretty;
}
.detail-prose p:last-child {
  margin-bottom: 0;
}
.detail-title {
  font-size: 27px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--ink);
  text-wrap: pretty;
  margin: 0;
}
.detail-tweet {
  font-size: 21px;
  line-height: 1.5;
  color: var(--ink);
  text-wrap: pretty;
  margin: 0;
}
.scrubber {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
  cursor: pointer;
}
.scrubber > i {
  display: block;
  height: 100%;
  background: var(--src-podcast);
  border-radius: 999px;
  position: relative;
}
.scrubber > i::after {
  content: "";
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--src-podcast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
</style>
