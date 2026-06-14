<script setup>
const feedStore = useFeedStore();
const { user } = useUser();
const clerk = useClerk();

function handleSignOut() {
  clerk.value?.signOut({ redirectUrl: "/login" });
}
</script>

<template>
  <section class="set-section">
    <h2>Account</h2>
    <p class="desc">Manage your Reader account.</p>
    <div class="conn">
      <AvatarButton class="h-12 w-12" />
      <div class="conn-info">
        <div class="conn-name">{{ user?.fullName }}</div>
        <div class="conn-desc">
          {{ user?.primaryEmailAddress?.emailAddress }}
        </div>
        <div class="conn-since">
          Free plan · {{ feedStore.state.items.length }} items today
        </div>
      </div>
      <button class="btn" @click="handleSignOut">
        <RIcon name="logout" :size="16" /> Sign out
      </button>
    </div>
  </section>

  <section class="set-section">
    <h2>Edit profile</h2>
    <p class="desc">Update your name and profile photo.</p>
    <UserProfile />
  </section>
</template>
