<script setup lang="ts">
import { computed } from 'vue'
import { settings } from '../stores/settings'
import { t } from '../services/i18n'
import { auth, signIn, signOut } from '../services/auth'
import { GOOGLE_CLIENT_ID } from '../config'
import type { ReportType } from '../services/reports'

const emit = defineEmits<{ close: [] }>()

const REPORT_TYPES: { type: ReportType; emoji: string; key: string }[] = [
  { type: 'politie', emoji: '🚓', key: 'rt_politie' },
  { type: 'rollerbank', emoji: '⚙️', key: 'rt_rollerbank' },
  { type: 'hulpdienst', emoji: '🚑', key: 'rt_hulpdienst' },
  { type: 'gevaarlijk_wegdek', emoji: '⚠️', key: 'rt_gevaarlijk_wegdek' },
  { type: 'wegafsluiting', emoji: '🚧', key: 'rt_wegafsluiting' },
]

function shown(tp: ReportType) {
  return !settings.hiddenTypes.includes(tp)
}
function toggleType(tp: ReportType) {
  const i = settings.hiddenTypes.indexOf(tp)
  if (i >= 0) settings.hiddenTypes.splice(i, 1)
  else settings.hiddenTypes.push(tp)
}

// Initialen voor de avatar als er geen Google-foto is.
const initials = computed(() => {
  const n = auth.user?.name || auth.user?.email || t('guest')
  return n.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
})
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet">
      <div class="head">
        <strong class="title">{{ t('settings') }}</strong>
        <button class="x" aria-label="X" @click="emit('close')">✕</button>
      </div>

      <!-- Profielkop -->
      <div class="profile">
        <img v-if="auth.user?.picture" :src="auth.user.picture" alt="" referrerpolicy="no-referrer" />
        <span v-else class="avatar">{{ initials }}</span>
        <div class="who">
          <strong>{{ auth.user?.name || auth.user?.email || t('guest') }}</strong>
          <span class="plate" :class="settings.plate">{{ settings.plate }}</span>
        </div>
        <button v-if="auth.user" class="link" @click="signOut">{{ t('logout') }}</button>
        <button v-else-if="GOOGLE_CLIENT_ID" class="link" @click="signIn">{{ t('sign_in_google') }}</button>
      </div>

      <!-- PROFIEL -->
      <h4>{{ t('profile') }}</h4>
      <div class="group">
        <div class="row col">
          <span class="label">🛵 {{ t('default_plate') }}</span>
          <div class="seg">
            <button :class="{ active: settings.plate === 'blauw' }" @click="settings.plate = 'blauw'">
              {{ t('plate_blue') }}
            </button>
            <button :class="{ active: settings.plate === 'geel' }" @click="settings.plate = 'geel'">
              {{ t('plate_yellow') }}
            </button>
          </div>
        </div>
        <div class="row col">
          <span class="label">🌍 {{ t('language') }}</span>
          <div class="seg">
            <button :class="{ active: settings.locale === 'nl' }" @click="settings.locale = 'nl'">🇳🇱 NL</button>
            <button :class="{ active: settings.locale === 'en' }" @click="settings.locale = 'en'">🇬🇧 EN</button>
          </div>
        </div>
        <label class="row">
          <span class="label">🚀 {{ t('speed_warning') }}</span>
          <input type="checkbox" class="switch" v-model="settings.speedWarning" />
        </label>
      </div>

      <!-- APP -->
      <h4>{{ t('app') }}</h4>
      <div class="group">
        <div class="row col">
          <span class="label">🎨 {{ t('theme') }}</span>
          <div class="seg">
            <button :class="{ active: settings.theme === 'auto' }" @click="settings.theme = 'auto'">
              {{ t('theme_auto') }}
            </button>
            <button :class="{ active: settings.theme === 'licht' }" @click="settings.theme = 'licht'">
              {{ t('light') }}
            </button>
            <button :class="{ active: settings.theme === 'donker' }" @click="settings.theme = 'donker'">
              {{ t('dark') }}
            </button>
          </div>
        </div>
        <label class="row">
          <span class="label">🔊 {{ t('voice_sounds') }}</span>
          <input type="checkbox" class="switch" v-model="settings.voice" />
        </label>
        <label class="row">
          <span class="label">📱 {{ t('keep_awake') }}</span>
          <input type="checkbox" class="switch" v-model="settings.keepAwake" />
        </label>
        <label class="row">
          <span class="label">🧲 {{ t('snap_to_road') }}</span>
          <input type="checkbox" class="switch" v-model="settings.snapToRoad" />
        </label>
      </div>

      <!-- Welke meldingen tonen -->
      <h4>{{ t('show_reports') }}</h4>
      <div class="group">
        <label v-for="rt in REPORT_TYPES" :key="rt.type" class="row">
          <span class="label">{{ rt.emoji }} {{ t(rt.key) }}</span>
          <input type="checkbox" class="switch" :checked="shown(rt.type)" @change="toggleType(rt.type)" />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.sheet {
  width: min(380px, 92vw);
  height: 100%;
  background: var(--bg);
  color: var(--text);
  padding: 18px;
  overflow-y: auto;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.title {
  font-size: 26px;
}
.x {
  border: 0;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted);
}

/* Profielkop */
.profile {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 20px;
}
.profile img,
.profile .avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 800;
  font-size: 18px;
  object-fit: cover;
}
.profile .who {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.profile .who strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile .link {
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}
.plate {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.plate.geel {
  background: #ffd54a;
  color: #3a2e00;
}
.plate.blauw {
  background: #4f5bd5;
  color: #fff;
}

h4 {
  margin: 0 0 8px 4px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.group {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 20px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.row:last-child {
  border-bottom: 0;
}
.row.col {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.row .label {
  font-size: 15px;
}

/* Segment-knoppen (meerkeuze) */
.seg {
  display: flex;
  gap: 8px;
}
.seg button {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 10px;
  cursor: pointer;
}
.seg button.active {
  border-color: var(--accent);
  background: var(--surface-2);
  color: var(--accent);
  font-weight: 700;
}

/* Toggle-switch (native checkbox, CSS-only) */
.switch {
  appearance: none;
  -webkit-appearance: none;
  flex: 0 0 auto;
  width: 46px;
  height: 28px;
  border-radius: 999px;
  background: var(--border);
  position: relative;
  cursor: pointer;
  transition: background 0.15s;
}
.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.switch:checked {
  background: var(--accent);
}
.switch:checked::after {
  transform: translateX(18px);
}
</style>
